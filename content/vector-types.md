---
title: "Opinions on Vector Types & the Features They Require"
date: "2024-07-17"
---

Over the past few months I’ve started to (finally!)
get into GPU programming using the wonderful [Metal] API
after years of failed attempts at [learning OpenGL][Learn OpenGL]
and [WebGPU][Learn Wgpu].
One thing I’ve really come to appreciate is good language support for vector types.
Being able to write

```c
float4 ndc = float4(position.xy / resolution * 2 - 1, 0, 1);
```

is such a joy, and I really came to miss it when writing C and Objective-C.
Conveniently, Metal Shading Language (MSL) and the `metal` compiler tool
are just C++ and Clang in a trenchcoat,
so Metal’s vector types are implemented
using the [Clang OpenCL vector extension]
and are conveniently accessible to CPU code from
the `$(xcrun --show-sdk-path)/usr/include/simd/simd.h` header.

Clang-specific C extensions and Metal to one side, though,
general-purpose programming languages typically have good vector type support
only by adding a whole zoo of language features.

## Operator overloading

Let’s start with the most obvious feature.
In my experience the #1 use-case for operator overloading is vector types.
It’s so much nicer to write

```c
float2 v2 = v0 + scale * v1;
```

than it is to write

```c
float2 v2 = float2_add(v0, float2_mul_float(v1, scale));
```

or even

```c
float2 v2 = {0};
v2.x = v0.x + scale * v1.x;
v2.y = v0.y + scale * v1.y;
```

This seems like a great motivation to add operator overloading.
In my opinion, though, operator overloading is a bad idea
because pretty much all uses of it that go beyond vector types
are unnecessary and/or make code harder to understand.

## Properties

Vector types in shading languages let you
access, rearrange and duplicate their fields with ease:

```c
float4 color = input.packed.wzyx * opacity.zzzz;
color.rgb *= opacity;
```

This is called swizzling.
Note how you can refer to the fields with `xyzw` or `rgba`.

Now, it _is_ possible to replicate some of this
[using C-style raw unions][Handmade Math],
but we’ll ignore that here since it isn’t a complete solution.
The proper solution is to use computed properties,
AKA syntactic sugar for getter and setter methods.
Here’s a little condensed example I put together in Swift:

```swift
struct Float2 {
	init(_ x: Float, _ y: Float) {
		self.x = x
		self.y = y
	}

	var x: Float
	var y: Float

	var xx: Float2 { get { .init(x, x) } }
	var xy: Float2 { get { .init(x, y) } set { x = newValue.x; y = newValue.y } }
	var yx: Float2 { get { .init(y, x) } set { y = newValue.x; x = newValue.y } }
	var yy: Float2 { get { .init(y, y) } }

	var r: Float { get { x } set { x = newValue } }
	var g: Float { get { y } set { y = newValue } }

	var rr: Float2 { get { .init(r, r) } }
	var rg: Float2 { get { .init(r, g) } set { r = newValue.r; g = newValue.g } }
	var gr: Float2 { get { .init(g, r) } set { g = newValue.r; r = newValue.g } }
	var gg: Float2 { get { .init(g, g) } }
}
```

Hopefully you can imagine the combinatoric explosion that results
when you go up to three- or four-element vectors.

Once more, I love the ergonomics this language feature enables
when applied to vector types,
but in general I’m not the biggest fan of computed properties.
I’d prefer for systems to be designed so modifying data
doesn’t require a function call in the first place,
and is instead done by the caller directly.

## Function overloading

Another aspect you might notice about shading languages
is how they have a convenient library of built-in functions
that are especially useful for work that involves vectors (graphics, etc).
Instead of writing

```c
float box(float2 position, float2 half_size, float radius) {
   position = abs(position) - half_size + radius;
   return length(max(position, 0.0)) + min(max(position.x, position.y), 0) - radius;
}
```

you’d instead be forced to write

```c
float box(float2 position, float2 half_size, float radius) {
   position = abs_float2(position) - half_size + radius;
   return length_float2(max_float2(position, 0.0)) + min_float(max_float(position.x, position.y), 0) - radius;
}
```

if shading languages didn’t have function overloading.

In my opinion the extra explicitness here doesn’t gain anyone anything,
and only serves to clutter up the code with redundant information.

As you might have guessed, I think overloading makes sense for this use-case,
but not for most others.
For example,
Metal itself has about ten billion different overloads for `texture2d<T>::sample`,
so anyone who _dares_ mix up the texture coordinate and sampler arguments
is greeted with this hellish error message:

```
code/silk/shaders.metal:60:33: error: no matching member function for call to 's
ample'
        float sample = arguments.atlas.sample(input.texture_coordinates, s).r;
                       ~~~~~~~~~~~~~~~~^~~~~~
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4474:24: note: ca
ndidate function not viable: no known conversion from 'float2' (vector of 2 'flo
at' values) to 'metal::sampler' for 1st argument
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, int2 offset = int2(0)) co
nst constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4259:24: note: ca
ndidate function not viable: no known conversion from 'const constant texture2d<
float>' to 'const metal::_texture2d_sample<float, metal::access::sample>' for ob
ject argument
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, int2 offset = int2(0)) co
nst thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4366:24: note: ca
ndidate function not viable: no known conversion from 'const constant texture2d<
float>' to 'const device metal::_texture2d_sample<float, metal::access::sample>'
 for object argument
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, int2 offset = int2(0)) co
nst device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4582:24: note: ca
ndidate function not viable: no known conversion from 'const constant texture2d<
float>' to 'const ray_data metal::_texture2d_sample<float, metal::access::sample
>' for object argument
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, int2 offset = int2(0)) co
nst ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4690:24: note: ca
ndidate function not viable: no known conversion from 'const constant texture2d<
float>' to 'const object_data metal::_texture2d_sample<float, metal::access::sam
ple>' for object argument
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, int2 offset = int2(0)) co
nst object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4264:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias options, int2 offset
 = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4269:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, level options, int2 offse
t = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4275:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, min_lod_clamp options, in
t2 offset = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4286:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d options, int2
offset = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4371:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias options, int2 offset
 = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4376:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, level options, int2 offse
t = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4382:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, min_lod_clamp options, in
t2 offset = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4393:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d options, int2
offset = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4479:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias options, int2 offset
 = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4484:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, level options, int2 offse
t = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4490:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, min_lod_clamp options, in
t2 offset = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4501:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d options, int2
offset = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4587:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias options, int2 offset
 = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4592:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, level options, int2 offse
t = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4598:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, min_lod_clamp options, in
t2 offset = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4609:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d options, int2
offset = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4695:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias options, int2 offset
 = int2(0)) const object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4700:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, level options, int2 offse
t = int2(0)) const object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4706:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, min_lod_clamp options, in
t2 offset = int2(0)) const object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4717:24: note: ca
ndidate function not viable: requires at least 3 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d options, int2
offset = int2(0)) const object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4280:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias bias_options, min_lo
d_clamp min_lod_clamp_options, int2 offset = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4292:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d grad_options,
min_lod_clamp min_lod_clamp_options, int2 offset = int2(0)) const thread
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4387:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias bias_options, min_lo
d_clamp min_lod_clamp_options, int2 offset = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4399:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d grad_options,
min_lod_clamp min_lod_clamp_options, int2 offset = int2(0)) const device
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4495:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias bias_options, min_lo
d_clamp min_lod_clamp_options, int2 offset = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4507:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d grad_options,
min_lod_clamp min_lod_clamp_options, int2 offset = int2(0)) const constant
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4603:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias bias_options, min_lo
d_clamp min_lod_clamp_options, int2 offset = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4615:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d grad_options,
min_lod_clamp min_lod_clamp_options, int2 offset = int2(0)) const ray_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4711:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, bias bias_options, min_lo
d_clamp min_lod_clamp_options, int2 offset = int2(0)) const object_data
                       ^
/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/u
sr/metal/macos/lib/clang/32023.155/include/metal/metal_texture:4723:24: note: ca
ndidate function not viable: requires at least 4 arguments, but 2 were provided
  METAL_FUNC vec<T, 4> sample(sampler s, float2 coord, gradient2d grad_options,
min_lod_clamp min_lod_clamp_options, int2 offset = int2(0)) const object_data
                       ^
```

Everything in MSL is like this.

It’s my guess that this is a fundamental issue.
When there’s a single type signature associated with a given function name,
the compiler can tell you exactly which argument you passed has the wrong type.
Overloading means the compiler has less information about
what you were intending to write.
This issue also pops up elsewhere, like in Haskell with its currying
or C# with its user-definable implicit conversions.

Honestly, I’d be perfectly happy if overloading (or features like it)
were special-cased in the compiler specifically for
a well-chosen set of utility functions built into the language.
You could go down the polymorphism route in lieu of overloading,
but expressing things like “these arguments all have the same type `T`
where `T` is a 16-bit or 32-bit floating-point type or a vector thereof”
(an actual example from the MSL spec)
requires type system features I’d rather
not be able to [shoot myself in the foot with](/language-complexity/).

## Verdict

I wish more CPU programming languages would include vector types
with all the little ergonomic features that make them such a pleasure to use.
And, rather than add the pile of language complexity
required to implement them in userspace,
I wish they’d build them right into the compiler.
It’s easier to get good codegen that way, too.

[Odin] has an interesting approach where fixed-size arrays
function just like vector types in shading languages,
except for constructing vectors from other vectors:

```odin
package main

main :: proc() {
	v0, v1: [4]f32    // [ 0  0  0  0 ] [ 0  0  0  0 ]
	v0.xy = {2, 4}    // [ 2  4  0  0 ] [ 0  0  0  0 ]
	v1.zw -= v0.xy    // [ 2  4  0  0 ] [ 0  0 -2 -4 ]
	v0 = {v1.yzz, 10} // [ 0 -2 -2 10 ] [ 0  0 -2 -4 ]
	// the above line doesn’t compile! write this instead:
	v0 = {v1.y, v1.z, v1.z, 10}
}
```

In my opinion dedicated vector types are the better solution
because I don’t think
generalizing the vector type concept to arbitrary-length arrays is useful.
I’d guess that vectors would, for the most part,
have a small number of unique lengths
(2, 3 & 4 for maths; 8, 16, 32 & 64 for SIMD),
so being able to pick arbitrary lengths doesn’t really help anyone.
Moreover, fixing the `float4(float3, float)` problem
requires adding a feature for constructing arrays from smaller arrays,
which I don’t think would be useful outside of this one particular use-case.
Orthogonality is generally a good thing, and I can see
why merging vector types and fixed-length arrays was so enticing,
but turning the specific into the general only works
if the specific features make sense for the general case.
And, needless to say, I don’t think they do here.

[Metal]: https://developer.apple.com/metal/
[Learn OpenGL]: https://learnopengl.com
[Learn Wgpu]: https://sotrh.github.io/learn-wgpu/
[Clang OpenCL vector extension]: https://clang.llvm.org/docs/LanguageExtensions.html#vectors-and-extended-vectors
[Handmade Math]: https://github.com/HandmadeMath/HandmadeMath/blob/bdc7dd2a516b08715a56f8b8eecefe44c9d68f40/HandmadeMath.h#L311
[Odin]: https://odin-lang.org
