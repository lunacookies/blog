---
title: "Dynamic Arrays with Data-Oriented Design"
date: "2023-02-16"
---

I would say that dynamic arrays are
the most common container type.
When programming in a data-oriented style
where all allocations are done ahead of time,
dynamic arrays manifested as an explicit type
like C++’s `std::vector` or Rust’s `Vec<T>`
often aren’t even necessary.

In many cases,
data-oriented design advocates the use of
numerous large flat arrays of scalar values.
A lot of code ends up consisting of
logic to process items one by one,
shoving them into those arrays
along the way.

## The standard approach

Let’s assume we are using
a typical general-purpose memory allocator.
We have three dynamic arrays
which use a doubling growth strategy.
The first is filled with `a`s,
the second with `b`s
and the third with `c`s.
If we are in a loop
appending to these dynamic arrays
again and again,
over time our memory would look
something like this:

```
capacity of
 a   b   c   memory
=== === === ==================================
 1   1   1   abc.............................
 2   1   1   .bcaa...........................
 2   2   1   bbcaa...........................
 2   2   2   bb.aacc.........................
 4   2   2   bb...ccaaaa.....................
 4   4   2   bbbb.ccaaaa.....................
 4   4   4   bbbb...aaaacccc.................
 8   4   4   bbbb.......ccccaaaaaaaa.........
 8   8   4   bbbbbbbb...ccccaaaaaaaa.........
 8   8   8   bbbbbbbb.......aaaaaaaacccccccc.
```

Notice how we keep having to
copy the arrays around in memory;
this is bad for performance.
Also, note how we don’t use
our available memory perfectly:
holes start to build up over time,
echoes of where things used to be.
Keeping track of which chunks of memory
are used and which ones aren’t
takes memory in and of itself too,
not to mention the performance cost
of having to search for
a gap big enough for
whatever we’re currently allocating.

## A simpler, more efficient approach

All this goes away if we statically allocate everything:
let’s choose a reasonable upper limit
to how many items we can have,
and allocate enough space for that many.

Let’s say 9 is our limit:

```
capacity of
 a   b   c   memory
=== === === ==================================
 9   9   9   aaaaaaaaabbbbbbbbbccccccccc.....
```

We go through each of our elements,
putting them in the reserved space.
Let’s say we end up using only 5 slots
out of the available 9:

```
capacity of
 a   b   c   memory
=== === === ==================================
 9   9   9   aaaaaaaaabbbbbbbbbccccccccc.....
             ^^^^^    ^^^^^    ^^^^^
```

We’re wasting a lot of memory here,
more than forty percent!

When programming in a style
where everything is statically allocated,
it’s common to have two memory blocks:
one is permanent memory
(where we keep things we need to look at
later in the program’s runtime),
and the other is temporary memory
(where we keep things momentarily
during processing).

Let’s actually use temporary memory
to store these maximum-size arrays:

```
 temporary memory
==================================
 aaaaaaaaabbbbbbbbbccccccccc.....
 ^^^^^    ^^^^^    ^^^^^

 permanent memory
==================================
 ................................
```

We can now,
using just three `memcpy`s,
copy the used portion into permanent memory.
Let’s also reset the temporary memory,
since we don’t need it anymore.

```
 temporary memory
==================================
 ................................

 permanent memory
==================================
 aaaaabbbbbccccc.................
 ^^^^^^^^^^^^^^^
```

100% utilization!

In the typical grow-as-you-go approach,
getting to the point where we can hold
five items in each array
would’ve taken nine `memcpy` calls,
resulting in the following memory layout:

```
 memory
==================================
 bbbbbbbb.......aaaaaaaacccccccc.
 ^^^^^          ^^^^^   ^^^^^
```

Of course, Rust’s `Vec<T>` for instance
has a method called `shrink_to_fit`
which, as the name suggests,
will resize the backing allocation
so there’s no spare capacity.
Calling that on each of the three arrays
would result in this layout:

```
capacity of
 a   b   c   memory
=== === === ==================================
 8   8   8   bbbbbbbb.......aaaaaaaacccccccc.
             ^^^^^          ^^^^^   ^^^^^
 5   8   8   bbbbbbbbaaaaa..........cccccccc.
             ^^^^^   ^^^^^          ^^^^^
 5   5   8   bbbbb...aaaaa..........cccccccc.
             ^^^^^   ^^^^^          ^^^^^
 5   5   5   bbbbb...aaaaaccccc..............
             ^^^^^   ^^^^^^^^^^
```

## Memory fragmentation

Having these gaps in our address space
isn’t bad only because it means
that memory is less likely to be used at all.
If, later, we allocate something that needs
three or fewer dots’ worth of space,
then it’ll go into that gap
between the `b`s and the `a`s.

```
 memory
==================================
 bbbbbxx.aaaaaccccc..............
 ^^^^^^^ ^^^^^^^^^^
```

There’s a good chance that
everything else being allocated during that time
is further along in the address space
where there’s more free space
for larger allocations.

```
 memory
=================== a big gap ========
 bbbbbxx.aaaaaccccc           yyyyyyy
 ^^^^^^^ ^^^^^^^^^^           ^^^^^^^
```

Things that are allocated together
are likely to later be accessed together
[citation needed].
By having the `x`s separated from the `y`s
by such a long distance in memory
-- even though they were allocated at the same time! --
we’ve worsened cache locality,
which could cause cache misses
and degrade performance.

If, on the other hand,
we had used the preallocated approach ...

```
 permanent memory
================ a big gap  ==========
 aaaaabbbbbccccc            xxyyyyyyy
 ^^^^^^^^^^^^^^^            ^^^^^^^^^
```

... then everything is packed optimally
for memory usage and performance.

## Okay, but why don’t I need a dynamic array type?

A nice way to implement
the strategy I’ve just described
is to use a bump allocator.
Let’s see a basic implementation of one in C:

```c
#include <assert.h>
#include <stddef.h>

typedef struct bump {
	char *ptr;
	size_t remaining;
} bump;

void *bump_allocate(bump *b, size_t size)
{
	// die if we run out of space
	assert(b->remaining >= size);

	void *p = b->ptr;
	b->ptr += size;
	b->remaining -= size;
	return p;
}
```

We can just use bump allocators
instead of a dynamic array type,
since there’s no growing involved anymore.
Let’s first create bump allocators
for the `a`s, `b`s, and `c`s:

```c
typedef struct a { /* ... */ } a;
typedef struct b { /* ... */ } b;
typedef struct c { /* ... */ } c;

#define MAX_CAPACITY 9

bump bump_create_sub_allocator(bump *b, size_t size)
{
	void *buf = bump_allocate(b, size);
	return (bump){
		.ptr = buf,
		.remaining = size,
	};
}

void do_thing(
	bump *temp_memory,
	bump *permanent_memory)
{
	bump as = bump_create_sub_allocator(temp_memory, sizeof(a) * MAX_CAPACITY);
	bump bs = bump_create_sub_allocator(temp_memory, sizeof(b) * MAX_CAPACITY);
	bump cs = bump_create_sub_allocator(temp_memory, sizeof(c) * MAX_CAPACITY);
}
```

And this is how we fill our bump allocators up with data:

```c
void do_thing(
	bump *temp_memory,
	bump *permanent_memory)
{
	bump as = bump_create_sub_allocator(temp_memory, sizeof(a) * MAX_CAPACITY);
	bump bs = bump_create_sub_allocator(temp_memory, sizeof(b) * MAX_CAPACITY);
	bump cs = bump_create_sub_allocator(temp_memory, sizeof(c) * MAX_CAPACITY);

	// in Rust we would do
	as.push(my_a);

	// but in this style we do
	a *a_ptr = bump_allocate(&as, sizeof(a));
	*a_ptr = my_a;
}
```

And voilà!
With this approach we have
near-instant allocation,
lower memory usage,
better cache locality
and fewer `memcpy` calls,
all without the need for
generics or binary-bloating monomorphization.
