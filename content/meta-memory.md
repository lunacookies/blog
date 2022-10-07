---
title: Meta Memory
description: An abstraction of memory on top of memory
date: 2022-08-08
---

Let’s take a tree structure

```rust
struct Expr {
	Int(u32),
	Add { lhs: Box<Expr>, rhs: Box<Expr> },
}
```

and flatten it into a `Vec<T>`, or contiguous region of memory.

```rust
struct Arena(Vec<Expr>);

struct Expr {
	Int(u32),
	Add { lhs: usize, rhs: usize },
}
```

We can compare this representation to a traditional memory model:

|        memory | meta-memory         |
| ------------: | :------------------ |
| address space | arena               |
|       pointer | `usize`             |
|    `malloc()` | `Vec::push`         |
|      `free()` | `Vec::clear`        |
|   dereference | indexing            |
|      segfault | out-of-bounds panic |

This simple abstraction over memory has
some desirable performance and safety characteristics
while also being more flexible than pointers, `malloc()` and `free()`.

Whereas typically dereferencing an invalid pointer would give us a segfault,
with an arena bounds-checked indexing causes a runtime panic instead.

Rather than being stuck with 64 bits per pointer,
we can now decide how many bits to use for an index
depending on how many objects we expect to be allocated.
On modern CPU architectures the bottleneck for performance
tends to be memory accesses [citation needed],
so anything we can do to fit more objects into the CPU cache is important.

Arenas also gain us the ability to deallocate all objects at once
by calling `.clear()` on the vector,
which just sets the vector’s `len` field to `0`.
(Note that if the element type of the vector had a destructor,
`Vec::clear` would end up calling each element’s destructor.)

We can detect use-after-frees through a _generation count._
The arena begins at generation number zero,
and includes it in the indexes it hands out.

```rust
struct Arena<T> {
	data: Vec<T>,
	generation: u32,
}

struct Idx {
	idx: u32, // u32 instead of usize to save memory
	generation: u32,
}

impl<T> Arena<T> {
	fn alloc(&mut self, value: T) -> Idx {
		let idx = self.data.len() as u32;
		self.data.push(value);
		Idx { idx, generation: self.generation }
	}
}
```

When the arena is cleared, the generation is incremented.
Indexing into the arena ensures that the index’s generation
and the arena’s generation match.

```rust
impl<T> Arena<T> {
	// snip

	fn clear(&mut self) {
		self.generation += 1;
		self.data.clear();
	}

	fn get(&self, idx: Idx) -> &T {
		assert_eq!(idx.generation, self.generation);
		self.data[idx.idx]
	}
}
```

This way, trying to access an object that has been allocated on the arena
after it’s been freed will panic.
You could use `#[cfg(debug_assertions)]` to make these changes
apply only in debug builds for extra performance in release builds.

It’s important to note that every one of the arena analogues
for typical memory access and management constructs
is actually translated to the typical one underneath.
For instance, indexes are turned into pointers during indexing,
`Vec::push` can internally call `malloc()`
and a `Vec<T>` really is just a chunk of memory.

_Thanks to [RDambrosio016](https://github.com/RDambrosio016) and lovelymono on the [Rust community Discord](https://discord.gg/rust-lang-community) for reviewing this post._ :)
