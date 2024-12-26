---
title: "Execution Units are Often Pipelined"
date: "2024-12-26"
---

In the context of out-of-order microarchitectures,
I was under the impression that execution units
remain occupied until the µop they’re processing is complete.
This is often not the case.

As an example, take the [Firestorm] microarchitecture in the A14 and M1.
It has two integer execution units capable of executing multiplies,
which take three cycles to complete one multiplication.

Of course, a sequence of dependent instructions like

```a64asm
benchmark:
	mul	x1, x0, x0 // a
	mul	x2, x1, x1 // b
	mul	x3, x2, x2 // c
	mul	x4, x3, x3 // d
	ret
```

will take 4 × 3 = 12 cycles,
since it can only take advantage of a single execution unit:

| cycle | EU 1  | EU 2  | completed          |
| ----: | :---: | :---: | :----------------- |
|     0 | `[a]` | `[ ]` |                    |
|     1 | `[a]` | `[ ]` |                    |
|     2 | `[a]` | `[ ]` |                    |
|     3 | `[b]` | `[ ]` | `a`                |
|     4 | `[b]` | `[ ]` | `a`                |
|     5 | `[b]` | `[ ]` | `a`                |
|     6 | `[c]` | `[ ]` | `a`, `b`           |
|     7 | `[c]` | `[ ]` | `a`, `b`           |
|     8 | `[c]` | `[ ]` | `a`, `b`           |
|     9 | `[d]` | `[ ]` | `a`, `b`, `c`      |
|    10 | `[d]` | `[ ]` | `a`, `b`, `c`      |
|    11 | `[d]` | `[ ]` | `a`, `b`, `c`      |
|    12 | `[ ]` | `[ ]` | `a`, `b`, `c`, `d` |

With my original understanding of how execution units work,
a sequence of independent instructions like

```a64asm
benchmark:
	mul	x1, x0, x0 // a
	mul	x2, x0, x0 // b
	mul	x3, x0, x0 // c
	mul	x4, x0, x0 // d
	ret
```

would take 2 × 3 = 6 cycles:

| cycle | EU 1  | EU 2  | completed          |
| ----: | :---: | :---: | :----------------- |
|     0 | `[a]` | `[b]` |                    |
|     1 | `[a]` | `[b]` |                    |
|     2 | `[a]` | `[b]` |                    |
|     3 | `[c]` | `[d]` | `a`, `b`           |
|     4 | `[c]` | `[d]` | `a`, `b`           |
|     5 | `[c]` | `[d]` | `a`, `b`           |
|     6 | `[ ]` | `[ ]` | `a`, `b`, `c`, `d` |

As it turns out, many execution unit and µop combinations are heavily pipelined.
This means that a µop can be issued to an execution unit
while it’s still busy processing a different µop.
So, on Firestorm that code sequence actually executes more like

| cycle |    EU 1     |    EU 2     | completed          |
| ----: | :---------: | :---------: | :----------------- |
|     0 | `[a][ ][ ]` | `[b][ ][ ]` |                    |
|     1 | `[c][a][ ]` | `[d][b][ ]` |                    |
|     2 | `[ ][c][a]` | `[ ][d][b]` |                    |
|     3 | `[ ][ ][c]` | `[ ][ ][d]` | `a`, `b`           |
|     4 | `[ ][ ][ ]` | `[ ][ ][ ]` | `a`, `b`, `c`, `d` |

taking 4 cycles instead of 6.

In the limit, where the two execution units are
constantly kept fed with multiplication µops,
my original understanding would have predicted 1.5 cycles/instruction on average,
when they in reality can sustain 0.5 cycles/instruction --
each execution unit can be fed a new multiplication µop every cycle,
and we have two of them.

Knowing this, I finally get why instruction latency and bandwidth tables
specify reciprocal throughput;
because it’s equivalent to cycles/instruction!

I put together a [GitHub repo] where you can see this for yourself.
Make sure to adjust the maximum CPU frequency in `Entry Point.c`
as appropriate.

[Firestorm]: https://dougallj.github.io/applecpu/firestorm.html
[GitHub repo]: https://github.com/lunacookies/PipeliningBenchmark
