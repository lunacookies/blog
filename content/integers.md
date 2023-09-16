---
title: "Thoughts On Integers"
date: "2023-09-14"
---

In this post I’ll lay out my views on integer types,
and how I’ve come to those views.
Hopefully you’ll disagree initially and be convinced by the end!

## The status quo

Let’s begin with what I’d characterize as the status quo
in popular programming languages today.
But first, some caveats:
I won’t mention scripting languages throughout this article for obvious reasons.
Moreover, I’m leaving Java out of this section because
it has some weirdness surrounding integers
(`int` vs `Integer` and no distinct unsigned types).

We’ll start with a classic systems programming language, C.
In addition to the traditional C integer types
`int`, `char`, `short`, `long`, `long long`, etc,
C99 added fixed size types with names like `int8_t`, `uint64_t`, and so on.
On modern 64-bit platforms `int` is always signed and 32 bits wide.
Additionally, C has a confusing array of machine-dependent types
such as `ptrdiff_t` and `size_t`.
In general, subscripts and sizes are of type `size_t`,
but C’s implicit conversions mean
you’ll often see `int` or something else used instead.
When signed integers overflow in C, they invoke _undefined behavior,_
meaning the compiler assumes the overflow never occurs.
Overflow for unsigned integers, on the other hand, is defined to wrap.

Next up, C#, which I’d characterize as
a typical “application programming” language
that’s used when low level control isn’t necessary.
C#’s types are named similarly to C’s: `int`, `short`, `long` and `byte`.
`int` is 32 bits wide.
Unsigned versions are obtained by prefixing the type with `u`.
Subscripts and sizes use a plain `int`,
and by default integers wrap on overflow.

Go is a contemporary alternative to languages in the same domain as C#.
Here we see the beginning of a trend:
rather than using unintuitive C-style integer type names,
Go just appends the bitwidth of each type: `int8`, `uint64`, etc.
Another interesting difference crops up in the size of `int` and `uint`:
they match the size of an address on the target platform,
rather than being hardcoded to a particular width.
Again, sizes and subscripts use `int`.
Go defines integer overflow to wrap.

Swift is yet another recent language in this
“compiled statically-typed non-low-level commercial software” niche,
and its integer types are similar to Go in several ways.
Type names are identical to Go except for capitalization: `Int8`, `UInt64`, etc.
`Int` and `UInt` have the same sizing behavior as Go,
and subscripts & sizes both use `Int`.
Curiously, Swift defaults to panicking on integer overflow,
even in release builds.

## Rust: a better approach

Did you notice a commonality in all the examples I listed above?
All those languages have some kind of default `int` type.
They require extra typing to use unsigned types instead of signed ones
and explicitly-sized types instead of the default-sized `int`.
I’d say this encourages the use of `int` over other types.
After all: would you rather stare at a screenful of `int`s or `uint32_t`s?
This goes beyond aesthetics, too.
It’s so easy to take the lazy way out and type `int` without thinking,
rather than scrutinize the use-case to identify the best type for the job.

Rust eliminates each of these points:
all integer types have an explicit size,
and all types are prefixed with
either `i` or `u` for signed and unsigned respectively.
There’s no bias towards a certain size or signedness.
You’re forced to consider the circumstances and make a judgement on
what type is most appropriate to the situation.
Maybe memory is conserved as integers are narrowed,
and bugs are prevented as
-- to invoke a dogma oft-cited by the Rust community --
invalid values (negative numbers) become unrepresentable.

| name    | signed? |  size in bits |
| :------ | :-----: | ------------: |
| `u8`    |   no    |             8 |
| `u16`   |   no    |            16 |
| `u32`   |   no    |            32 |
| `u64`   |   no    |            64 |
| `usize` |   no    | address-sized |
| `i8`    |   yes   |             8 |
| `i16`   |   yes   |            16 |
| `i32`   |   yes   |            32 |
| `i64`   |   yes   |            64 |
| `isize` |   yes   | address-sized |

One thing you might notice about this table
is the presence of `usize` and `isize`.
`usize` is used for subscripts and sizes, just like `size_t` in C.
Contrary to C, Rust doesn’t have implicit integer casting,
so you really do _have_ to use `usize` for your array indexes
(unless you want to drown in `as`-casts).
Using `usize` rather than a 32-bit `int`
means arrays can have more than two billion elements,
and using an unsigned type means negative array indexes can never occur.

Rust panics on overflow in debug builds to catch bugs,
but uses wrapping in release builds for performance.
Note the lack of UB on overflow.

There is a caveat to what I said about
Rust not being biased to a particular integer type:

```rust
fn demo() {
	let x = 1; // x: i32
}
```

Rust defaults to `i32`
when it has no type information for an integer literal,
so there is an (albeit minor) bias to signed 32-bit integers.
In my experience of Rust, though, I found I used signed integers so rarely
that I’d almost advocate for making unsigned integers the default.
If Rust didn’t put unsigned and signed integers on equal footing
I’d likely have never reached this conclusion.

To me, all of these changes seem like obvious improvements.

## A Rust programmer tries other languages

When I started experimenting with C#, Swift and Go
I quickly became frustrated.
With my attitude of picking the right integer type for the task,
I attempted to use `uint` for array indexes everywhere
instead of the signed `int` these languages default to.
It was impractical due to the amount of casting required,
so I gave up in frustration.
This just made me more certain:
why can’t every language have integer types like Rust?

## Why does C make signed integer overflow UB, anyway?

Originally the reason was differences in hardware behavior,
but today the argument you’ll hear most often is performance.
But don’t [most][Mill] CPUs perform wrapping
when an arithmetic operation overflows, anyway?
Why not just define overflow to wrap
(at no extra cost, since it comes with the CPU “for free”)
and be done with it?

I watched a [talk by Chandler Carruth][talk] on the topic of UB,
in which he includes an enlightening example.
(We’ll assume we’re running on
an architecture with 64-bit addresses.[^address sizes])

[^address sizes]: I am aware that most “64-bit” CPUs actually have
48- or 52-bit addresses. Let’s just go with “64-bit addresses” for simplicity.

```c
bool mainGtU(int32_t i1, int32_t i2, uint8_t *block)
{
	uint8_t c1, c2;

	c1 = block[i1]; c2 = block[i2];
	if (c1 != c2) return c1 > c2;
	i1++; i2++;

	c1 = block[i1]; c2 = block[i2];
	if (c1 != c2) return c1 > c2;
	i1++; i2++;

	// repeats several more times
}
```

The compiler is smart enough to eliminate the mutation of `i1` and `i2`.
Bytes are loaded directly from `block + i1` and `block + i2`,
then `block + i1 + 1` and `block + i2 + 1`,
then `block + i1 + 2` and `block + i2 + 2`,
and so on.
These address calculations are done as part of the load instruction itself,
so they occur within the space of a 64-bit integer.

Say we had forced the compiler to wrap on overflow.
`i1++;` and `i2++;` will wrap when they reach the limit of a 32-bit integer.
To ensure the runtime behavior is faithful to this wrapping,
the compiler generates extra instructions which make
`block + i1 + n` wrap back around to `block + 0`
when `i1 + n` overflows 32 bits.
In other words, “the CPU does wrapping on overflow for free”
doesn’t hold in this case,
and we get bloated code as a result.

None of this is hypothetical; making `i1` and `i2` unsigned
causes these extra instructions to be emitted, too.
In his talk, Chandler uses this code as an example of how
switching from unsigned to signed integers can improve performance
because it lets the compiler exploit UB on overflow.
[He goes as far to say][talk quote] that

> if you have an integer which you want to treat arithmetically
> as opposed to in some modular space (on some power of two),
> Make. It. Signed.
> If you need more bits, get more bits.
> Keep it signed.

This was fascinating to me.
Aren’t you supposed to use the type system to prevent bugs?
If a number can never be negative, why would you ever make it signed?
Chandler’s perspective on this issue made me uncomfortable.

## A foray further into C

As I immersed myself in systems programming using C,
I came across several people who kept saying that
signed integers should be used for indexes,
even though they can’t be negative.
In particular, I read [three][u-config] [different][compiler flags] [posts][MSI]
on [Chris Wellons’s blog][null program]
which all support this view:

> In recent years I’ve been convinced that unsigned sizes were a serious error,
> probably even one of the great early computing mistakes,
> and that [sizes and subscripts should be signed][Stroustrop].
> Not only that, pkg-config has no business dealing with gigantic objects!
> We’re talking about short strings and tiny files.
> If it ends up with a large object, then there’s a defect somewhere
> — either in itself or the system — and it should abort.
> Therefore sizes and subscripts are a natural `int`!

See that link in the quoted paragraph?
It links to a short document written by none other than Bjarne Stroustrop,
who also says that _sizes and subscripts should be signed._
With a skeptical attitude and my Rust-based preconceptions
I didn’t find his arguments very convincing.
Still, there was a niggling feeling in the back of my mind
that all these people must have a point.

## Looking at some C alternatives

[Odin] is one of a fray of up-and-coming C alternatives
which focuses on simplicity and “the joy of programming”.
After some failed experimentation with another C alternative, [Zig],
I decided to take a closer look at Odin.

Once again, the familiar “modern language” integer system appears,
with a few twists oriented towards low-level programming:

- `int` and `uint` are address-sized
- `i8` through to `i128` are signed
- `u8` through to `u128` are unsigned
- explicitly-sized types can be suffixed with either `le` or `be`
  to make their in-memory representation little-endian or big-endian
- sizes and subscripts use `int`
- wrap on overflow

This time, I decided to have an open mind
and take a closer look at what benefits this setup might have.
Some of the arguments below aren’t mine,
but I can’t remember which ones I picked up from where
and which ones are my own.

## Address-sized is the perfect default size

As we saw earlier,
mixing pointers and 32-bit integers can lead to performance problems
if we aren’t willing to make overflow UB.
Had we made `i1` and `i2` be of type `ptrdiff_t` or something similar,
then wrapping on overflow would’ve worked just fine.
Moreover, ISAs such as A64 only have 32- and 64-bit arithmetic instructions,
so operating on 8- and 16-bit integers requires an extra `and` instruction.
Performing all arithmetic on address-sized integers
is generally the best option.

One counterargument to this is that modern CPUs are usually memory-bound,
so packing data structures to be as small as possible is a good idea.
Making integers address-sized rather than defaulting to, say, 32 bits,
goes against this goal.
Regardless, I’d say the simplicity of being able to use a plain `int`
for array indexes, sizes, arithmetic, and as a default integer type
outweigh the cost of having to remember to use `int32` where appropriate.

## In release builds, wrapping on overflow is a fine tradeoff

Making overflow undefined behavior has no benefit[^overflow checks]
if all integers being operated on are address-sized.
I’d rather have a couple casts at the top of a function
than more [UB time bombs][regehr] waiting to explode.

Given the [roughly 30% overhead][regehr] of overflow checks,
I think restricting them to debug builds is a reasonable tradeoff.
I can also see an argument for using wrap on overflow even in debug builds
for consistency and simplicity.

[^overflow checks]: Overflow checks are an exception.
Making overflow UB means the compiler can eliminate overflow checks,
potentially improving performance.
However, I’d argue that this is yet another case of
[C prioritizing performance over correctness][rsc],
and that those checks shouldn’t be removed in the first place.

## Unsigned integers are unintuitive

Let’s say you want to loop from a number down to zero.
It’s trivial with signed integers:

```c
void demo(int32_t top)
{
	for (int32_t i = top; i >= 0; i--) {
		printf("%d\n", i);
	}
}
```

As you’d expect, running `demo(3)` prints

```
3
2
1
0
```

`i` and `top` are never negative here, though,
so surely unsigned integers are better in these circumstances?

```c
void demo(uint32_t top)
{
	for (uint32_t i = top; i >= 0; i--) {
		printf("%u\n", i);
	}
}
```

This is an endless loop.
For an unsigned integer `n`, `n >= 0` is always true.
Since unsigned integers wrap on overflow,
when `i` reaches zero we decrement it and reach 4,294,967,295.
To fix this we can change the condition to `i <= top`:

```c
void demo(uint32_t top)
{
	for (uint32_t i = top; i <= top; i--) {
		printf("%u\n", i);
	}
}
```

Once `i` has wrapped around, it will be greater than `top`
and as such break out of the loop.
Just awful.

## Won’t signed integers make bounds checks slower?

Performing a bounds check when using signed indexes
requires checking both `0 <= i` and `i < count`.
These two checks are independent from one another,
and so a contemporary CPU can run them in parallel.
Rarely are all the ALUs of a CPU saturated,
so removing the first of these checks likely won’t change
how long the bounds check takes to execute.

## Unsigned integers are more bug-prone

Suppose we have two array indexes, `i` and `j`.
Suppose also that the overhead of panicking on overflow
is unacceptable for our use-case,
so we’re wrapping on overflow.
We wish to find how many elements lie between `i` and `j`,
and want to copy them to a new array.
Simple, right?
`j - i` is all that’s needed to determine the number of elements,
and then we can create a new array of that size and perform the copy.

Imagine that `j` is always greater than or equal to `i` in our test data,
but somehow ends up less than `i` in production.
If `i` and `j` are unsigned,
`j - i` will wrap around to what is probably a very large number.
We end up creating an array of that very large size;
if we’re lucky the copy has bounds checks and causes a panic.

The point is that an unsigned underflow is hard to catch:
there’s no way to tell whether a large number was erroneously caused by wrapping
or if its presence is intentional.
Using signed integers here means the invalid `j - i` subtraction
produces a “poisoned” (negative) result immediately.
This result can be caught straight away when it’s used to create an array,
rather than later on through the unpredictable flow-on effects of huge numbers.

## Won’t signed integers require more asserts?

It is true that to have caught that negative array size
our array allocation code would’ve needed an `assert(count > 0)`.
However, to have caught it if we had been using unsigned integers
requires much more than just an `assert` --
we’d need to enable comprehensive overflow checking for the entire program.

You can view the asserts you need to add when using signed integers
as a lightweight form of overflow checking.
Rather than testing for overflow after _every single_ arithmetic operation,
we can just put an equivalent check at the top of every function.
In other words, a large number of overflow checks
have been coalesced into a single check at an API boundary.

Now, of course a single `assert(count > 0)`
isn’t equivalent to thoroughly checking for overflows everywhere.
For instance, it wouldn’t catch something like `create_array(1000 + j - i)`.
There’s a tradeoff between performance and safety here,
and I’d say that signed integers
with liberal usage of asserts and wrapping on overflow
is a happy middle-ground.

## Don’t signed integers have a lower maximum value, so you’ll need to use more bits?

I’d disagree with this.
Given we’re on a 64-bit platform,
being limited to 63 bits’ worth of elements in an array really doesn’t matter,
and if anything is probably a good thing.
For instance, Rust [limits the size of all allocations][Rust std]
to the maximum of a signed address-sized integer
so APIs like `ptr::offset(isize)` can function.

For smaller bit-widths,
like if we’re using 32-bit indexes into an array for compactness,
losing one bit won’t make much of a difference anyway.
I don’t know of any applications where
a maximum of two billion elements isn’t sufficient, but four billion is.

[Mill]: https://millcomputing.com/topic/introduction-to-the-mill-cpu-programming-model-2/
[talk]: https://youtu.be/yG1OZ69H_-o
[talk quote]: https://youtu.be/yG1OZ69H_-o?t=2965
[u-config]: https://nullprogram.com/blog/2023/01/18/
[compiler flags]: https://nullprogram.com/blog/2023/04/29/
[MSI]: https://nullprogram.com/blog/2022/08/08/
[null program]: https://nullprogram.com
[Stroustrop]: https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1428r0.pdf
[Odin]: https://odin-lang.org
[Zig]: https://ziglang.org
[Rust std]: https://doc.rust-lang.org/std/primitive.pointer.html#method.offset
[rsc]: https://research.swtch.com/ub
[regehr]: https://users.cs.utah.edu/~regehr/papers/overflow12.pdf
