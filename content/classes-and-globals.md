---
title: "Classes and Globals"
date: "2022-12-09"
description: "An unlikely equivalence"
---

As of late I’ve been going through the commit history
of Rui&nbsp;Ueyama’s excellent [chibicc],
a self-hosting as-simple-as-possible C compiler.

One thing that stood out to me was
the pervasive use of global variables.
`codegen.c` is a good example.
At the top of the file several statics are defined:

```c
static FILE *output_file;
static int depth;
static char *argreg8[] = {"%dil", "%sil", "%dl", "%cl", "%r8b", "%r9b"};
static char *argreg16[] = {"%di", "%si", "%dx", "%cx", "%r8w", "%r9w"};
static char *argreg32[] = {"%edi", "%esi", "%edx", "%ecx", "%r8d", "%r9d"};
static char *argreg64[] = {"%rdi", "%rsi", "%rdx", "%rcx", "%r8", "%r9"};
static Obj *current_fn;
```

`output_file` is used in `println` …

```c
__attribute__((format(printf, 1, 2)))
static void println(char *fmt, ...) {
	va_list ap;
	va_start(ap, fmt);
	vfprintf(output_file, fmt, ap);
	//       ^^^^^^^^^^^
	va_end(ap);
	fprintf(output_file, "\n");
	//      ^^^^^^^^^^^
}
```

… which in turn is used throughout the file to emit assembly instructions.

We’re taught that global variables are bad,
but after some thought I didn’t feel like they made the code worse;
on the contrary, I felt they _improved_ it.
Let me explain.

Global variables lead to confusing code and difficult bugs
through ✨global mutable state✨;
you call the same function twice with the same arguments
and different results come back.

In `codegen.c`, though, there is a single publicly-accessible entry point
-- `void codegen()` --
and every other top level definition is made private to the translation unit
through the use of `static`.
`void codegen()` internally resets all globals,
and so from an outside perspective
it isn’t possible to tell that `codegen.c` uses global variables.

With this in mind, global variables aren’t actually being used here
to create global state which persists endlessly across function calls.
Instead, they’re being used to create global state
which persists only through the duration of a `void codegen()` call.

## Context objects

Without globals almost every single function in this file
would have to take `output_file`, `depth` and `current_fn` as parameters.
Passing these individually is tiresome and error-prone,
so a typical approach here is to create a “context object”
which gets passed into each function:

```c
typedef struct {
	FILE *output_file;
	int depth;
	Obj *current_fn;
} Context;

// for example
static void gen_expr(Node *node, Context *cx) {
	// ...
}
```

The context object is more annoying to use than global variables are:
`cx->depth` is now needed where previously `depth` would’ve sufficed,
and all function calls have an extra `, cx`
tacked onto the end of the argument list.

Now that global variables have been eliminated,
multiple threads can run code generation in parallel
as long as each thread has its own context object.
If in future the API surface expands to more than a single function call,
then the dependency between those function calls is made explicit
by the API consumer being forced to write `codegen_foo(&cx)`,
rather than data being shared implicitly between those function calls
as with globals.

You can view each context object as a replica of
the static memory the C compiler reserved
for `codegen.c`’s global variables.
More abstractly: static memory has been reified into a data structure,
giving us greater flexibility and thread safety.

I wonder, though, if this has a performance cost.
I’d _guess_ that it would be minor,
but passing an extra pointer argument to every function isn’t free, no?

## Java classes

Let’s go one step further and imagine `Codegen` is a class
(in a vaguely object-oriented language; say, Java)
with `output_file`, `depth` and `current_fn` as fields.
We’re right back to the same internal interface as globals provided:
we don’t need to explicitly pass an extra argument to functions,
and we can access fields without a `this.` prefix.

```java
public void codegen() {
	// create Codegen instance and call relevant methods
}

private class Codegen {
	private FILE *output_file;
	private int depth;
	private Obj *current_fn;

	private void println(char *fmt, ...) {
		// we can access output_file without writing `this.output_file`
	}

	private void gen_expr(Node *node) {
		// we can call println() without writing `this.println()`
	}
}
```

I find it interesting that,
if we ignore inheritance,
Java classes result in the same code
as the classic C approach of
a bunch of encapsulated global variables.

[chibicc]: https://github.com/rui314/chibicc
