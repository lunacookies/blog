---
title: "Boolean Types"
date: "2024-08-17"
---

Up until recently I was of the opinion that
the obvious choice for the in-memory representation of booleans
is an 8-bit integer.
As has become a running theme across the last couple posts,
my preconceptions were challenged once I started looking more into
the [Handmade Network] and related communities.
For some reason everyone there seemed to use 32-bit integers for booleans,
and I started wondering why.
Eventually I was convinced after hearing their arguments and coming up with some of my own.
Maybe I can convince you too.

When looking at the design of data types, there’s always two core things to consider:
_how expensive is it to get the data into and out of the CPU?,_
and _how expensive is it to operate on the data while it’s in the CPU?_
The former is concerned with size & CPU cache utilization,
while the latter is concerned with the performance of the necessary ALU instructions.

From a cache utilization perspective, the obvious preference is to go for
the smallest possible boolean type, i.e. 8 bits.
However, consider that you almost always
deal with only a single boolean value at a time
(e.g. return value of a function, `is_enabled` field in a struct,
`should_stop` local variable, etc).
The size of an integer is irrelevant in these sorts of scenarios.
If you have a boolean field in a struct,
chances are the neighboring fields have an alignment of 4 or 8,
so it makes no difference whether you use 32 bits or 8 bits.
If you’re returning a boolean from a function
or have a boolean local variable, same deal:
the boolean ends up in a 64-bit register so its size has no effect.

But what if you have more than one boolean?
Say, an array of them, or maybe a bunch of boolean fields one after the other?
In these scenarios you don’t have register sizes or padding between struct fields
to mask the difference in size between a 32-bit boolean and an 8-bit boolean,
so 8-bit booleans are the way to go, right?
Nope: if you have more than a couple booleans
you really should be using a bitfield or bit array or something,
rather than consuming a whole byte for each element.
So, in this case too is the size of `bool` irrelevant.

We’ve seen that, for all sensible use cases,
it doesn’t make sense to pick 8-bit booleans over 32-bit booleans
on the basis of cache efficiency.
But, then, why would you _prefer_ the 32-bit type to the 8-bit one?

Modern instruction sets like ARM64 and RV64
only have instructions for operating on 64-bit and 32-bit integers (ignoring SIMD).
As a result, operations on 8 and 16-bit integers
compile down to 32-bit operations.
There’s a complication here, though:
some operations can result in an integer which needs more bits
than what the operation’s inputs need.
For example, the product of two 8-bit integers could take up to 16 bits to represent,
while the result of `AND`ing them will always fit in 8 bits.
In languages like Java and Odin that define integer overflow to wrap,
the lower 8 or 16 bits of the results from these possibly-overflowing instructions
are zero or sign-extended to the register width
as a simulation of what a dedicated 8-bit or 16-bit instruction would do.
Thus, 16-bit adds are typically twice as expensive as 32-bit adds
due to the extra instruction needed to zero/sign extend.

Curiously, there’s even reasons to prefer 64-bit over 32-bit!
[On Apple’s microarchitectures][applecpu] you (in theory)
get better performance & energy usage
if you use 64-bit integers over smaller integer sizes.
While `mov` instructions that operate on 32-bit registers execute as normal,
`mov`s between 64-bit registers never actually execute;
they just get handled during register renaming.
There’s a good chance that other microarchitectures exhibit similar behavior
-- I just haven’t tried to research it.

So, all this paints an overall picture for me:
try to stick to the integer types natively supported by the instruction set,
preferring memory address-sized integers where possible
since those likely have the most streamlined path through the machine.

> **@pervognsen** --- [30 December 2020](https://x.com/pervognsen/status/1344246831027376133)
>
> The right systems programming mentality
> is to think of explicitly sized types as storage types
> and not nothings you compute “on” directly.
> You load into machine ints, do the computation, store back.

Applying that logic to boolean types, it’d be most “natural” for the CPU
if we used 32-bit or even address-sized booleans.

Finally, one last point: remember how I mentioned that
you should never have multiple booleans,
instead preferring bitfields and so on?
If you apply this rigorously, you’ll on occasion find yourself
with a `bool` you’d like to replace with a `u32`
to store multiple booleans efficiently in a bitset.
This is quite minor, I admit, but having `bool` be 32 bits means
swapping to `u32` doesn’t affect data layout,
which might be nice in certain situations.

[Handmade Network]: https://handmade.network
[applecpu]: https://dougallj.github.io/applecpu/firestorm.html
