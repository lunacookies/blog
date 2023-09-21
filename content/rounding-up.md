---
title: "Rounding Up to Multiples of Powers of Two Efficiently"
date: "2023-09-21"
---

Suppose we want to round a number, `n`, up to the next multiple of `p`,
where `p` is a power of two.
We might write some naive code like this:

```c
int64_t
round_up(int64_t n, int64_t p)
{
	int64_t rem = n % p;
	if (rem == 0) {
		return n;
	}
	return n + p - rem;
}
```

We calculate the remainder of `n` divided by `p`.
If `n` is already a multiple of `p`, then we can just return `n`.
Otherwise, we calculate how far we are from the next multiple
-- that’s `p - rem` --
then add that onto `n`, and return.
A little fiddly, but it’s quite simple all up.
The resulting assembly is no fun, though:

```
round_up:
	sdiv    x8, x0, x1
	msub    x8, x8, x1, x0
	add     x9, x1, x0
	sub     x9, x9, x8
	cmp     x8, #0
	csel    x0, x0, x9, eq
	ret
```

`sdiv`, which performs division,
can take up to nine cycles on [the M1’s Firestorm cores][dougallj],
while `msub`, which includes a multiplication, can take up to three cycles.
Theoretically, in the best case this function will take ten cycles.
Surely we do better since we know that `p` is a power of two?

## Rounding down efficiently

Though it isn’t immediately clear how this is relevant,
there’s a fast way to round a number down to
the next multiple of a power of two.

Let’s say we want to round 100 down to the nearest multiple of 16,
which is 2<sup>4</sup>.
To do this, let’s look at some multiples of 16 in binary
to see if we can spot a pattern:

| decimal |     binary |
| ------: | ---------: |
|      16 | `00010000` |
|      32 | `00100000` |
|      48 | `00110000` |
|      64 | `01000000` |

Notice anything?
The last four bits are always zero!
To round a number down to the next multiple of 16,
we can just zero out the bottom four bits:

```c
int64_t
round_down_16(int64_t n)
{
	return n & 0xfffffffffffffff0;
}
```

If `n` is a power of 16 then
we’re just zeroing out bits that are already zero -- no effect.
If `n` isn’t a power of 16 then we’re turning off bits that were set,
meaning the returned value will be less (we’re rounding _down,_ after all).

## Masks

In decimal, powers of ten are always a 1 followed by several 0s.
When you subtract one from a power of ten, you end up with a series of 9s
with one less digit than you started with.
For example `100_000 - 1 == 99_999`.
Equivalently, powers of two in binary are always a `1` followed by several `0`s.
Subtracting one from these gives a series of `1`s.
To find the equivalent of that large `fff...` constant from the previous section
for any value of `p`, we can rely on the fact that `p` is a power of two:

```c
int64_t
round_down(int64_t n, int64_t p)
{
	return n & ~(p - 1);
}
```

Going back to our example of 16 from before, `16 - 1 == 0b1111`.
We want zeroes in those bottom four bits, not ones, so we take the complement:
`~(16 - 1) == 0b11111...111110000`.

## The solution

We want to round up though, not down.
To achieve this we can use another little trick:
rather than figuring out how to round up,
let’s see if we can modify `n` so we can round down every time instead.

Say we want to round some numbers up to the next multiple of 4.
We’d expect the following results from our function:

```
...
round_up(55, 4) == 56
round_up(56, 4) == 56

round_up(57, 4) == 60
round_up(58, 4) == 60
round_up(59, 4) == 60
round_up(60, 4) == 60

round_up(61, 4) == 64
round_up(62, 4) == 64
round_up(63, 4) == 64
round_up(64, 4) == 64

round_up(65, 4) == 68
round_up(66, 4) == 68
...
```

To be able to round down rather than up,
we want to map each four-line chunk _down_ to the next four-line chunk.
For instance, if we could transform
57 into 60, 58 into 61, 59 into 62, and 60 into 63,
then we’d be able to reuse `round_down` from before.
As you might’ve noticed, the increase needed here is `p - 1`,
or `4 - 1 == 3` in this case.
Thus,

```c
int64_t
round_up(int64_t n, int64_t p)
{
	n += p - 1;
	return round_down(n, p);
}
```

is a correct implementation of `round_up`.
We don’t actually need a stand-alone `round_down` implementation,
so let’s inline that:

```c
int64_t
round_up(int64_t n, int64_t p)
{
	n += p - 1;
	return n & ~(p - 1);
}
```

And flatten it out:

```c
int64_t
round_up(int64_t n, int64_t p)
{
	int64_t mask = p - 1;
	return (n + mask) & ~mask;
}
```

The compiler, which in this case is Apple Clang 15.0.0,
does something which surprised me when I first saw it:

```
round_up:
	add     x8, x0, x1
	sub     x8, x8, #1
	neg     x9, x1
	and     x0, x8, x9
	ret
```

Rather than calculating `~mask`, which is really just `~(p - 1)`,
it’s calculated `-p`.
I probably should’ve already known this,
but it turns out that the negation of a positive number `x`
is equivalent to `~(x - 1)`!
Is that where “two’s _complement_” comes from?

## One final improvement

Unfortunately, while very cool,
that last change the compiler made actually led to worse code.

See, A64 has an instruction called Bitwise Bit Clear (or `bic` for short)
specifically for zeroing out an integer `x`
at the bit positions where bits are set in another integer `y`.
In other words, it performs `x & ~y` in one go.
By merging the calculation of `mask` with the calcuation of its complement,
the compiler has missed an opportunity to use `bic`.
I compiled several versions of the function hoping to get Clang to emit `bic`,
but to no avail :(

I looked through `arm_acle.h` which supposedly has a bunch of intrinsics
perfect for this exact sort of situation,
but sadly I couldn’t find an intrinsic for `bic`.
It seems we have to drop down to inline assembly.
I’ll start with just a wrapper function for `bic`:

```c
int64_t
bit_clear(int64_t x, int64_t y)
{
	asm(
		"bic %0, %1, %2"
		: "=r"(x)
		: "r"(x), "r"(y)
	);
	return x;
}
```

The variable given as `"=r"` is where the assembly will place its result,
while the variables given as `"r"` are ones that the assembly reads from.
`%0` refers to the first variable in that list, `%1` refers to the second, etc.
Thus, `%0` is `x`, `%1` is `x` too, and `%2` is `y`.
In other words, we’re running `bic` on `x` and `y`
and putting the result in `x`.

We can update `round_up` to make use of this:

```c
int64_t
round_up(int64_t n, int64_t p)
{
	int64_t mask = p - 1;
	return bit_clear(n + mask, mask);
}
```

Finally, this incarnation of `round_up`
compiles down to just three instructions:

```c
round_up:
	sub     x8, x1, #1
	add     x9, x8, x0
	bic     x0, x9, x8
	ret
```

Each of these instructions is dependent on the previous one,
so we aren’t exploiting instruction-level parallelism or anything.
Every instruction here completes in a single cycle on the M1,
so in total our new `round_up` implementation takes just three cycles.

I haven’t bothered to make any measurements
(I just _cannot_ bring myself to write Yet Another benchmarking harness)
but I’m pretty sure it’ll be much faster than what we started with.

[dougallj]: https://dougallj.github.io/applecpu/firestorm.html
