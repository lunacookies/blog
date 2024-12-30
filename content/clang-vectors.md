---
title: "Vector Type ABI Shenanigans"
date: "2024-10-15"
---

In a [previous post](/vector-types/) I mentioned Clang’s OpenCL vector extension.
Since then I’ve continued playing around with AppKit and Metal programming,
and my enthusiasm for Clang’s OpenCL vectors has only grown since.

It’s often necessary to specify two-dimensional values when doing GUI programming.
Apple’s frameworks for making GUIs (AppKit, Core Graphics, Core Text, etc)
use `CGPoint` and `CGSize` (sometimes under the aliases `NSPoint` and `NSSize`)
for this purpose.
These types are defined as follows:

```c
// Adapted from $(xcrun --show-sdk-path)/System/Library/Frameworks/CoreFoundation.framework/Versions/A/Headers/CFCGTypes.h

#if defined(__LP64__) && __LP64
typedef double CGFloat;
#else
typedef float CGFloat;
#endif

typedef struct CGPoint CGPoint;
struct CGPoint {
	CGFloat x;
	CGFloat y;
};

typedef struct CGSize CGSize;
struct CGSize {
	CGFloat width;
	CGFloat height;
};
```

Working with these types can be cumbersome since all code is duplicated,
once for each dimension.
On top of that, in my experience the distinction between points and sizes
isn’t worth making at the type level.
As a result I’ve been intending for
My Systems Language That I Will Definitely Implement One Day
to replace both `CGPoint` and `CGSize` with its built-in vector type support.
For this to work these vector types would need to be ABI-equivalent
to their simple C struct equivalents.

The `simd` framework on Apple platforms provides convenient type aliases and functions
for working with OpenCL vectors.
It includes aligned and packed variants of each vector type:
`simd_float2` and `simd_packed_float2`, for example.
The aligned variants are aligned to `sizeof(Element) * arity`,
while the packed variants are aligned to `sizeof(Element)`.
I’m not sure why, but packed variants of three-element vectors aren’t included.
Some examples:

| type        | size | align | packed size | packed align |
| :---------- | ---: | ----: | ----------: | -----------: |
| `float` × 2 |    8 |     8 |           8 |            4 |
| `float` × 3 |   16 |    16 |             |              |
| `float` × 4 |   16 |    16 |          16 |            4 |
| `float` × 8 |   32 |    32 |          32 |            4 |

It’s interesting how `simd_float3` has the same size and alignment as `simd_float4`.
Also, note how the size and alignment of the packed types
is the same as the size and alignment of equivalent C structs.
Surely that means the ABIs are the same, too?
I could write something like this in my language:

```
#if size_of(int) == 8
{
	type CGFloat = f64
	type CGFloat2 = f64x2p // equivalent to simd_packed_double2
}
else
{
	type CGFloat = f32
	type CGFloat2 = f32x2p
}
```

Unfortunately, this hypothetical `CGFloat2`
is not ABI-compatible with `CGPoint`/`CGSize`.
As it turns out, the ABI of OpenCL vectors is ... weird,
and the ABI of packed OpenCL vectors doesn’t match that of standard C structs.

To understand why, we first need to go over some context.
The ARM64 ABI is specified in the [AAPCS64].
ARM64’s SIMD registers can be addressed as either 8 or 16 byte vectors
of 8-, 16-, 32- or 64-bit elements.
The AAPCS64 refers to these as “short vectors”.
Also, it says that function arguments and return values larger than 16 bytes
are passed on the stack, rather than in registers.

Before I bore you to death, let’s see an example.
I’ve defined a vector of four 32-bit floats using a number of different methods:

```c
typedef float f32;
typedef double f64;

typedef struct f32x4 f32x4;
struct f32x4 {
	f32 n[4];
};
typedef f32 f32x4_opencl __attribute__((ext_vector_type(4)));
typedef f32 f32x4_opencl_packed __attribute__((ext_vector_type(4), aligned(4)));
typedef f32 f32x4_neon __attribute__((neon_vector_type(4)));
```

Let’s define a function to increment each element by 1 for each type:

```c
f32x4 f32x4_inc(f32x4 v) {
	return (f32x4){
		v.n[0] + 1,
		v.n[1] + 1,
		v.n[2] + 1,
		v.n[3] + 1,
	};
}

f32x4_opencl f32x4_inc_opencl(f32x4_opencl v) {
	return v + 1;
}

f32x4_opencl_packed f32x4_inc_opencl_packed(f32x4_opencl_packed v) {
	return v + 1;
}

f32x4_neon f32x4_inc_neon(f32x4_neon v) {
	return v + 1;
}
```

On ARM64 macOS with Apple Clang 16.0.0, I get the following assembly:[^registers]

```a64asm
f32x4_inc:
	fmov    s4, #1
	fadd    s0, s0, s4
	fadd    s1, s1, s4
	fadd    s2, s2, s4
	fadd    s3, s3, s4
	ret

f32x4_inc_opencl:
	fmov    v1.4s, #1
	fadd    v0.4s, v0.4s, v1.4s
	ret

f32x4_inc_opencl_packed:
	fmov    v1.4s, #1
	fadd    v0.4s, v0.4s, v1.4s
	ret

f32x4_inc_neon:
	fmov    v1.4s, #1
	fadd    v0.4s, v0.4s, v1.4s
	ret
```

The arguments and return values of all the functions were passed using registers,
exactly as you’d expect since the types all have a size of 16 bytes.
Curiously, the scalar version passed the four floats in `s0`, `s1`, `s2` and `s3`,
while the vector versions pass them in a single vector register, `v0`.
And there you have it: packed OpenCL vectors are not ABI-compatible with plain C structs.

What happens, though, if we use vectors larger than 16 bytes?

```c
typedef struct f32x8 f32x8;
struct f32x8 {
	f32 n[8];
};
typedef f32 f32x8_opencl __attribute__((ext_vector_type(8)));
typedef f32 f32x8_opencl_packed __attribute__((ext_vector_type(8), aligned(4)));
typedef struct f32x8_neon f32x8_neon;
struct f32x8_neon {
	f32x4_neon n[2];
};

f32x8 f32x8_inc(f32x8 v) {
	return (f32x8){
		v.n[0] + 1,
		v.n[1] + 1,
		v.n[2] + 1,
		v.n[3] + 1,
		v.n[4] + 1,
		v.n[5] + 1,
		v.n[6] + 1,
		v.n[7] + 1,
	};
}

f32x8_opencl f32x8_inc_opencl(f32x8_opencl v) {
	return v + 1;
}

f32x8_opencl_packed f32x8_inc_opencl_packed(f32x8_opencl_packed v) {
	return v + 1;
}

f32x8_neon f32x8_inc_neon(f32x8_neon v) {
	return (f32x8_neon){
		v.n[0] + 1,
		v.n[1] + 1,
	};
}
```

Clang’s `neon_vector_type` attribute only supports 64- and 128-bit vectors
since those are the only vector sizes ARM64 supports,
so I’ve constructed an eight-element `f32` Neon vector using an array.
What does the assembly look like?

```a64asm
f32x8_inc:
	fmov    v0.4s, #1
	ldp     q1, q2, [x0]
	fadd    v1.4s, v1.4s, v0.4s
	fadd    v0.4s, v2.4s, v0.4s
	stp     q1, q0, [x8]
	ret

f32x8_inc_opencl:
	ldp     q1, q0, [x0]
	fmov    v2.4s, #1
	fadd    v1.4s, v1.4s, v2.4s
	fadd    v0.4s, v0.4s, v2.4s
	stp     q1, q0, [x8]
	ret

f32x8_inc_opencl_packed:
	ldp     q1, q0, [x0]
	fmov    v2.4s, #1
	fadd    v1.4s, v1.4s, v2.4s
	fadd    v0.4s, v0.4s, v2.4s
	stp     q1, q0, [x8]
	ret

f32x8_inc_neon:
	fmov    v2.4s, #1
	fadd    v0.4s, v0.4s, v2.4s
	fadd    v1.4s, v1.4s, v2.4s
	ret
```

This here is what caught me off guard.
As predicted we’re now seeing arguments and return values pass through memory,
but for some reason the Neon version still doesn’t touch memory?!
Additionally, although we’re accessing memory
in the packed variant of the OpenCL function,
it still produces the same assembly as the aligned variant,
so I’ll stop including it from here on out.

How is it possible for `f32x8_inc_neon` to
have its argument and return value pass solely through registers
even though they both have a size of 32 bytes?
Well, it turns out that the AAPCS64
makes an exception for Homogeneous Floating-Point Aggregates” (HFAs)
and Homogeneous Short-Vector Aggregates” (HVAs).
These are either arrays or structs where each member has the same type;
this type is a floating-point number in the case of an HFA,
or a short vector in the case of an HVA.
Moreover, HFAs and HVAs can only have four or fewer members.

It seems that `f32x8_neon` qualifies as an HVA
-- it consists of two short vector members and nothing else --
and as a result `f32x8_inc_neon` doesn’t touch memory.
`f32x8` doesn’t qualify as an HFA since it has eight members,
and `f32x8_opencl` doesn’t qualify as an HVA since it’s one 32-byte vector
rather than two 16-byte vector members (which would count as short vectors).

After working all this out, I was wondering
how I could stretch HFAs and HVAs to their limits.
Let’s try a vector of four `f64`s:

```c
typedef struct f64x4 f64x4;
struct f64x4 {
	f64 n[4];
};
typedef f64 f64x4_opencl __attribute__((ext_vector_type(4)));
typedef f64 f64x2_neon __attribute__((neon_vector_type(2)));
typedef struct f64x4_neon f64x4_neon;
struct f64x4_neon {
	f64x2_neon n[2];
};

f64x4 f64x4_inc(f64x4 v) {
	return (f64x4){
		v.n[0] + 1,
		v.n[1] + 1,
		v.n[2] + 1,
		v.n[3] + 1,
	};
}

f64x4_opencl f64x4_inc_opencl(f64x4_opencl v) {
	return v + 1;
}

f64x4_neon f64x4_inc_neon(f64x4_neon v) {
	return (f64x4_neon){
		v.n[0] + 1,
		v.n[1] + 1,
	};
}
```

```a64asm
f64x4_inc:
	fmov    d4, #1
	fadd    d0, d0, d4
	fadd    d1, d1, d4
	fadd    d2, d2, d4
	fadd    d3, d3, d4
	ret

f64x4_inc_opencl:
	ldp     q1, q0, [x0]
	fmov    v2.2d, #1
	fadd    v1.2d, v1.2d, v2.2d
	fadd    v0.2d, v0.2d, v2.2d
	stp     q1, q0, [x8]
	ret

f64x4_inc_neon:
	fmov    v2.2d, #1
	fadd    v0.2d, v0.2d, v2.2d
	fadd    v1.2d, v1.2d, v2.2d
	ret
```

Just as you’d think, `f64x4` counts as an HFA and `f64x4_neon` counts as an HVA,
and as a result `f64x4_inc` and `f64x4_inc_neon` don’t access memory!
Funnily enough, the fancy OpenCL compiler extension-using `f64x4_inc_opencl`
is the worst off here.

We can go further.
Double it!

```c
typedef struct f64x8 f64x8;
struct f64x8 {
	f64 n[8];
};
typedef f64 f64x8_opencl __attribute__((ext_vector_type(8)));
typedef struct f64x8_neon f64x8_neon;
struct f64x8_neon {
	f64x2_neon n[4];
};

f64x8 f64x8_inc(f64x8 v) {
	return (f64x8){
		v.n[0] + 1,
		v.n[1] + 1,
		v.n[2] + 1,
		v.n[3] + 1,
		v.n[4] + 1,
		v.n[5] + 1,
		v.n[6] + 1,
		v.n[7] + 1,
	};
}

f64x8_opencl f64x8_inc_opencl(f64x8_opencl v) {
	return v + 1;
}

f64x8_neon f64x8_inc_neon(f64x8_neon v) {
	return (f64x8_neon){
		v.n[0] + 1,
		v.n[1] + 1,
		v.n[2] + 1,
		v.n[3] + 1,
	};
}
```

```a64asm
f64x8_inc:
	fmov    v0.2d, #1
	ldp     q1, q2, [x0]
	fadd    v1.2d, v1.2d, v0.2d
	fadd    v2.2d, v2.2d, v0.2d
	stp     q1, q2, [x8]
	ldp     q1, q2, [x0, #0x20]
	fadd    v1.2d, v1.2d, v0.2d
	fadd    v0.2d, v2.2d, v0.2d
	stp     q1, q0, [x8, #0x20]
	ret

f64x8_inc_opencl:
	ldp     q1, q0, [x0, #0x20]
	ldp     q3, q2, [x0]
	fmov    v4.2d, #1
	fadd    v3.2d, v3.2d, v4.2d
	fadd    v2.2d, v2.2d, v4.2d
	fadd    v1.2d, v1.2d, v4.2d
	fadd    v0.2d, v0.2d, v4.2d
	stp     q1, q0, [x8, #0x20]
	stp     q3, q2, [x8]
	ret

f64x8_inc_neon:
	fmov    v4.2d, #1
	fadd    v0.2d, v0.2d, v4.2d
	fadd    v1.2d, v1.2d, v4.2d
	fadd    v2.2d, v2.2d, v4.2d
	fadd    v3.2d, v3.2d, v4.2d
	ret
```

While the scalar and OpenCL implementations both succumb to the ABI,
`f64x8_inc_neon` cruises on, consuming and returning 64 bytes at a time
without a single memory access!

[AAPCS64]: https://github.com/ARM-software/abi-aa/blob/853286c7ab66048e4b819682ce17f567b77a0291/aapcs64/aapcs64.rst

[^registers]:
    I’ve taken the liberty to convert Apple’s [non-standard](https://ariadne.space/2023/04/13/writing-portable-arm64-assembly/) `fadd.4s v0, v0, v1` syntax to `fadd v0.4s, v0.4s, v1.4s`.
    And yes, I am aware that Apple platforms
    [deviate slightly](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms) from the AAPCS64,
    but it doesn’t matter for our purposes in this article.
