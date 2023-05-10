---
title: "Hidden Overheads"
date: "2023-05-10"
description: "Why do we tolerate some hidden performance costs in systems programming languages, but not others?"
---

One day I was sitting around thinking about performance,
when a thought popped into my head --
how can it be that systems programmers shun higher-level languages
due to their hidden performance costs
when even C has plenty of areas where something expensive can happen
without much ceremony or acknowledgement from the language?
To answer that question we first need to take a look at
some of the hidden costs present in higher-level languages.

## Garbage collector pauses

I’d say there is a general consensus among programmers that
garbage-collected languages are not an option for systems programming.
Take Go, a language which uses garbage collection for memory management
and which [originally marketed itself][old go site]
as a systems programming language,
only to abandon that notion soon after release.
Perhaps the reason for this was that systems programmers
find a language with a garbage collector unsuited to their work.

One of the reasons GC is often considered unacceptable for systems programming
is the hidden cost collector pauses incur.
Of course, managing memory through automatic garbage collection
has a variety of other overheads,
such as memory usage, runtime implementation complexity and so on,
but that’s not the focus here.
With a non-pauseless garbage collector at play,
your program will be interrupted at certain intervals
to give the GC a chance to do its dirty work.
As systems programmers,
we want to have total control over what the target machine executes.

## Copy on write

The Swift programming language has a focus on values
which goes far beyond the likes of C#, Kotlin, and so on.
While the latter make it easier to work with data instead of objects
by generating boilerplate methods and constructors,
Swift goes comparatively all out.
For instance, the fundamental collections in the standard library
are actually value types.
No more mysterious “who-modified-the-`ArrayList`-after-I-passed-it-twenty-levels-down-the-call-stack” bugs!
Of course, without a bit of trickery this is unworkable:
imagine if your 100 megabyte uncompressed texture was copied
every time you passed it to a function.

To solve this, Swift implements a scheme called _Copy on Write,_ or CoW.
It does exactly what it says on the tin:
data is actually passed by reference, avoiding expensive copies.
When you try to modify this referenced data,
a duplicate is created so the original copy of the data remains untouched.
The catch is that a simple `data[x] = 10` doesn’t _look_ expensive,
even though it could involve `memcpy`ing gigabytes of data --
a hidden cost.

## Unicode segmentation on indexing

In general, if you’re programming in a language with C-like syntax,
you expect indexing to be an _O_(1) operation.
For this assumption to hold, indexing can’t consist of much more than
the _O_(1) computation of a memory address
and then a subsequent load from that address.
A hashmap lookup or a simple `*(pointer + offset)` both fit the bill.

Unfortunately for you,
UTF-8 is space-efficient, exceedingly popular, and also _variable width,_
meaning that indexing into it based on what humans call “characters”
(but Unicode calls extended grapheme clusters)
requires a scan through the whole string up till the requested index,
making indexing _O_(_n_).

Swift is used a great deal for user interface programming,
where handling this sort of thing is of vital importance.
Moreover, Apple wants Swift to be [beginner-friendly][Playgrounds],
and isn’t overly concerned with performance cliffs
(as we just saw in the last section).
This unusual set of circumstances led to
Swift being the only major programming language I’ve heard of
to make string indexing operate on extended grapheme clusters,
rather than bytes.
For Swift this compromise makes sense --
from the perspective of someone who’s
never used the language extensively, at least
-- but it certainly doesn’t for a systems programming language.

## Where was I?

Right.
We just saw some examples of hidden costs that higher-level languages incur,
in each case for the sake of convenience and safety.
I think it’s fairly clear why someone might
find any of these tradeoffs unacceptable.

What’s next is what confused me:
languages such as C and C++ contain myriad performance overheads
with no acknowledgement from the language whatsoever.
Is that not incompatible with the ethos of these languages?

## Stack spilling

If you write a function which has more un-eliminatable local variables
than there are available registers,
inevitably some of those local variables will spill to the stack.
Is this not a hidden cost?
Stack spilling can have a sizeable effect on performance in a hot loop;
those memory accesses aren’t free, after all.
On Zen&nbsp;4 an L1D cache access [takes 0.7 nanoseconds][Zen 4];
on Apple’s Firestorm, [around 0.94 nanoseconds][M1].
That’s not an insignificant price to pay
if the alternative is some juicy unrolled arithmetic instructions
(maybe even SIMD!)
the CPU can crunch through in one cycle without a second thought.
To illustrate this point: on Firestorm,
you could have performed thirty-two 32-bit integer operations
in the time it takes to load a single 32-bit stack-allocated local!

Surely, if we are to avoid all hidden costs
and be truly explicit with how we want our code to behave,
we would want the compiler to error out
when it can’t fit all necessary locals into registers?
Locals which the programmer desires to be spilled could be annotated,
making the performance cost visible in the source.

I’ve never heard of anyone asking for such a feature.

## Silent `memcpy`s

Say we have a giant struct:

```c
struct giant {
	uint64_t nums[8192];
};
```

If we have two instances of this struct and assign one to the other,
this will cause the compiler to emit a `memcpy` of 64 KiB.
Not only will this totally wipe out the L1D of any desktop CPU on the market
(save for Apple’s offerings),
but it will do so silently with no hint to the programmer whatsoever.

Isn’t the whole point of using low level languages
that we can avoid such things?
Think back to the hidden `memcpy`s from Swift, earlier.
Again, we could potentially forbid simple assignment of structs,
requiring an explicit call to `memcpy`,
but I’ve never heard anyone say they want this.

## Why are we okay with some hidden costs but not others?

You might argue that the costs of these examples so far are,
for most purposes, negligible.
That might very well be correct.
Philosophically, though, this didn’t sit right with me.
Where do you draw the line?

After thinking about the problem for a bit,
I think I’ve determined the key factor here:
_time complexity._

It isn’t entirely disastrous if an accidental `memcpy` of a large struct
makes a hot loop somewhere run 1.25 times slower --
at least the code will still execute in a reasonable amount of time.
It _is_ disastrous, though, if the time complexity of that loop
changes from _O_(_n_) to _O_(*n*²)
because you _dared_ to index into a string.
Small inputs seem to work fine,
but the moment your code runs on real data
it might end up running for a very, very long time.

Let’s go through each of the hidden costs discussed so far,
one by one.

_GC pauses_:
I’m not entirely sure what the time complexity of a GC pause is;
I would assume that it varies from garbage collector to garbage collector.
In any case, I’d imagine that the more objects your code creates,
the worse GC pauses become.

_Copy on write semantics_:
Since CoW in Swift applies to
dynamically-sized data structures like heap-allocated arrays,
copy on write has an _O_(_n_) overhead
where _n_ is the amount of data being processed.

_Unicode extended grapheme cluster-aware string indexing_:
A Unicode segmentation algorithm
runs until it reaches the requested index,
which can vary depending on the amount of data
being ingested by your code at runtime; that’s _O_(_n_).

_Stack spilling_:
Since we’re talking about local variables here and not `alloca`,
the amount of data allocated on the stack is fixed at compile time.
Although allocation on the stack is _O_(1),
accessing memory on the stack is, like any other memory access, _O_(_n_)
(depending on how much memory you access).
However, since the sizes of our local variables
and the places where they’re accessed are fixed,
the overhead of stack spilling is fixed,
no matter how much data gets passed into our function.

_Silent `memcpy`s_:
The same goes for assignments as for spilling locals to the stack:
the sizes of data types are determined at compile time,
so a simple `a = b;` will never copy a variable amount of data,
making it _O_(1).

This gives us a general principle:
in a systems programming language,
anything with time complexity greater than _O_(1)
must be intended by the programmer and be visible in the source.

## A small clarification

I want to make it clear that I’m not arguing that
_any_ performance cost is acceptable as long as it’s _O_(1).
No one will take your C replacement seriously
if every program runs exactly ten times as slow as an equivalent written in C,
even though that’s a constant factor overhead.

Instead, I’m saying that any overhead
which has a time complexity greater than _O_(1)
certainly does not belong in a systems programming language.
No one will take your C replacement seriously if

```c
for (int i = 0; i < count; i++) {
	data[i];
}
```

is _O_(*n*²).

[old go site]: https://web.archive.org/web/20100802110413/http://golang.org/
[Playgrounds]: https://developer.apple.com/swift-playgrounds/
[Zen 4]: https://chipsandcheese.com/2022/11/08/amds-zen-4-part-2-memory-subsystem-and-conclusion/
[M1]: https://www.7-cpu.com/cpu/Apple_M1.html
