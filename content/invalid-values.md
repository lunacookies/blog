---
title: "Invalid Values"
date: "2024-07-31"
---

I was writing a reply to [a post on Ziggit][post]
and (as usual) got completely carried away,
so I decided to flesh it out a little more and post it here instead.

---

Over the last little while I’ve come to really appreciate Odin’s approach to strings.
I wasn’t convinced initially,
but I now think there’s a really solid argument to be made for having a string type
even in a low-level systems programming language like Zig.

Let me explain by making an analogy to enums.
In C, enum types are basically just integers.
For example, I can define two unrelated enums and apply division to them:

```c
#include <stdio.h>

enum foo { x = 10 };
enum bar { y = 5 };

int
main()
{
	unsigned int f = x;
	unsigned int b = y;
	printf("%d\n", f / b); // => 2
}
```

I could’ve declared `f` as `enum foo` and `b` as `enum bar`,
but those are effectively typedef’d to `unsigned int`.
There’s no coercion here, the types are equivalent.
The same goes for strings, which in C are just a pointer to the first byte.
The representation is exposed completely.

In Rust, on the other hand,
enum and string types are totally distinct from their representations.
Moreover, enums and strings have “invalid values” --
values that exist in the representation which the type doesn’t allow.
Invalid values can only be constructed through unsafe code.
For example, enums aren’t allowed to hold arbitrary integer values:

```rust
enum MyEnum { A, B, C }

fn main() {
	let n: u8 = 5;
	let e: MyEnum = unsafe { std::mem::transmute(n) }; // UB!
}
```

This would’ve been fine if I’d defined `n` as `0`, `1`, or `2`,
since those are the integer representations of `MyEnum`’s variants.
`5` is not the representation of any of these variants,
so the code above invokes UB.
Rust does the equivalent of this with strings, too:
using safe APIs you can only create strings containing valid UTF-8,
but you trigger UB if you poke around in memory
and end up placing invalid UTF-8 in a region of memory that backs a `&str`.

Zig diverges here in a weird way:
it takes the Rust “enforce invariants in the type system, broken invariants are UB” approach for enums,
but the C “expose the bare representation, there are no invariants” approach for strings.
Strings in Zig are just `[]const u8`,
which is philosophically the same as C’s `char *`.

With this context, what Odin does is quite interesting:
it combines the type safety of the Rust approach
with the UB safety of the C approach.
`string` is its own distinct type which is immutable,
but it can freely be cast to and from the mutable `[]u8`,
and is UTF-8 by convention only.
Enums are fully-fledged types instead of integers in a trench coat,
but they can also be cast freely to and from the backing integer type.
Notice how Odin supports the cases that Rust makes UB
while still creating distinct types for enums & strings.

## A practical motivation

Having separate types for strings and enums
even though they’re functionally the same as their representations
is useful beyond just type safety.
Things like generic debug-printing and serialization
want to differentiate between UTF-8 encoded strings and plain sequences of 8-bit integers,
or actual named enum values and random 32-bit integers.
Encoding in the type system how we want data to be interpreted
allows metaprogrammed code like this to adapt accordingly.

## Some philosophizing

Philosophically I disagree with the concept of invalid values
in languages that exist around the same level of abstraction as C and Zig.
The reality of the hardware is that everything is just a sequence of bytes.
With invalid values, though, we have to pretend that
memory is divided into objects that have types
which restrict what values the bytes contained in those objects can take on!
Surely the purpose of using a low-level language to begin with
is to write code that works _with_ the platform
instead of imposing its own concepts onto it?
The intrinsic representations of strings and enums are an immutable truth,
and it’s unwise to try to conceal them when you’re working in
a language where you do unsafe things with memory all the time anyway.
Instead, higher-level concepts should layer on top of lower-level representations cleanly,
rather than trying to encapsulate and hide them from view.
Abstractions leak quickly in this domain.

New opportunities to take advantage of the platform can arise
if our languages let us address memory as it truly is -- a sequence of bytes --
without concern for causing UB.
In my experience, [using zero initialization](/zii/)
instead of Zig’s concept of uninitialized memory
simplifies code
while letting me take advantage of modern MMUs and operating system kernels
which zero out new memory mappings anyway.

[post]: https://ziggit.dev/t/why-no-builtin-string-type/5326/4
