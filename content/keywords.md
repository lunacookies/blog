---
title: "A Language Design Trick for Keywords"
date: "2024-02-03"
---

A recurring issue in the design of programming language syntax
is the handling of keywords.
What makes keywords tricky is that they’re made of letters,
which user-defined identifiers are too -- they conflict.
As a result, adding new keywords to a language can break existing code
which uses these keywords as identifiers.
Most languages bite the bullet and accept the necessity of breaking changes,
but some find ways to add new keywords
without requiring any changes to existing code.

One way is to change keywords or identifiers in some way
so the two can’t conflict.
Languages like Perl and Bourne shell
_modify identifiers so they don’t look like keywords,_
requiring all user-defined identifiers to be prefixed with a sigil --
`$` in the case of scalar variables in Perl, for example.
Many old-school languages _modify keywords so they don’t look like identifiers_
on the other hand, and make keywords all-caps.
TeX differentiates keywords through sigils instead.[^macros]
In my opinion, these syntaxes all make code noisier and more annoying to type.

[^macros]: Actually macros, not keywords, in the case of TeX, but I digress.

A different approach taken by modern languages like C# and Rust
is to forgo making new keywords reserved words entirely.
Instead, they continue to treat the newly-introduced keyword as an identifier
everywhere, except for the places it can appear as a keyword.
Contextual keywords have the nicest user experience of the three approaches
since they don’t impose a notational burden.
There’s downsides to be had with this approach, though:
contextual keywords are the most complex to implement,
can lead to [confusing code],
and harm error recovery during parsing due to the uncertainty they introduce
about the meaning of a given token.

[confusing code]: https://github.com/rust-lang/rust/blob/f6ee4bf3847277d6d6e2007ff664f8ea0895b11b/tests/ui/weird-exprs.rs#L119-L121

I picked up an interesting trick that gets the best of both worlds
from the programming language Jai:
prefix keywords with a sigil so they can’t conflict with identifiers,
with an exception for a few especially-common keywords.
That is, keywords like `if` and `struct` and `return` remain unadorned,
but less frequently-used ones like `#asm` and `#foreign` and `#import`
are prefixed with an octothorpe.
Jai calls these _directives,_ of which it has [over forty][forrestthewoods].
This approach has all of the benefits of, say, SQL’s all-caps keywords[^SQL]
(existing code doesn’t break when new keywords are introduced)
without any of the downsides (looks ugly, annoying to type).
Jai’s directives are aesthetically pleasing and feel wonderfully familiar to me;
I’d guess this is because they share their syntax with the C preprocessor.
I doubt this is a coincidence.

[forrestthewoods]: https://www.forrestthewoods.com/blog/learning-jai-via-advent-of-code/#compiler_directives

[^SQL]:
    I am aware that (most?) SQL implementations
    also allow you to use lowercase for keywords,
    so my point is actually totally incorrect.
    I chose to use SQL as an example because
    none of the other languages with all-caps keywords (BASIC, Pascal, etc)
    are familiar to most programmers today.

Zig’s [builtin functions] are kind of similar to this.
Their names are prefixed with `@`,[^at sign]
separating them entirely from user-defined identifiers.
Builtin functions are used _all the time_ in Zig
for everything from `memcpy`s to compiler intrinsics.
In my limited experience writing Zig code I actually got annoyed at how
even the most commonplace things like division or pointer casts
required the use of a builtin function.
At the same time, Zig has [a lot of keywords] I can’t see being used all that often.
It feels strange to me that there’s a whole keyword
for specifying a custom address space to store a symbol in,
while something as simple as casting an integer
doesn’t deserve a dedicated keyword.
I’d like it if all those less common keywords were relegated to builtins
while the top two or three most-used builtins
were promoted to keywords or even operators.

[builtin functions]: https://ziglang.org/documentation/0.11.0/#Builtin-Functions
[a lot of keywords]: https://ziglang.org/documentation/0.11.0/#Keyword-Reference

[^at sign]: This is a bit of a strange point, but I really wish languages would
stop placing `@` in important roles in their syntaxes.
And this isn’t because I dislike the glyph itself; on the contrary, in fact:
I actually really like the look of `@` in many typefaces.
Instead, I find that the programming typefaces which get `@` wrong
get it _really_ wrong, and in the process make me wish that
the programming language designer had used a different character.
Some popular programming typefaces whose `@` I dislike are [Roboto Mono],
[Liberation Mono] \(also known as Cousine), and especially [Consolas].
Such a shame about Consolas:
use it for Zig, Ruby, Objective-C, or any other language that uses `@` a lot
and an otherwise gorgeous typeface is totally ruined.
Anyway ...

[Roboto Mono]: https://upload.wikimedia.org/wikipedia/commons/6/68/Roboto_Mono_Specimen.jpg
[Liberation Mono]: https://imgs.fontbrain.com/imgs/50/e5/bfa4278f8f70f3b27d8d7186c202/sa-720x400-333333@2x.png
[Consolas]: https://www.myfonts.com/collections/consolas-font-microsoft-corporation?tab=glyphs

Another interesting case along these lines is Objective-C.
Unlike C++, Objective-C is a strict superset of C.
To be totally source-compatible with C,
Objective-C can’t introduce any new keywords to the language.
Instead, keywords associated with ideas Objective-C adds to C
(for example `@interface` for classes, `@protocol` for protocols, etc)
are prefixed with `@`.
Building on the idea that `@` means “this is an Objective-C thing”,
the language also includes convenience syntax
for creating instances of `NSNumber`, `NSString`, `NSArray` and `NSDictionary`
which consists of regular C tokens like `92` or `"hi"`
prefixed by a lone `@` at the beginning of the literal.
To my taste the result of all this is still a little noisy,
but in most code (method declarations and their bodies)
the `@` makes scant few appearances, if any.
Given Objective-C’s circumstances,
I’d say this is a slightly clunky design that works very well in practice.

In summary, my preferred approach to keywords is
(what I’d like to consider) a pragmatic mixture of approaches:
choose unqualified keywords with extreme care
with the intention of never adding more in the future,
and add qualified keywords with reckless abandon whenever the need arises.
This sidesteps the problems of contextual keywords:
error recovery is perfect,
underhanded code is impossible and thereby syntax highlighting is easy,
and implementation is straightforward.
I’d love to see more languages adopt this syntax in future.
