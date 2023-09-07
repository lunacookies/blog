---
title: "Escaping the Identifier Casing Orthodoxy"
date: "2023-02-16"
description: "I practically live in this bikeshed now"
---

My initial programming experience
was with Ruby and Python,
for both of which there exists
a strong convention regarding identifier casing:

|          | Python & Ruby      |
| -------: | :----------------- |
| variable | `snake_case`       |
| constant | `UPPER_SNAKE_CASE` |
| function | `snake_case`       |
|     type | `PascalCase`       |

Later when I began to use Rust,
things stayed pretty much the same:

|                 | Python & Ruby      | Rust               |
| --------------: | :----------------- | :----------------- |
|        variable | `snake_case`       | `snake_case`       |
| global variable |                    | `UPPER_SNAKE_CASE` |
|        constant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
|        function | `snake_case`       | `snake_case`       |
|            type | `PascalCase`       | `PascalCase`       |
|    enum variant |                    | `PascalCase`       |

Once I started to explore C,
casing wasn’t as clear cut.
C doesn’t have any official guidelines
as to how you should go about naming identifiers,
so every project is free to choose its own style.

As far as I can tell,
the C standard library seems to stick to
the following conventions:

|                 | Rust               | libc               |
| --------------: | :----------------- | :----------------- |
|        variable | `snake_case`       | `semi_snakecase`   |
| global variable | `UPPER_SNAKE_CASE` | `semi_snakecase`   |
|        constant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
|        function | `snake_case`       | `semi_snakecase`   |
|            type | `PascalCase`       | `semi_snakecase`   |
|    enum variant | `PascalCase`       | `UPPER_SNAKE_CASE` |

Some examples:

- `struct iovec`
- `clock_gettime()`
- `struct sockaddr_storage`
- `errno`
- `O_RDONLY`
- `readdir()`

This opened me to the possibility
of using lowercase types,
something I’d never seen before.
To me, lowercase types give off a vibe
I can’t quite put into words:
there’s some kind of low-level feeling to them,
as if the types you’re defining
are just plain data structures
and not “objects” or “classes”.
Of course, it is entirely likely
that I have this association
because I’ve only ever seen the style in C.

At one point I began to look through
the [redis source code][redis],
and took note of their casing style:

|                 | libc               | redis              |
| --------------: | :----------------- | :----------------- |
|        variable | `semi_snakecase`   | `snake_case`       |
| global variable | `semi_snakecase`   | `camelCase`        |
|        constant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
|        function | `semi_snakecase`   | `camelCase`        |
|            type | `semi_snakecase`   | `camelCase`        |
|    enum variant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |

Now this was something I’d never seen before:
using a different style for functions and variables.
This same distinction is made in [Zig]:

|                 | redis              | Zig          |
| --------------: | :----------------- | :----------- |
|        variable | `snake_case`       | `snake_case` |
| global variable | `camelCase`        | `snake_case` |
|        constant | `UPPER_SNAKE_CASE` | `snake_case` |
|        function | `camelCase`        | `camelCase`  |
|            type | `camelCase`        | `PascalCase` |
|    enum variant | `UPPER_SNAKE_CASE` | `snake_case` |

I find this idea interesting.
There’s something about `camelCase`
which feels more “proper” to me,
while `snake_case` feels “lower level”,
all of which somehow fits to using
`camelCase` for functions
and `snake_case` for variables.

Next, I began watching [Handmade Hero],
which uses the following:

|                 | Zig          | Handmade Hero      |
| --------------: | :----------- | :----------------- |
|        variable | `snake_case` | `PascalCase`       |
| global variable | `snake_case` | `PascalCase`       |
|        constant | `snake_case` | `UPPER_SNAKE_CASE` |
|        function | `camelCase`  | `PascalCase`       |
|            type | `PascalCase` | `snake_case`       |
|    enum variant | `snake_case` | `PascalCase`       |

This really threw me for a loop.
Capitalizing variable names, are you nuts?!
After I got over the initial shock,
I tried programming in this style for a bit;
it took a while to get used to,
especially with single-letter variable names
like `I` and `X`.
It was certainly an interesting experience.

As another data point,
Google’s C++ code uses the following style:

|                 | Handmade Hero      | Google        |
| --------------: | :----------------- | :------------ |
|        variable | `PascalCase`       | `snake_case`  |
| global variable | `PascalCase`       | `snake_case`  |
|        constant | `UPPER_SNAKE_CASE` | `kPascalCase` |
|        function | `PascalCase`       | `PascalCase`  |
|            type | `snake_case`       | `PascalCase`  |
|    enum variant | `PascalCase`       | `kPascalCase` |

Again, I kind of like
the increased emphasis on functions here;
especially in plain C code,
there’s something special about them.
They let you abstract over behavior in a way
that nothing else in the language does;
they provide a vital, fundamental abstraction boundary.

> [**u/robertmeta** in r/vim][robertmeta] --- 14 August 2017
>
> \[_On which elements of code should be emphasized
> in syntax highlighting:_\]
>
> I am not 100% sure on preprocessor stuff --
> maybe in the case it is mixed into code,
> else feels very separate.
> But functions are a very special high level thing,
> even having their own brace style in the linux kernel
> for example.

And finally, [Go] uses `camelCase` and `PascalCase` for everything;
public identifiers get `PascalCase`,
while private identifiers get `camelCase`.
Using case to determine visibility on a language level
is certainly an _interesting_ choice,
though I’m not sure if I agree with it.

On the whole, I’m unsure what casing style I prefer.
I’m just glad to have escaped homogeneity,
and to have my eyes open to all the possibilities.

[redis]: https://github.com/redis/redis
[zig]: https://ziglang.org
[handmade hero]: https://handmadehero.org
[robertmeta]: https://www.reddit.com/r/vim/comments/6tb492/comment/dlkrj9m/?context=3
[go]: https://go.dev
