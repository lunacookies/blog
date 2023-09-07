---
title: "Side-Effectful Expressions in C"
date: "2023-04-24"
description: "An analysis of why they’re a bad idea"
---

This article began from a list of reasons I was making
which purportedly justify my years-long (and so far fruitless!)
pursuit of writing my own systems programming language compiler.
More concretely, I was making a list of gripes I have with C.
I sorted them into two groups:
changes that would improve the safety of the language,
and changes that would help maintain the sanity of users and implementers.
Now, _sure,_ using a language where

```c
#include <stdint.h>
#include <stdio.h>

int main()
{
	uint64_t foo = 5327584392;
	uint16_t bar = foo; // implicit narrowing cast!
	printf("%u\n", bar);
}
```

compiles without warnings by default
(given that “default” means `clang -Wall`
and doesn’t include digging through the big list of diagnostics
to find which ones you think are reasonable
and would really quite like to add to your build system)
is not particularly conducive to sanity.
You might say that safety is part of sanity,
and I’d agree with that.
However, for the purposes of my list,
anything to do with program correctness goes in the first bucket,
anything related to scraping off barnacles goes in the second bucket,
aaaand I didn’t include anything else.

In this article I’ll be focusing on
two features of C that made my list --
assignment expressions and pre/post-increment/decrement expressions
-- and why I think they’re problematic.

## Some philosophizing

First, we need to understand
the dichotomy between statements and expressions.
As any functional programmer can tell you,
expressions are trivially nestable,
which is what makes them so flexible and expressive.
Although statements are capable of nesting in some circumstances,
they don’t have the propensity to do so
to nearly the same degree as expressions.
How many layers of `if`s and `while`s do you usually see?
Not a lot.
Something like `a.factor * f(b.foo, b.bar / 2) + 1`,
on the other hand,
is commonplace,
and that has at its deepest point four levels of nesting!

At its core, this difference comes down to something more fundamental:
in a purely functional programming language,
statements do not exist.
(Yes I know there are probably exceptions, but roll with me here.)
Of course, this is because statements exist only to perform side effects,
which you can’t have in pure FP-land.
Conversely, the purpose of an expression is to perform a computation.

Computations are expressed so naturally as a tree of expressions
because we often want to express complex computations made of many parts.
To reuse the example from earlier: who wants to write

```
foo = b.foo
bar = b.bar
half_bar = bar / 2
thing = f(foo, half_bar)
factor = a.factor
factored_thing = factor * thing
result = factored_thing + 1
```

instead of `a.factor * f(b.foo, b.bar / 2) + 1`?

Side effects, on the other hand, are fundamentally about
“do that thing, then do this thing”.
Once you stray from simple straight-line code to
a `switch` inside an `if` statement inside a `while` loop
inside a `for` loop inside an `if` statement,
code becomes hard for humans to understand.

I argue that there is
something fundamental about computation
that lends it to being represented as a tree,
and something fundamental about side effects
that lend them to being represented as a sequence of operations.

This sounds a lot like another dichotomy we’re familiar with --
functional versus imperative programming.
In pure functional programming,
we build up trees of expressions and give them names,
all of which compose well together because no one part has side effects.
I can move a function call from _here_ to _there_
and everything still works,
only because I know that the function call
couldn’t have secretly mutated state that was being read somewhere.
Imperative programming involves
building up series of instructions for the computer -- statements --
which are then executed in the order we specify.
If I reorder some statements the program may no longer work as intended.

Moreover, trees are not good at expressing _order._
Sure, you can define an order in which a tree of expressions will execute,
but this isn’t as easy for humans to reason about
as a flat sequence of statements is.
In fact, the C standard leaves expression evaluation order
undefined in many cases
(such as function arguments and binary operators)!

Now, how does this dichotomy relate to C?
Let’s think back to those two troublesome expressions
I mentioned in the beginning of this article:
assignment and pre/post-increment/decrement.
The thing with these two that makes them hard to reason about
is their side-effectful nature.
Indeed, many (most?) C-like languages omit them,
replacing both with regular statements.
To demonstrate this I’ve prepared a few small examples.

## Example one -- `powi()`

First, we have `powi()`,
a function which raises an integer to an integer power.
In `main()` we call this function while using a pre-increment expression.

```c
#include <stdio.h>

int powi(int x, int y)
{
	int result = 1;
	while (y > 0) {
		y--;
		result *= x;
	}
	return result;
}

int main()
{
	int x = 5;
	printf("%d\n", ++x * powi(x, 2));
}
```

Not only is the runtime behavior of this program non-obvious
(`powi()` looks like it’s being passed `5`
since that appears to be the value of `x` at first glance),
but it’s also undefined:
the C standard does not specify whether
the left-hand side or the right-hand side of a binary operation
is evaluated first.
Clang warns us about this:

```
$ clang demo.c
demo.c:16:17: warning: unsequenced modification and access to 'x' [-Wunsequenced]
        printf("%d\n", ++x * powi(x, 2));
                       ^          ~
1 warning generated.
```

It’s important to note here that
what’s making this hard to understand is that we have
buried a side effect within a tree
instead of laying it out plainly in a sequence of statements.
If we transform `main()` from above to not use a pre-increment expression, we
get:

```c
int main()
{
	int x = 5;
	x++;
	printf("%d\n", x * powi(x, 2));
}
```

Here, it’s blindingly obvious what the behavior of the program is.

You might have noticed we can apply the reverse transformation to `powi()`
as we just applied to `main()`.
To start, we can replace `y > 0` with `y != 0`:

```c
int powi(int x, int y)
{
	int result = 1;
	while (y != 0) {
		y--;
		result *= x;
	}
	return result;
}
```

`while (y != 0)` is equivalent to `while (y)` ...

```c
int powi(int x, int y)
{
	int result = 1;
	while (y) {
		y--;
		result *= x;
	}
	return result;
}
```

... which finally lets us fold the decrement into the loop condition:

```c
int powi(int x, int y)
{
	int result = 1;
	while (y--) {
		result *= x;
	}
	return result;
}
```

For true C-style terseness let’s get rid of those braces too:

```c
int powi(int x, int y)
{
	int result = 1;
	while (y--) result *= x;
	return result;
}
```

This sort of code style can be traced back all the way to K&R,
which uses it extensively.

## Example two -- K&R’s `itoa()`

Take a look at this implementation of `itoa()` from K&R:

```c
void itoa(int n, char s[])
{
	int i, sign;

	if ((sign = n) < 0)  /* record sign */
		n = -n;      /* make n positive */
	i = 0;
	do {        /* generate digits in reverse order */
		s[i++] = n % 10 + '0';   /* get next digit */
	} while ((n /= 10) > 0);         /* delete it */
	if (sign < 0)
		s[i++] = '-';
	s[i] = '\0';
	reverse(s);
}
```

We have two assignments hidden in conditions,
as well as two more assignments hidden within indexing
in the form of post-increment expressions.
Below I’ve rewritten the function to remove both of these:

```c
void itoa(int n, char s[])
{
	int i, sign;

	sign = n;              /* record sign */
	if (sign < 0) n = -n;  /* make n positive */

	i = 0;

	/* generate digits in reverse order */
	do {
		s[i] = n % 10 + '0';   /* get next digit */
		n /= 10;               /* delete it */
		i++;
	} while (n > 0);

	if (sign < 0) {
		s[i] = '-';
		i++;
	}

	s[i] = '\0';
	reverse(s);
}
```

I find this far clearer than the original code,
which takes a bit longer to fully grasp
due to how the acts of calculating things (expressions)
and changing things (statements)
are intermingled.

It’s not all bad, though.
In particular, I really like the `s[i++]` idiom --
writing a byte and moving forward to the next byte
can for many purposes be treated as a single operation.
You wouldn’t blink twice if `s[i++] = '-';` was replaced with `buf.put('-');`
in a language with methods.

Note that this still isn’t how I’d write the code myself
(especially in regards to formatting!),
but that’s beside the point:
we aren’t here to discuss what the prettiest implementation of `itoa` is.

## Example three -- `memcpy()`

An oft-cited [citation needed] implementation of `memcpy()`
reads something like the following:

```c
void *memcpy(void *dst, const void *src, size_t n)
{
	const uint8_t *s = src;
	uint8_t *d = dst;
	while (n--) *d++ = *s++;
	return dst;
}
```

Ignoring how we need to mess with the pointer types
(pointer arithmetic on `void *` is undefined behavior)
and have to return the original destination pointer,
this is a remarkably terse implementation;
it only takes a single line to write the core loop.
Of course, something like

```c
void *memcpy(void *dst, const void *src, size_t n)
{
	const uint8_t *s = src;
	uint8_t *d = dst;

	while (n > 0) {
		*d = *s;
		d++;
		s++;
		n--;
	}

	return dst;
}
```

is more explicit and probably clearer,
but something about the first is unquestionably elegant.

## An aside about Yoda conditions

No discussion which mentions C’s assignment expressions
would be complete without at least a cursory nod towards Yoda conditions.
Because C lets you use any integer type as a condition,
and since the assignment expression returns the value that was assigned,
it’s possible to make typos like this:

```c
if (x = 10) {
	do_stuff(x);
	something_else();
	do_more_stuff(x);
}
```

Here, presumably, the programmer forgot an extra equals sign.
This yields no compile error by default and,
to make matters more confusing for whatever poor soul ends up debugging this,
mutates a variable unexpectedly and
will only run the `if` when the assigned value is not zero.

The traditional way to overcome this is to
always write conditions in the form `if (10 == x)`;
if an equals sign is left out, then a compile error is reported.

## Verdict

Overall, I’m sure that there exists some very elegant code
which uses pre/post-increment/decrement and assignment expressions
to great effect.
Admittedly, I still feel like there is a certain indelible quality to
the K&R-esque style of C code I was disparaging above.
You can get a lot done with very few characters
if you pause a few seconds to understand the code fully.
It can lead to particularly elegant results
when processing data byte-by-byte
in the classic Unix style using `getc()`, `putc()` & co.

However, in my opinion the cost in readability and understandability
beyond the simplest of cases
isn’t worth the improvement in brevity.

You might have noticed how throughout this post
when I purported to remove pre/post-increment/decrement expressions,
I still left them in!
That’s because, if `i++` is restricted to being allowed as a statement only,
then it poses no harm and is merely a bit nicer to type than `i += 1`.
