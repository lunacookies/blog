---
title: "Don’t Zero Out Memory By Default"
date: "2023-02-19"
description: "Instead, fill it with a sentinel value"
---

A common practice in
low-level languages such as C and C++
is to default to filling memory with zeroes.
For example, [this proposal][proposal]
suggests zeroing out stack variables by default.
Anonymous memory mappings created using `mmap(2)`
are filled with zeroes,
and so are allocations created with `calloc(3)`.
Missing fields in C’s designated initializers are
-- you guessed it --
null-initialized.
[Uninitialized variables]
and [missing struct literal fields]
default to zero in Odin.

## The problem

It’s easy to imagine
a scenario where
memory is zeroed out in one case,
but isn’t in another.

For instance,
the macOS and iOS system memory allocators
(`malloc(3)` and `free(3)`)
[zero out freed memory][mac];
let’s say you’re allocating
space for a null-terminated string,
and the memory allocator
decides to plonk you on top of
some previously-used but now-free memory.
After filling the string with data,
you forget to set the last byte to `'\0'`.
Your code still works, though,
since the memory allocator
made sure the last byte
was already set to zero.

When you try running your code
on another operating system,
the system memory allocator
may not be so kind.
Your string doesn’t have
a terminating null
added explicitly,
and there’s no telling what
the memory after your allocation
will contain.
There might not be
another zero byte in memory
for quite some time,
making your string appear
much longer than it actually is.
This could result in buffer overflows
and other vulnerabilities.

## The solution

In my opinion,
it’s far too easy to
accidentally rely on null-initialization.
A better alternative to
zeroing everything out
whenever you get the chance
is to instead fill it all
with some arbitrary value.
Take Zig’s support for
detecting uses of `undefined`:
rather than null-initializing,
Zig [fills uninitialized memory with `0xaa`][zig].
(I couldn’t find a source for
why this particular value was chosen.)
We get the same benefits of null-initialization:

- it’s impossible to rely on
  what happened to be in memory before
  by chance
- it’s impossible to accidentally leak
  the contents of old allocations

but without the risk of
relying on memory being all zeroes.

Of course, there is still the possibility
of relying on whichever sentinel value you choose --
though, to me, writing code which depends on
memory being filled with `0xaa` _in particular_
sounds quite unlikely.

[proposal]: https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p2723r1.html
[uninitialized variables]: https://odin-lang.org/docs/overview/#zero-values
[missing struct literal fields]: https://odin-lang.org/docs/overview/#struct-literals
[mac]: https://developer.apple.com/documentation/macos-release-notes/macos-13-release-notes#Memory-Allocation
[zig]: https://ziglang.org/documentation/0.10.1/#undefined
