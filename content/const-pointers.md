---
title: "Const Pointers"
date: "2024-02-12"
---

I’ve noticed a pattern which keeps coming up over and over again
throughout the field of software engineering: mutable state is hard.
More specifically, _shared_ mutable state is hard.

Think about this for a bit and you’ll come to a foundational realization:
it’s easy to maintain invariants locally, but hard to maintain them globally.
For example, if several copies of some duplicated code need to be kept in sync
but those copies all reside in the same function, then the task is trivial.
If those copies are spread across separate repositories, though,
then making sure they remain synchronized with one another
suddenly isn’t so easy anymore.

As a result of this idea you might determine that
programming languages should provide tools
to restrict mutability globally across a program,
and shouldn’t worry so much about local mutability.
Let’s look at an example of each.

## A positive example: const pointers

Many languages have two types of pointer:
pointers which allow anyone with access to the pointer
to mutate the data it points to,
and pointers which disallow this.
Throughout this article I’ll refer to the first kind as _mutable pointers_
and to the second as _const pointers_ for brevity.
Const pointers fit nicely with my realization from earlier:
they provide a property (immutability)
which holds globally (across all code which has access to the pointer),
rather than locally (within a single statement, function or package).
They give us the guarantee that merely letting some code look at some data
won’t grant that code permission to change it willy-nilly.

As we’ll see later, though, I’m not entirely sure if they’re a good idea,
as appealing as they might be on a conceptual level.

## A negative example: immutable local variables

On the other hand, immutable local variables
-- which are very much in fashion these days --
are of questionable utility.
The invariant of not mutating a given bit of data
is enforced over such a small area (a single function!)
that it’s trivial to verify manually.
Switching between `var` and `const` while refactoring is annoying busywork,
reading `let mut x = 10` or `let x = 10` over and over
is noisier than simply `x := 10`,
and besides, I can’t think of a single time
when immutable locals saved me from a bug.
Philosophically, at the very least, I don’t think they’re worth the trouble.

However, I’ve heard some people say they appreciate being able to
check at a glance that a local isn’t mutated further down in a huge function
without having to read the whole thing in detail.
My immediate reaction, of course, is to say that in this case
you should probably refactor the function to be shorter instead.
Snarkiness aside, I’m unsure about this argument, actually:
[everyone seems to think][matklad] that immutable locals are a Good Thing,
and I have to admit that I did get this nice “safety” feeling
each time I looked at `let` when I was writing some Rust again
after months of only C.
Maybe having a language enforce an invariant
over even the tiny area of a single function
is worth doing after all.

[matklad]: https://matklad.github.io/2020/02/14/why-rust-is-loved.html#It-s-All-the-Small-Things

## Const pointers are bad because they don’t prevent bugs

Over the last little while I’ve explored Odin and the Handmade community,
which consists mainly of hardcore C programmer types.
A common refrain I’ve heard is that
const pointers don’t actually solve problems real people have.
Instead, I’ve seen it argued that const pointers are a product of
programmers who try to come up with a theoretically “perfect” solution
that is 100% locked down and watertight, even when that isn’t really necessary.
Safety to one side, optimizing on the basis of const pointers isn’t allowed by C
(and would be an insane thing to do anyway),
so they don’t provide a performance benefit either.
Chris Wellons, for example, [makes a similar argument][nullprogram] on his blog:

> No `const`.
> It serves no practical role in optimization,
> and **I cannot recall an instance where it caught,
> or would have caught, a mistake**.
> I held out for awhile as prototype documentation,
> but on reflection I found that good parameter names were sufficient.
> Dropping `const` has made me noticeably more productive
> by reducing cognitive load and eliminating visual clutter.
> I now believe its inclusion in C was a costly mistake.

[nullprogram]: https://nullprogram.com/blog/2023/10/08/#parameters-and-functions

I’m not totally sure about this argument, but I do have a simple counter-example
of a mistake that const pointers prevent:
mixing up the `src` and `dst` arguments to `memcpy`.
If const pointers are used pervasively throughout a codebase,
chances are that a simple swap of those two arguments
would be caught by the compiler rather than overwriting important data.[^labels]

[^labels]:
    A mitigation to this particular mistake that doesn’t involve const pointers
    is the use of Smalltalk/Objective-C/Swift-like mandatory argument labels,
    where a call like

    ```c
    memcpy(dst, src, n)
    ```

    would instead look something like

    ```swift
    copyMemory(from: src, to: dst, byteCount: n)
    ```

    The important aspect to note here is that the argument labels
    are actually part of the function name and spell out a complete sentence,
    rather than optional extras you might decide to
    chuck in front of your arguments for clarity.
    In this case the function is named `copyMemory(from:to:byteCount:)`,
    not `copyMemory`.
    As a corollary, there can be multiple functions
    where the part before the opening parenthesis is `copyMemory` --
    for example, there could exist a function called
    `copyMemory(from:to:byteCount:stride:)`.
    This is not considered overloading,
    as the functions really do have different names.

    In my opinion this is a frequently overlooked language feature
    which deserves more attention,
    especially in an age of code being read on GitHub and sites like it
    which lack inlay hints, hover documentation and other IDE features.

## Const pointers are bad because they introduce pointer coloring

Let’s put all those points from the Handmade crowd to one side, for now.
In my estimation, the most important problem with const pointers
is their introduction of another [“colored function”] into the language.
There’s synchronous functions and asynchronous functions,
and async functions can be safely called from sync functions
but not vice versa;
there’s const pointers and mutable pointers,
and mutable pointers can be safely passed where const pointers are expected
but not vice versa.
In the same way as asynchronicity & fallibility,
mutation is an effect which fundamentally divides a language.
For instance, imagine an API like

[“colored function”]: https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/

```rust
fn find(buf: *const u8, b: u8, n: usize) -> *const u8;
```

`find` returns a pointer to the first byte in `buf` which is equal to `b`,
up to `n` bytes into `buf`.
(Let’s ignore the possibility of not finding a match for simplicity.)
Calling `find` with a const pointer works fine, as with a mutable pointer.
However, imagine we want to mutate the byte pointed to by `find`’s return value:

```rust
fn replace_first(buf: *mut u8, old: u8, new: u8, n: usize) {
	// `buf` is automatically converted to `*const u8`
	let byte_to_replace: *const u8 = find(buf, old, n);

	// error: cannot write to const pointer
	*byte_to_replace = new;
}
```

Our problem is solved if we change `find` to take and return mutable pointers:

```rust
fn find(buf: *mut u8, b: u8, n: usize) -> *mut u8;

fn replace_first(buf: *mut u8, old: u8, new: u8, n: usize) {
	let byte_to_replace: *mut u8 = find(buf, old, n);
	*byte_to_replace = new;
}
```

But then situations where we don’t have a mutable pointer to pass in won’t work
unless we start casting everywhere,
defeating the point of const pointers in the first place ...

Let’s revert back to the original `find` function.
Since in this case we have the original mutable pointer
the const pointer returned by `find` was derived from,
we can use pointer arithmetic to calculate an index into `buf`.
Then, we modify the buffer at that index:

```rust
fn replace_first(buf: *mut u8, old: u8, new: u8, n: usize) {
	let byte_to_replace: *const u8 = find(buf, old, n);
	let i = byte_to_replace - buf;
	buf[i] = new;
}
```

Or, again, we could just cast `find`’s return value and use it directly:

```rust
fn replace_first(buf: *mut u8, old: u8, new: u8, n: usize) {
	let byte_to_replace: *mut u8 = find(buf, old, n).cast_mut();
	*byte_to_replace = new;
}
```

At least in my experience using Rust,
in these sorts of situations library authors tend to
provide a function for both cases:

```rust
fn find(buf: *const u8, b: u8, n: usize) -> *const u8;
fn find_mut(buf: *mut u8, b: u8, n: usize) -> *mut u8;

fn replace_first(buf: *mut u8, old: u8, new: u8, n: usize) {
	*find_mut(buf, old, n) = new;
}
```

Though this makes the calling code looks the nicest
no matter whether it uses mutable or const pointers,
personally I just cannot stand the sort of wide-scale duplication
that const pointers invite.
(Well, either that, or you’ll have tons of const-removing casts everywhere.)

An obvious answer to this kind of mechanical code duplication
is to add a language feature which does the duplication for you.
In other words: what if we could be generic over mutability?

```rust
// note that this is just imaginary syntax!
fn find<M: mut>(buf: *M u8, b: u8, n: usize) -> *M u8;
```

To my eyes, this is like
taking a look at a problem created by adding language features
and then thinking “oh I know, what we need is more language features!”
Something about it doesn’t sit right with me.
Instead of piling on more complexity,
maybe we can leave the idea of const pointers behind
and rethink things from the ground up instead?

## Rethinking from first principles

We’ve seen some arguments for and against const pointers,
but none of them bring us to an obvious “for” or “against” position.
Let’s take a step back for a moment --
what problem are const pointers actually trying to solve?
Well, I guess we have some data which some code has generated,
and we want to prevent other code from mistakenly mutating that data.
As is often the case, we can solve the problem with a data-oriented approach,
thinking back to the hardware and how our data is organized.

## An alternative suited to truly immutable data

If the data we’re trying to protect
really is never supposed to change after it’s been created,
then we can take advantage of
a feature of the hardware we’re writing our code for:
the CPU’s memory management unit, or MMU,
lets us specify the _protection_ for our memory.
You can think of memory protection like Unix file permissions,
but with three bits instead of three bytes:
a bit for the ability to read from memory (`PROT_READ`),
a bit for the ability to write to memory (`PROT_WRITE`),
and a bit the ability to execute code stored in memory (`PROT_EXEC`).
The API to set the protection for a region of memory on Unix is simple:

```c
int mprotect(void *addr, size_t len, int prot);
```

We pass the address and length of the data we want to protect,
along with the protection we want to use as a bitflags integer.
Unfortunately, memory protection doesn’t operate on individual bytes.
Rather, it works at the granularity of a _page._
On most systems pages are chunks which are 4 KiB in size,
while Apple Silicon uses 16 KiB pages.

As a result, we must consider our data and how it’s laid out in memory
in order to make use of memory protection.
First, our job is much easier if the immutable data is contiguous,
so a single `mprotect(2)` call is all that’s necessary to protect it.
This has the nice side-effect that repeated accesses to this data
will all occur in the same region of address space,
meaning these accesses are more likely to hit the CPU cache
and more likely to be prefetched.

Second, we have to make sure there’s
nothing other than the data we want to protect
in the region of pages occupied by it;
otherwise we might accidentally restrict access to
some data we need to modify later on!
This point nudges us towards an interesting perspective
on the construction of software:
taking the idea of storing unrelated data in separate pages
to its logical conclusion,
we might organize the data in our program holistically,
grouping it roughly by category and storing these in continuous runs of pages.
Now, the memory for each group of data can be allocated with one call to `mmap(2)`,
opening up the possibility of saving or restoring the data from a file
with no serialization overhead.
Structuring a program this way also
makes it easier to use arena and pool allocators,
which both have their own set of advantages.

A nice benefit this approach has over const pointers
is that it’s impossible to circumvent without an explicit call to `mprotect(2)`.
I’d say it’s much harder to accidentally make a syscall
than accidentally cast a `*const T` to `*mut T`,
especially if this const pointer was cast indirectly
through the casting of a larger struct it was contained within,
or something like that.

The big downside of the `mprotect(2)` approach
is the result of removing const pointers:
if we don’t check the mutability of pointers at compile-time,
yes, we don’t have to worry about “pointer coloring” or anything,
but we have to live with the fact that
we’ve moved errors from compile-time to runtime.
You won’t know you accidentally tried to mutate some immutable data
until your program is killed by the OS while it’s running.

## An alternative suited to library boundaries

This approach is oriented towards cases where const pointers would be used
to isolate the internal data structures of a library from foreign code.
Say we have some library interface:

```c
// array.h
struct array;
void            array_push(struct array *a, uint64_t element);
uint64_t        array_at(struct array *a, ptrdiff_t index);
uint64_t        array_pop(struct array *a);
void            array_free(struct array *a);

// library.h
struct array   *order_ids_get(void);
```

Suppose that the array returned by `order_ids_get`
lives in some global data structure somewhere owned by the library.
By returning the array to the user,
the library has inadvertently given them the ability to mutate the array,
even though the array really “belongs” to the library.
They might even free the array accidentally
which could trigger a use-after-free within the library itself.
How can we solve this if we don’t want to use const pointers here
(which can be trivially circumvented through casting anyway)?

We can consider a pointer as “permission” to read and modify a region of memory.
Each time we hand out a pointer we check in with ourselves that
“yes, I’m okay with anyone who has this pointer
mutating the data it points to”.
Of course, we don’t want to give users
permission to modify our internal data structures,
so we should never give them pointers to our data.

How do we do that?
One approach is to, on every call,
copy the array into a new allocation and return that,
relying on the user to free the allocation.
This way we never actually give the library user access to our data,
only a copy which they can mutate harmlessly.
This solution is used by a lot of object-oriented code,
where every little thing is a tiny mutable allocation
which stores pointers to other tiny mutable allocations.
Unfortunately, this approach makes the CPU spend time copying data around
when we really only need a single copy.
It also means we incur the overhead of
extra memory allocations and deallocations,
as well as the potential for memory safety bugs that frequent allocations invite.

Or, how about something different:
what if we never give our users pointers at all?
Instead, we can return opaque [“handles”]
which the user can pass to our library to retrieve data.

[“handles”]: https://floooh.github.io/2018/06/17/handles-vs-pointers.html

```c
// array.h
struct array;
void            array_push(struct array *a, uint64_t element);
uint64_t        array_at(struct array *a, ptrdiff_t index);
uint64_t        array_pop(struct array *a);
void            array_free(struct array *a);

// library.h
struct order_ids {
	uint32_t handle;
};

struct order_ids        order_ids_get(void);
uint64_t                order_ids_at(struct order_ids orders, ptrdiff_t index);
```

We provide _just enough_ of an API for the user to retrieve individual order IDs,
and nothing else.
The user is totally isolated from the library’s internals.
What we end up with is a system that feels a bit like
some sort of remote key-value store thingy.
You can only ask the system to do things (gather a list of order IDs)
and get back a local version of the results
(the individual order IDs returned by `order_ids_at`) for yourself,
without ever being able to touch the data directly.

The big benefit of this handles-based approach over const pointers is once again
how it encourages us to structure our code.
Rather than writing a massive web of interconnected objects,
some of which don’t have permission to modify certain others,
we’re instead pushed towards creating database-like contiguous stores of data
which can only be accessed indirectly.
This gains us performance (contiguous accesses are faster),
reduces memory usage (we can use 32-bit handles instead of 64-bit pointers),
and improves security (out-of-bounds accesses are impossible
as long as we include a single bounds check in `order_ids_at`,
and memory management is centralized in the library
rather than entrusted to the user).

If we’re working with large amounts of data
instead of a small array of order IDs,
then this approach can get us some valuable flexibility.
Imagine the data is stored on disk in chunks in a compressed format.
When a particular piece of data is requested with `order_ids_at`,
we check if the corresponding chunk has already been loaded;
if not, we read it from disk, decompress it, verify its checksum,
and only then return the relevant data from the chunk to the user.
We could even keep track of which items are accessed most frequently
and adjust our datastore so those items all reside together in the same chunk.
I could go on, but I think that gets the idea across.

## Final thoughts

So: are const pointers useful?
I’m not sure.

On the one hand, they add a dreaded “coloring” to the language
which either bifurcates all APIs or results in even more language complexity.
They can always be sidestepped through casting,
so const pointers are in a way just fancy compiler-checked documentation
that doesn’t provide any firm guarantees or performance improvements.[^types]

[^types]:
    This sounds like something
    a dynamic typing enthusiast might say about static typing,
    but then the part about a lack of performance improvements would be wrong.

On the other hand,
the idea of getting a _global_ guarantee (casts notwithstanding)
that some data will not be mutated is conceptually very appealing.
I don’t know if this theoretical idea has any practical utility, though.

Finally, thinking about the problem from first principles
reveals some interesting approaches
that involve structuring code and data differently
to take advantage of the hardware we write programs for.
I don’t know if it’s actually feasible to
build a whole system around these ideas, though.
