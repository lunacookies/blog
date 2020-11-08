---
title: "A New Direction for Fjord"
date: "2020-05-30"
---

# Some context

*Fjord* is a project I’m working on. It started off as a ‘shell’ that has all the applications you want to run from it baked into the shell itself; essentially, a scripting language with the ability to call Rust functions. The plan was for Fjord to be used primarily as a shell -- that is, a shell that cannot run programs, only call functions. Stupid, I know.

# Why Fjord is the way it is

I’ve always been interested in Plan 9 and its philosophy -- Unix turned up to eleven, as they say. Specifically, I like how the `find` utility has been split into several smaller commands. Let me give an example (partially stolen from [the repository that holds the `walk` and `sor` utilities][googlewalk]):

Say you want to recursively list all the files in a given directory. With the classic `find` you would do that like so:

    $ find dir

With the Plan 9 utilities:

    $ walk dir

Similar enough. Now, what if you wanted to find all the files and directories containing the word ‘foo’?

    $ find dir -name '*foo*'
    $ walk dir | grep foo

This is where the differences begin to arise. Whereas `find` integrates searching capabilities, `walk` relies on the user’s use of external programs to do the searching.

If you wanted to do a case-insensitive search, `find` offers the `-iname` option, while `walk` can take advantage of `grep`’s `-i` flag:

    $ find dir -iname '*foo*'
    $ walk dir | grep -i foo

What if you wanted to find all the files and directories *not* containing ‘foo’?

    $ find dir -not -iname '*foo*'
    $ walk dir | grep -iv foo

What if you wanted to find all the files (but not directories) that don’t contain ‘foo’?

    $ find dir -type f -not -iname '*foo*'
    $ walk dir | grep -iv foo | sor 'test -f'

Here, a new utility has been introduced: `sor`. `sor` passes each line of the input into the given predicate; if the predicate exits with a `0` (meaning success), then the line is passed on. However, if the predicate exits with a non-`0` exit code (meaning failure), then the line is omitted from the output. As you have probably guessed, `test -f` succeeds if the path listed on `STDIN` is a file; otherwise, it fails.

As you can see, `find` has to keep adding complex functionality to keep up with the whole arsenal of command-line tools that `walk` can integrate with for free.[^1] This approach of ‘doing only one thing’ really resonated with me when I first saw it.

However, in the aforementioned repository where `walk` and its companion `sor` are stored, my eye was caught by a benchmark. Running `find` or `walk` in the simplest case possible (without any kind of filtering at all) shows `walk` to be significantly faster:

> By avoiding syscalls, walk achieves substantially better performance than find. A microbenchmark --
> ```-
> $ time find /usr >/dev/null
>
> real    0m3.542s
> user    0m0.880s
> sys     0m2.646s
> $ time walk /usr >/dev/null
>
> real    0m2.311s
> user    0m0.370s
> sys     0m1.926s
> ```
> -- shows walk executing nearly 40% faster on a local file system with a hot cache. Performance on network file systems should be even better.

However, the moment that `sor` is used to only show files the Plan 9 duo’s performance plummets to be be roughly 135 *times* slower than `find`:

> ```-
> $ time find /usr -type f >/dev/null
>
> real    0m3.464s
> user    0m0.831s
> sys     0m2.615s
> $ time walk /usr | sor 'test -f' >/dev/null
>
> real    7m40.127s
> user    1m47.818s
> sys     2m48.595s
> ```

Once I saw this I came to (or thought I came to) two conclusions:

1. I would really like to use Plan 9’s more orthogonal interface
2. This is way too slow for actual use

And so I resolved to allow command-line usage similar to Plan 9’s without sacrificing performance. Immediately, I had an idea: what if I make a shell where command invocations are actually just function calls to the implementations of commands?

This is what Fjord was born out of.

# Not so fast ...

I explained my idea on r/ProgrammingLanguages, and people were not impressed. In hindsight, the idea was kind of stupid, after all. I’m sure my characterisation of what is essentially a scripting language as a shell didn’t help either. Here’s the first sentence of [a great comment from the creator of Oil Shell][oilshellcomment]:

> Yeah like others, and trying not to be rude, I don't think this idea is compelling. It's basically trying to reimplement the world (i.e. decades of work) for a really tiny performance benefit.

When I read this now I think I should have been wise enough to understand my mistake after reading this. Unfortunately, I did not.

A couple months ago I read the paper [*Program Design in the UNIX Environment*][unix], by Rob Pike. This helped me realise that performance in a command-line context isn’t extremely important -- the terminal is almost always the bottleneck. Rob Pike’s paper, in combination with [this old video I stumbled upon][video], reminded me about how powerful the basic idea of a shell and plain text being passed between programs is.

# A conceptual framework for comparing shells scripting languages

Imagine a spectrum, on which the left side is the simplest shell imaginable:

```python3
import subprocess

while True:
    inputs = input("> ").split()
    subprocess.call(inputs)
```

while the right side is a fully-fledged scripting language that has no way to bridge the gap between the language’s functions and the external commands available outside of the language.

Each extreme is conceptually pure, and beautiful in a way.

An idea I had early into Fjord’s development was that, if I wanted Fjord to be usable as a shell, it would have to be able to run external commands extremely easily. As such, I decided that any function call that fails to resolve would first be run as an external command before raising an ‘unknown function’ error. Here’s an example:

```
# ls is a function from the standard library.
→ ls
Applications
Desktop
Documents
Downloads
...
# mycmd is a command that exists outside of Fjord -- since it is in the PATH,
# no unknown function error is raised and the external command is run.
→ mycmd
Hi from the PATH!
```

If Fjord didn’t have this feature, it would be all the way on the right side of the spectrum, i.e. a scripting language totally isolated from its environment. My theory is that if you start from the right side, but then start moving towards the left side (as Fjord was intending to do), then the language/shell can become awkward. Imagine being confused by your script suddenly running external commands due to a typo in a function call. This idea of automatically running external commands is both necessary for usability, but is also weird, unexpected and dangerous.

Every shell I’ve ever seen starts on the left side, but progressively moves closer to the right side when convenient (e.g. `for` loops are convenient in a shell, so they get added and make the shell more like a language). In fact, most shells have so many of these language-like constructs that they are in fact proper languages in their own right!

# Going forward

It seems that this approach other shells have taken -- starting from the bare minimum a shell needs, and adding language-like features as necessary -- seems like the Right Way, for a shell at least.

‘What about the performance of `sor`?’, you might ask. Well, I came to the realisation that `sor` seems awfully similar to the `filter` function present in many programming languages. Here’s an implementation in pseudocode, in case you’re unfamiliar:

```rust
fn filter<T>(input: List<T>, predicate: T -> bool) -> List<T> {
    var output = List.new()

    for i in input {
        if predicate(i) {
            output.push(i)
        }
    }

    return output
}

assert(filter([1, 2, 3, 4], true), [1, 2, 3, 4])
assert(filter([1, 2, 3, 4], false), [])
assert(filter([1, 2, 3, 4], |x| x % 2 == 0), [2, 4])
```

If you take a look at the function signature, `filter` takes in an anonymous function and an input. In the context of a shell, anonymous functions take the form of strings (remember `sor 'test -f'`?), which are then run in a subshell by the command.

Regarding the slow speed of `sor`, the creator of Oil Shell left [another helpful comment][oilshellcomment2]:

> The issue is that you don't want to start `O(n)` processes, i.e. one process for every file.

So, we need some way for `sor` to be able to take in an anonymous function without starting an entirely new shell for each line. This is where I looked back at my previous ideas, and realised that this may be one instance in which my idea of making all applications builtins might be applicable; in a limited capacity, at least. By making `sor` and any other commands that need to accept anonymous functions[^2] builtins, spawning a shell for each line is avoided.

The moment I noticed the likeness between `sor` and `filter` I started to consider including `filter`’s friends, `map` and `reduce`/`fold` in Fjord. This is definitely an area that I’d like to research further.

[^1]: Note that I’m comparing `find` and `walk` based on the assumption that passing `find` through other command-line programs is verboten, mainly because it seems that `walk` was designed with filtering in mind, while `find` seems to have been designed based on the assumption it’ll be used by itself (given how many features it has).

[^2]: In my experience, the only commands that take anonymous functions are those that are quite simple and can justifiably be made a builtin (such as `sor`), and those whose functionality that makes use of anonymous functions should arguably be made a separate command (such as `find`’s `-exec` functionality being separated into a `map` command that could then be made a builtin).

[googlewalk]: https://github.com/google/walk
[oilshellcomment]: https://www.reddit.com/r/ProgrammingLanguages/comments/frhplj/some_syntax_ideas_for_a_shell_please_provide/flxyjc7?utm_source=share&utm_medium=web2x
[unix]: http://harmful.cat-v.org/cat-v/unix_prog_design.pdf
[video]: https://youtu.be/tc4ROCJYbm0
[oilshellcomment2]: https://www.reddit.com/r/ProgrammingLanguages/comments/frhplj/some_syntax_ideas_for_a_shell_please_provide/fm07izj?utm_source=share&utm_medium=web2x
