---
title: "Systems Languages Should Support Zero Is Initialization"
date: "2023-09-22"
---

In the last few years, a barrage of new systems programming languages
have been released.
A common feature is language-level support for non-null pointers,
along with some kind of nullable pointer type.
This may be a dedicated type ([as in Hare][Hare nullable]),
or it may be a general-purpose “optional” or “maybe” type
which represents a non-present pointer as a null pointer
([as in Rust][Rust Option] and [Zig][Zig optional]).
It is no surprise that systems programming languages
have begun to incorporate these sorts of features;
the integration of ideas from functional programming into mainstream languages
has been ongoing for years at this point.

From what I’ve seen, these features are universally regarded as A Good Idea.
In this article I’d like to offer an alternative perspective,
drawing from the ideals of systems programming.

## Hardware & operating system features

Systems programming languages aim to let the programmer
take advantage of the hardware and operating system they are programming for.
One notable feature of today’s stack is that new memory mappings
(as created with `mmap` on \*nix and `VirtualAlloc` on Windows)
are always initialized to zero “for free”.
It is in the spirit of systems programming to study the platform’s features,
and to then write software that uses these characteristics to its advantage.
We should aim to write software that works in deep harmony with the platform,
rather than ignoring its traits in pursuit of ideological purity.

The OS will zero out pages whether software is designed to exploit this, or not.
Why not take advantage of it?

One way is to, as much as you can, design your data structures
so their state when all fields have been zeroed out is meaningful.
This could mean that the zero value is considered a default,
or perhaps indicates the absence of a value.

## ZII, or Zero Is Initialization

You can apply this concept every time you create an enum.
Suppose we have an enum that looks like this:

```c
enum file_state {
	FILE_STATE_OPEN,
	FILE_STATE_CLOSED,
	FILE_STATE_NO_FILE,
};
```

Imagine that we have a big array of file states
which we’re using as the backing array of a hash table.
Slots in the array which don’t have an associated file are `FILE_STATE_NO_FILE`.
We allocated the array using `mmap`, and thus it’s filled with zeroes.
Since at this point we haven’t inserted any files into the array,
every slot should be filled with `FILE_STATE_NO_FILE`.
Rather than going through the array and writing that value over and over,
it’d be much more efficient if we could just use the array as it is,
straight from the operating system.
With a small change to our enum ...

```c
enum file_state {
	FILE_STATE_NO_FILE,
	FILE_STATE_OPEN,
	FILE_STATE_CLOSED,
};
```

`FILE_STATE_NO_FILE` has value zero.
Now, the zero-filled array is ready to use with no further initialization.
In general, try to move the “default” variant of an enum to the top
so its value is zero.

Let’s see a more substantial example.

```c
struct arena {
	uint8_t *buf;
	size_t len, used;
};

enum { DEFAULT_ARENA_SIZE = 1024 * 1024 };

void
arena_init(struct arena *a)
{
	a->buf = calloc(DEFAULT_ARENA_SIZE, 1);
	a->len = DEFAULT_ARENA_SIZE;
	a->used = 0;
}

void *
arena_alloc(struct arena *a, size_t n)
{
	void *p = a->buf + a->used;
	a->used += n;
	assert(a->used <= a->len);
	return p;
}
```

Here we have a very basic arena allocator implementation.
Currently the user
is required to call `arena_init` before calling `arena_alloc`.
Rather than make them call into our initialization logic
(which from their perspective contains arbitrary behavior!),
we can instead require them to ensure the arena has been zeroed out
before it’s used.
Let’s change `arena_alloc` so it can work with a zero-initialized arena.

```c
struct arena {
	uint8_t *buf;
	size_t len, used;
};

enum { DEFAULT_ARENA_SIZE = 1024 * 1024 };

void *
arena_alloc(struct arena *a, size_t n)
{
	if (a->buf == NULL) {
		a->buf = calloc(DEFAULT_ARENA_SIZE, 1);
		a->len = DEFAULT_ARENA_SIZE;
	}

	void *p = a->buf + a->used;
	a->used += n;
	assert(a->used <= a->len);
	return p;
}
```

We don’t even need to initialize `used` or any other fields we add in future.
In effect, the user has already initialized those fields for us
-- or, ideally, they already had some zeroed memory lying around,
and so no time was spent on initialization at all!
This only works if you [initialize each field individually](/pass-by-pointer/)
instead of using a designated initializer.

## Making the zero value useful

This example is adapted from [a talk by Francesc Campoy][talk].
Suppose we have a binary tree:

```c
struct tree {
	int val;
	struct tree *left;
	struct tree *right;
};
```

And suppose we want a way to get the “sum” of a tree:

```c
int
tree_sum(struct tree *t)
{
	int sum = t->val;

	if (t->left != NULL) {
		sum += tree_sum(t->left);
	}

	if (t->right != NULL) {
		sum += tree_sum(t->right);
	}

	return sum;
}
```

Nice and simple.
However, it doesn’t work if we use a `NULL` tree:

```c
void
demo(void)
{
	struct tree *t = NULL;
	int sum = tree_sum(t); // null pointer dereference!
	printf("%d\n", sum);
}
```

Usually we consider null pointers a bug,
so it may seem a little odd that we want this to work at all.

Try thinking about it this way.
The `NULL` tree isn’t “a null pointer”;
rather, it represents the default value of a tree: an empty tree.
And what is the sum of an empty tree?
Zero!

```c
int
tree_sum(struct tree *t)
{
	if (t == NULL) {
		return 0;
	}

	return t->val + tree_sum(t->left) + tree_sum(t->right);
}
```

Now, calling `tree_sum` on an empty tree works,
and as a bonus `tree_sum`’s implementation is much shorter too.

## Discussion

Ultimately, there is value in having the compiler force you to check for null.
Unfortunately, optional types are incompatible with ZII;
using ZII would force you to make every pointer-containing value optional,
which is impractical.
In cases where efficiency is not a concern
(a less pragmatic version of myself might say that
efficiency should always be a concern),
go ahead, add option types to your language!
But for systems programming I argue that
it’s worth eating the (possible?) increase in bugs
out of deference to the platform.

GingerBill, the creator of the [Odin] language (which embraces ZII),
when asked about this topic [said][gingerBill] the following:

> Odin has pointers and pointers can be nil.
> I fundamentally disagree with the idea that it is a “million dollars mistake”
> especially since there are much more invalid memory addresses other than zero,
> and those are much more common.
> If you want to a have low-level capabilities in a language,
> you will have to deal with pointers.

Jon Blow, the creator of Jai, another new systems programming language,
has [apparently][jblow] said something similar:

> Jon's talked about before that he doesn't consider null a special value.
> There are more addresses than just null
> that will break your programs when working with low level languages,
> and checking for all of those values is basically impossible.

Though technically this isn’t wrong, it still grates on me.
_Yes,_ there are invalid pointers other than null,
but that doesn’t change that `0x0000000000000000`
is overwhelmingly the address most-often used for “special” purposes,
e.g. signalling the end of an array or the absence of a value.

## ZII and language design

How might you support ZII at a language level?
Go, Odin and Jai are three examples we can draw from.

Let’s start with the obvious:
all three languages default to zeroing out local variables
which don’t have initializers.
(I say “default to” since Jai lets you
specify the default value for a struct field,
so it technically isn’t 100% zero-initialization.)
This also applies to struct literals; unspecified fields are zero-initialized,
just as in C’s designated initializers.

Next is something a bit more subtle:
none of these languages have a concept of an illegal byte sequence for a type.
This is in contrast to, say, Rust, where types can have “invalid values”.
For example, [`bool` can only be either `0` or `1`][nomicon],
or here, where the only valid values for `Foo` are `10`, `20` and `30`:

```rust
#[repr(u8)]
enum Foo {
	Ten = 10,
	Twenty = 20,
	Thirty = 30,
}
```

Zero-initializing a `Foo` instance would be undefined behavior.
Go, Odin and Jai do not have such a feature at the language level.

Finally, Go and Odin take ZII even further
and make memory allocation default to zeroed memory.
I’m not familiar with Go’s implementation here,
but I can say that Odin doesn’t just take the “dumb” approach
and `memset(p, 0, n)` all new allocations.
Rather, Odin’s various allocators keep track of
which memory is fresh from the OS and which memory is being recycled,
explicitly zeroing out allocations only when necessary.
Odin makes this optional, so you don’t have to pay the cost of that zeroing
if ZII isn’t useful to you.

A curious point here is how zeroed allocations interact with huge allocations.
One common piece of advice for improving software performance
is to allocate memory in bulk.
[Taken to the extreme](/dynamic-arrays-with-dod/),
all data is stored in preallocated arrays and arenas
large enough to hold any reasonable input.
Zeroing new allocations conflicts with this:
the whole point of these preallocated arrays is that
only the used parts are ever allocated to your process
through [the magic of virtual memory][Our Machinery].
Accessing every array element just to set it to zero
means that the whole array will definitely be instantiated,
even if -- as intended -- only a small portion is ever used.
To overcome this, large “sparse” allocations should never be explicitly zeroed.
Instead, zero out individual elements when they’re accessed.

[Hare nullable]: https://harelang.org/tutorials/introduction/#pointer-types-in-depth
[Rust Option]: https://doc.rust-lang.org/std/option/index.html#representation
[Zig optional]: https://ziglang.org/documentation/master/#Optionals
[talk]: https://youtu.be/ynoY2xz-F8s
[Odin]: https://odin-lang.org
[gingerBill]: https://www.reddit.com/r/programming/comments/bvxvrv/introducing_the_odin_programming_language/epths6z/
[jblow]: https://www.reddit.com/r/Jai/comments/icnlcz/nonnull_pointers/g244jqk/
[nomicon]: https://doc.rust-lang.org/nomicon/transmutes.html
[Our Machinery]: https://web.archive.org/web/20211214180302/https://ourmachinery.com/post/virtual-memory-tricks/
