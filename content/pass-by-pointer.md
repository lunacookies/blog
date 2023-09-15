---
title: "Prefer Passing By Pointer"
date: "2023-09-15"
description: "For simplicity and performance"
---

Before the standardization of C,
not all C compilers let you pass or return structs by value.
This led to code that looks like this:

```c
struct player {
	int x, y;
	int health;
	int score;
	int xp;
	int level;
	int damage_taken;
	int secs_played;
};

void
player_create(struct player *p, int screen_w, int screen_h)
{
	p->x = screen_w / 2;
	p->y = screen_h / 2;
	p->health = 100;
	p->score = 0;
	p->xp = 0;
	p->level = 1;
	p->damage_taken = 0;
	p->secs_played = 0;
}

void
player_update(struct player *p)
{
	// ...
}

void
demo(void)
{
	struct player p;
	player_create(&p, 80, 24);

	while (1) {
		player_update(&p);
	}
}
```

As someone who came to C from Rust,
my reaction when I first saw code like this was one of disgust.
If you add another field to `struct player`,
then `player_create` will accidentally leave it uninitialized.
When `player_update` accesses that field -- instant UB!
Moreover, that repeated `p->` looks ugly,
and on a conceptual level it feels wrong too.
`player_create` is meant to be _creating_ a player,
and yet it’s taking a pointer to one as an argument?
And why don’t we make this code more FP-style to definitely 100% reduce bugs?
`player_update` could well take `p` by value and return an updated form.

After C was standardized as C89
(with the addition of designated initializers in C99)
all these changes can be realized:

```c
struct player
player_create(int screen_w, int screen_h)
{
	return (struct player){
		.x = screen_w / 2,
		.y = screen_h / 2,
		.health = 100,
		.score = 0,
		.xp = 0,
		.level = 1,
		.damage_taken = 0,
		.secs_played = 0,
	};
}

struct player
player_update(struct player p)
{
	struct player new = p;
	// ...
	return new;
}

void
demo(void)
{
	struct player p = player_create(80, 24);

	while (1) {
		p = player_update(p);
	}
}
```

Now the update loop in `demo` looks more functional,
and `player_create` can use that nice familiar record syntax.
If we forget a field, `player_create` will just set it to zero.
This code does the same exact thing as before,
so surely the compiler has our back and will generate the same code.
Right?

(Note that I’ve disabled inlining for the following examples
so that we can actually see what’s happening
instead of it all being flattened out.
Code was compiled using Clang 14 at `-O3`.)

First, we have the A64 assembly for the newer form:

```c
demo:
	// function prologue
	sub     sp, sp, #0x70
	stp     x29, x30, [sp, #0x60]
	add     x29, sp, #0x60

	// p = player_create(...)
	sub     x8, x29, #0x20
	mov     w0, #80
	mov     w1, #24
	bl      player_create

loop:
	// FIRST MEMCPY:
	// tmp = p
	ldp     q0, q1, [x29, #-0x20]
	stp     q0, q1, [sp]

	// tmp2 = player_update(tmp)
	add     x8, sp, #0x20
	mov     x0, sp
	bl      player_update

	// SECOND MEMCPY:
	// p = tmp2
	ldp     q0, q1, [sp, #0x20]
	stp     q0, q1, [x29, #-0x20]

	b       loop
```

The call to `player_create` has been compiled nicely,
with the result (`x8`) being placed directly into p’s stack slot (`x29 - 0x20`).
The update loop isn’t looking so good though --
first we copy `p` into a temporary,
then call `player_update` which puts its result into another temporary,
and finally copy from that temporary into `p`.
This could be even worse if `struct player` were larger than a mere 32 bytes.

Why did the compiler spit out such awful code?
Aren’t they meant to do all kinds of magical register allocation
and scalar-replacement-of-aggregate optimizations?
Well, it turns out that both the AAPCS64 and System V ABIs
only pass & return structs in registers if they are 16 bytes or smaller.
In this case our struct is 32 bytes,
so our only option to avoid these copies is to pass by pointer.

Reverting back to the old style, we get this assembly:

```c
demo:
	// function prologue
	sub     sp, sp, #0x30
	stp     x29, x30, [sp, #0x20]
	add     x29, sp, #0x20

	mov     x0, sp
	mov     w1, #80
	mov     w2, #24
	bl      player_create

loop:
	mov     x0, sp
	bl      player_update
	b       loop
```

Gone are the two `memcpy`s
along with all that confusing fiddling with the stack and frame pointers,
replaced with beautiful simplicity.
Exactly as much code as is needed for the task, and no more.
A contemporary processor will [eliminate all those `mov`s][mov elimination],
so this is even cheaper than it looks.

## A little philosophizing

I want to pause for a moment to emphasize what we just saw.
Initially, we tried to improve the code by making it reflect our intentions.
“`player_create` creates a new player, so it should return a new player,
not update an existing one through a pointer.”
This is an illusion:
that version of `player_create` was still passed a pointer (`x8`)
through which to write its returned player object.
Instead, we should consider
what the processor must perform to accomplish our task,
and write the simplest-possible code which expresses those instructions.
“Since `struct player` is larger than 16 bytes
I know `player_create` will need to store its result through a pointer,
so I’ll just write the code that does that.”

Let me put it another way:
at its heart, a struct is a way of specifying how data is laid out in memory.
It’s a convenience that lets us write `p->health` instead of `*(int *)(p + 8)`
and `p->level` instead of `*(int *)(p + 20)`.
With this in mind, `player_create` isn’t really “creating a player” at all.
Rather, it’s writing values at particular offsets from a location in memory.
The pointer-based version of `player_create`
is the simplest way of accomplishing that.

## Exploiting our circumstances

The benefits of passing and returning by pointer go beyond cleaner assembly.
Assume for a moment that we have some `struct player`-sized memory
which we know has already been zeroed out -- perhaps it came from `mmap`.
In this scenario, explicitly writing zeroes into
`score`, `xp`, `damage_taken` and `secs_played` is wasteful.
The version of `player_create` which uses designated initializers
writes to every field of `player_create` no matter what we do.
When we pass the player by pointer
it lets us write to different regions of it selectively,
saving the processor from carrying out unnecessary work.

```c
void
player_create(struct player *p, int screen_w, int screen_h)
{
	p->x = screen_w / 2;
	p->y = screen_h / 2;
	p->health = 100;
	p->level = 1;
}
```

## A difference in perspective

Once you escape the mindset of functions as little machines
that take inputs in on one side and spit out outputs on the other,
you can come up with new ways of doing things
you wouldn’t have otherwise thought of.

Imagine we’re appending instances of `struct player` to an array of players.

```c
void
append_many(struct array *players)
{
	for (int i = 0; i < 128; i++) {
		append(players, player_create(80, 20));
	}
}
```

This all feels nice and logical.
The player is created and then passed into the append function.
Once again, though, we’re trapped in our mental model of what the code does
-- appending 128 players to an array of players --
instead of thinking about what it _needs_ to do
-- writing certain values in a pattern repeatedly across memory.

There are fundamentally two parts to this problem:
we need some way to step along the memory,
and we also need a way to write the data for a player at a given location.
We can use our pointer-based `player_create` from earlier for the second part.
It writes values into memory at the offsets we want, but it only does it once.
There’s a simple way of accomplishing the first part:
rather than doing the writing itself,
`append` can just _tell us where to write._

```c
void
append_many(struct array *players)
{
	for (int i = 0; i < 128; i++) {
		struct player *p = append(players);
		player_create(p, 80, 20);
	}
}
```

Perhaps `append` could be renamed to `next` or `push`, I’m not quite sure.
`player_init` might be a more appropriate name than `player_create`, too.

But notice what just happened:
if we view what we were doing before through this lens, it seems almost absurd.
`player_create` “returns” a player but in reality needs somewhere to put it,
so a temporary is allocated on the stack and the player data is written into it.
`append` is “passed” the player, which is really a pointer to the temporary.
`append` proceeds to calculate where the next slot in the array is,
and copies the player from the temporary into that slot.

Conveniently, this approach means
your generic container types never take or return elements by value,
which in turn means [you don’t need monomorphization](/simple-generics/),
cutting down on code bloat.
As a side note, having multiple copies of some instructions in an executable
which vary only by the number of bytes being operated on
feels a bit silly to me in light of what I’ve discussed in this article.

[mov elimination]: https://dougallj.github.io/applecpu/firestorm.html
