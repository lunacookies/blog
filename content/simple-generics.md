---
title: "A Simple Yet Useful Version of Generics"
date: "2023-02-17"
description: "Based on an old C idiom (as all my recent posts seem to be)"
---

Traditionally,
containers are seen as
an area where generics with monomorphization
are essential;
who wants every key and every value
in their hash table to be boxed?
However,
I think pretty much every use-case for
generics in the context of containers
can be replaced with something far simpler.

To start,
let’s take a look at
a simple implementation of a dynamic array in C.
Everything in this post
applies to any sort of container;
I just chose a dynamic array
because it’s the easiest to implement.

First, the basics:

```c
#include <assert.h>
#include <string.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct vec {
	char *ptr;
	size_t len;
	size_t cap;
	size_t elem_size;
} vec;
```

We’ll need functions to create a new `vec`
and to destroy an existing one:

```c
vec vec_init(size_t cap, size_t elem_size)
{
	return (vec){
		.ptr = calloc(cap, elem_size),
		.len = 0,
		.cap = cap,
		.elem_size = elem_size,
	};
}

void vec_deinit(vec v)
{
	free(v.ptr);
}
```

And we’ll need to be able to push new elements:

```c
void vec_push(vec *v, void *elem)
{
	// grow exponentially once we’ve filled the allocation
	if (v->len >= v->cap) {
		v->cap *= 2;
		size_t new_size = v->cap * v->elem_size;
		v->ptr = realloc(v->ptr, new_size);
	}

	void *dst = v->ptr + (v->elem_size * v->len);
	memcpy(dst, elem, v->elem_size);
	v->len++;
}
```

Finally, let’s add a function to index into the array:

```c
void *vec_at(vec *v, size_t i)
{
	assert(i < v->len);
	return v->ptr + (v->elem_size * i);
}
```

Now we’re ready to test it out!

```c
typedef struct person {
	char *name;
	int age;
} person;

int main() {
	vec v = vec_init(8, sizeof(person));

	vec_push(&v, &(person){ "luna", -1 });
	vec_push(&v, &(person){ "someone else", 92 });
	vec_push(&v, &(person){ "John Smith", 50 });

	for (size_t i = 0; i < v.len; i++) {
		person *p = vec_at(&v, i);
		printf("name: %s\nage: %d\n", p->name, p->age);
	}

	vec_deinit(v);
}
```

As expected, this prints the following:

```
$ ./a.out
name: luna
age: -1
name: someone else
age: 92
name: John Smith
age: 50
```

However, being C,
this approach is error-prone.
In fact, while writing this post
I accidentally passed `sizeof(int)`
instead of `sizeof(person)` to `vec_init()`,
which took me a little while to figure out.
Moreover, it also isn’t type-safe,
so you could freely mix up
a `vec` of integers and a `vec` of enums.

Of course, a language with generics like Zig, C++ or Rust
wouldn’t have these problems.
If we’re willing to forgo
a tiny bit of performance, though,
we can get the same developer experience
as that of, say, Rust’s containers,
but without the long compile times
and binary bloat!

For every type of container imaginable
-- except for fixed size arrays --
the data within the container
is stored behind a pointer.
This means that we can manipulate
the container’s data
without knowing its type,
_if we know the size of the type._
We can store this size at runtime,
exactly as we did in C
with the `elem_size` field.
I imagine a language which allows
for the creation of type-safe generic APIs;
but rather than stamping out copies of container code
for each type the container is used with,
instead the generic type parameter’s size
is passed at runtime.
