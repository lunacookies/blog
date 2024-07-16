---
title: "The Dangers of Programming Language Complexity"
date: "2024-07-16"
---

I have this unhealthy habit where I can’t help but use
every feature a programming language provides me.
I’ve gotten a lot better at resisting the urge in recent years,
but it’s still there.

Usually these features have some kind of unique benefit you can’t get any other way
by virtue of being built into the language.
Maybe the compiler can detect if you call some functions in the wrong order,
or maybe the right combination of generics
makes a bunch of explicit conversions go away.
It’s nice to feel like you’ve improved the quality of your code,
and to have done it through your own cleverness to boot!
In my experience, though, the improvements are often purely theoretical.
Using these complex language features isn’t free, either:
to make an unfairly-broad generalization,
I’d say that the extra code complexity they introduce usually outweighs
any improvements to code maintainability, understandability, bug resilience, etc.

There’s a second-order impact here that goes beyond code quality, too:
during the actual process of programming,
my mind is constantly preoccupied with choosing
the combination of language features that best fits the task at hand.
Oh, do I make this a freestanding function, or an associated function?
Should I bother using a `NonZeroU32` for this variable which won’t ever be zero?
Hmm, this submodule’s contents seem to fall into two categories,
does that mean I should create two sub-submodules?
Should I implement the `From` trait,
or should I just have a normal method on the type to perform the conversion?
Should I directly import types and functions I need,
or should I only import the containing module for clarity’s sake?
A single micro-decision doesn’t have much effect on its own,
but facing them constantly while trying to think through a problem
is really tiring.

To sum up: I have a tendency to write overengineered, needlessly-clever code
and get overwhelmed by decisions that don’t matter in the process.
It takes conscious thought to keep things simple and stay focused.

That’s why using Go for the first time was such a revelation for me.
Each of those questions I listed above, along with many others, just vanished.
For example, Go’s package system only has a single level of hierarchy,
and you can’t import symbols individually.
Just like that, the decision has been made for me
and I have no choice but to get back to programming.
The same thing happened when I tried C, Odin and (to an extent) Zig.
Hmm, maybe I should use a marker type with all-private fields here
so the compiler can prevent the theoretical case
where I call these methods in the wrong order ...
Oh, Zig doesn’t have private fields.
Never mind.

I’m starting to see language complexity as bizarre:
the micro-decisions programming languages force us to make
are concerned with programming language specifics,
not our actual goal:
to figure out what instructions we need to give the computer
in order to make it perform a task.
Whether I put some code in a function or a method
has precisely zero impact on what the machine will do.
We’ve brought this complexity upon ourselves.

I realize that my problematically-enthusiastic love of programming language features
is likely above average.
Of course, my argument that we should prefer programming languages with less features
just to make the lives of people like me easier
is unfair to everyone else who has self-restraint
and uses, say, operator overloading only where appropriate.
Still, I think a significant fraction of programmers
have the same tendencies as I do.
Overly-clever, needlessly-complex code is everywhere.
I think it’s worth paying attention to that.
