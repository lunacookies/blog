---
title: "Classes: Jack of All Trades, Master of a Couple"
date: "2023-07-29"
description: "From namespaces to data types, our one-of-a-kind OOP-Flavored Classes do anything you can think of!"
---

I realize it’s unusual to do some good old-fashioned object-oriented programming
only after having learnt other, less mainstream languages like Rust and Haskell,
but here I am.
Recently I had my first proper experience with C#,
and I have some thoughts.
Classes are used for, well, _everything,_
and I’m not sure how I feel about that.
Let’s see some examples.

## Class as data type

This is how I think classes are used most often:
the humble data type.
Think `Date`, `Uuid` or `Rgb`.
Let’s see `Rgb` in C#:

```csharp
public class Rgb
{
	public float R { get; }
	public float G { get; }
	public float B { get; }

	public Rgb(float r, float g, float b)
	{
		R = r;
		G = g;
		B = b;
	}
}
```

This is already quite a bit of boilerplate,
and we haven’t even gotten started on
overloading `==` to get proper value equality
or overriding `ToString()` yet!
If we were writing Java this would be even worse,
as we wouldn’t have properties to synthesize getter methods for us.

And here we see the start of a trend
which will continue throughout this post:
C# includes a language feature to make this case nicer!
Behold, `record class`:

```csharp
public sealed record class Rgb(float R, float G, float B);
```

We get a constructor, properties, `ToString()` and `==`,
all in one line.

See that `sealed` keyword?
That’s another C# language feature helping us out.
Here, `sealed` prohibits anyone else from inheriting `Rgb`.

Now, inheritance is a feature which makes sense in certain use-cases,
and which requires thoughtful design.
For example, imagine we created `class Rgba : Rgb`,
and later also defined a `Rgb.Blend` method.
Sure, it’s mighty convenient that `Rgba` inherited all of `Rgb`’s fields automatically.
Unfortunately, it’ll also inherit that new `Rgb.Blend` method
when it really needs a custom implementation.

Letting others inherit from our class makes future modifications tricky
(you might recognize this as the [fragile base class problem][fragile]).
It’s safer to just prevent inheritance here.

## Class as namespace

Another common use-case of classes is as a grouping of functions.
For instance, imagine a class for mathematical functions:

```csharp
public class Math
{
	public static float Sin(float x) { /* ... */ }
	public static float Cos(float x) { /* ... */ }
	public static float Tan(float x) { /* ... */ }
	public static float Sqrt(float x) { /* ... */ }
}
```

Why are we even using a class here?
There isn’t a constructor, not a single field in sight --
just static methods.
I thought classes exist to join data and behavior together, no?

Of course, in languages such as Java and C#, defining methods
outside a class is forbidden,
so we’re using this workaround of making a class
which only has behavior without any data.

C# lets us formalize `Math`’s role as a “namespace class”
by making it `static`:

```csharp
public sealed static class Math
{
	public static float Sin(float x) { /* ... */ }
	public static float Cos(float x) { /* ... */ }
	public static float Tan(float x) { /* ... */ }
	public static float Sqrt(float x) { /* ... */ }
}
```

(I’ve also taken the liberty of making `Math` sealed
because inheritance doesn’t make sense here either.)

`Math` is really starting to look like a namespace now, huh?
No fields or constructors -- _ever_ -- thanks to that `static` keyword,
and we can bring its methods into scope with `using static Math;`
so we can forget about the existence of the class entirely.

I have to admit,
while I find it ridiculous that any of this is necessary,
I love how it forces function calls to be qualified (ignoring `using static`).
In my opinion the extra context afforded by just one level of explicit namespacing
(well, they aren’t actually namespaces but whatever)
outweighs the keystrokes required.

## Class as interface

Let’s imagine how we might implement
a classic use-case for an interface, `Writer`,
using plain classes (and some imaginary APIs for simplicity):

```csharp
public class Writer
{
	public virtual void WriteBytes(byte[] buffer) {}
	public virtual void Flush() {}
}

public class File : Writer
{
	public int FileDescriptor { get; }

	public File(string path)
	{
		FileDescriptor = Unix.Open(path);
	}

	public override void WriteBytes(byte[] buffer)
	{
		Unix.Write(FileDescriptor, buffer);
	}

	public override void Flush()
	{
		Unix.Flush(FileDescriptor);
	}
}
```

There’s a subtle issue here:
someone who inherits from `Writer` could forget to implement a method,
leaving them with a program that does _nothing_
when it’s meant to be doing _something._
We can try to prevent this:

```csharp
public class Writer
{
	public void WriteBytes(byte[] buffer)
	{
		throw new NotImplementedException();
	}

	public void Flush()
	{
		throw new NotImplementedException();
	}
}
```

Yuck, that’d only catch the mistake at runtime :(

We can do better with Yet Another language feature:

```csharp
public abstract class Writer
{
	public abstract void WriteBytes(byte[] buffer);
	public abstract void Flush();
}
```

Inheriting from `Writer` now requires overriding both methods
at compile time.

## Class as algebraic data type

In case you aren’t familiar with the term,
an “algebraic data type” is a type which is in one of several possible states;
like a traditional enum, but with variants that carry data.
For example, in Rust:

```rust
pub enum Color {
	Rgba(u8, u8, u8, u8),
	Hsl(f32, f32, f32),
	Cmyk(f32, f32, f32, f32),
	Named(String),
}
```

An instance of `Color` can be `Color::Rgba` and then contain four 8-bit integers,
_or_ it can be `Color::Named` and contain a string, but not both at the same time.

It’s possible to implement the same type in C#:

```csharp
public abstract class Color {}

public sealed class RgbaColor : Color
{
	public byte R { get; }
	public byte G { get; }
	public byte B { get; }
	public byte A { get; }

	public Rgba(byte r, byte g, byte b, byte a)
	{
		R = r;
		G = g;
		B = b;
		A = a;
	}
}

// Conjure the remaining variants
// with your mind’s eye
// like a witch summoning
// an xterm from the frosty void
// cause I ain’t writing that shit
```

Matching over all the possible variants is palatable
thanks to yet another specialized language feature,
_declaration patterns_:

```csharp
Color color = /* ... */;

switch (color)
{
	case RgbaColor rgba:
		break;
	case HslColor hsl:
		break;
	case CmykColor cmyk:
		break;
	case NamedColor named:
		break;
}
```

Sadly there’s no guarantee that we’ve handled all possible cases.
Deleting one of the cases doesn’t give us a warning;
it’ll just result in that variant silently falling through the switch.
We can put a bandaid on the problem ...

```csharp
Color color = /* ... */;

switch (color)
{
	case RgbaColor rgba:
		break;
	case HslColor hsl:
		break;
	case CmykColor cmyk:
		break;
	case NamedColor named:
		break;
	default:
		throw new Exception("unrecognized Color variant!");
}
```

... but now we’re right back to those runtime errors from before.

Like with the first section,
this is all data (algebraic _data_ types),
so we want value equality rather than reference equality,
and a nice `ToString()` wouldn’t hurt either.
Again, it’s possible to cut down on
the boilerplate all those niceties would create
by using records in the form of `abstract record class` and `sealed record class`,
but I think you get the point.

## Class as context

This is a case where I think classes really shine.
A common refactoring is to take a large method
-- take this nonsensical one:

```csharp
public sealed class CommandProcessor
{
	private Command[] _commands;

	// other stuff to do with
	// uhhhhhhhh processing commands,
	// or something

	public int CalculateScore()
	{
		int x = 10;
		int y = 20;
		int z = 1000;

		foreach (Command command in _commands)
		{
			switch (command)
			{
				case Command.Foo:
					x *= 2;
					y = 3;
					z += y;
					break;
				case Command.Bar:
					z++;
					x = y;
					y = x * 50;
					break;
			}
		}

		return x + y - z;
	}
}
```

And explode it out into a class:

```csharp
public sealed class CommandProcessor
{
	// ...

	public int CalculateScore()
	{
		return new ScoreCalculator(_commands).Run();
	}
}

public sealed class ScoreCalculator
{
	private Command[] _commands;
	private int x = 10;
	private int y = 20;
	private int z = 1000;

	public ScoreCalculator(Command[] commands)
	{
		_commands = commands;
	}

	public int Run()
	{
		foreach (Command command in _commands)
			HandleCommand(command);
		return x + y - z;
	}

	private void HandleCommand(Command command)
	{
		switch (command)
		{
			case Command.Foo: Foo(); break;
			case Command.Bar: Bar(); break;
		}
	}

	private void Foo()
	{
		x *= 2;
		y = 3;
		z += y;
	}

	private void Bar()
	{
		z++;
		x = y;
		y = x * 50;
	}
}
```

Of course, this example is a bit ridiculous
(and I think the “improved” code is actually worse here),
but please bear with me!
Pretend that we have twenty variants instead of two,
and that each variant takes thirty lines of code instead of three.
It’s much nicer to have each of these blocks in its own method
instead of one 600 line long method.

The interesting part to notice here is the evolution of state.
The local variables in `CommandProcessor.CalculateScore` (`x`, `y` and `z`)
persist while commands are processed --
mutable state is shared across the processing of each command.
This is mirrored by how `ScoreCalculator` has fields for `x`, `y` and `z`
which each `HandleCommand` call can access and modify.

More abstractly: large functions can be refactored
by first reifying the stack frame into a data structure
(turning local variables into fields),
and then breaking the large function up into methods on this data structure.
Just like how all code in a function shares mutable access to the stack frame,
all methods on the data structure share mutable access to the data structure.

Classes are especially suited to this task on a fundamental level:
classes are little bags of state
plus code which causes this state to change over time,
a fusion of data and behavior.
It seems I just described these `ScoreCalculator`-like “context” data types,
hence why classes are suited to representing them.
And hmmm, if you think of the stack frame as data
and the statements in the function body as behavior,
then it seems I also just described a function.

While a function consists of locals and statements,
a class consists of fields and ... more functions.
This leads us to a realization:
classes are like functions, but “one level up”, so to speak.
They are fundamental units of program structure.

## Class as sharer of mutable state

Sometimes, we run into a situation where various systems
need access to shared mutable state.
Imagine you’re writing a grammar checker tool
and have various passes which can find problems in writing.
Each analysis pass internally creates a `StringBuilder`,
appends all the errors it finds,
and then calls `.ToString()` on the `StringBuilder` and returns the `string`.

Whenever the user types something,
we want to update the on-screen error report,
which we do through yet another `StringBuilder`:

```csharp
public sealed class UserInterface
{
	// ...

	private void HandleUserTyping(string newDocument)
	{
		StringBuilder errorReport = new StringBuilder();

		string spellingErrorReport = SpellingPass.Analyze(newDocument);
		errorReport.Append(spellingErrorReport);

		string aiErrorReport = NeuralNetworkPass.Analyze(newDocument);
		errorReport.Append(aiErrorReport);

		string tenseErrorReport = TensePass.Analyze(newDocument);
		errorReport.Append(tenseErrorReport);

		UpdateOnScreenReport(errorReport.ToString());
	}
}
```

This is inefficient; each pass allocates its own `string`,
only for us to immediately append it somewhere.
Why not just share a single `StringBuilder` across all passes?
In the mystical word of otherworldly code samples,
it’s trivial to make this change:

```csharp
public sealed class UserInterface
{
	// ...

	private void HandleUserTyping(string newDocument)
	{
		StringBuilder errorReport = new StringBuilder();
		SpellingPass.Analyze(newDocument, errorReport);
		NeuralNetworkPass.Analyze(newDocument, errorReport);
		TensePass.Analyze(newDocument, errorReport);
		UpdateOnScreenReport(errorReport.ToString());
	}
}
```

`StringBuilder` is a class, so `errorReport`
gets passed by reference to each of the `Analyze` method calls,
allowing the passes to mutate it.

Imagine for one second a world in which C# has no implicit pass-by-reference;
all classes are replaced by structs, and pointers are commonplace.
Sorta like Go, actually.

In this world, would you ever pass `StringBuilder` by value?
Hell no!
Take `StringBuilder.Remove` as an example:
calling that method modifies the length that `StringBuilder` stores internally.
If you’ve been passed a `StringBuilder` by value and this happens,
then your copy of the `StringBuilder`
will have a different length than whoever called you,
even though both copies are pointing at the same data!
Confusing bugs ensue.

`StringBuilder`’s reason for existing is to be mutated,
and this works only if you pass it by reference.

And while _yes,_ shared mutable state can be dangerous and error-prone,
some types just _want_ to be shared
and are inherently only useful when they’re passed by reference.
This is what classes are for.

## Conclusion

Throughout this article I’ve drawn immensely on
the ideas in [this incredible blog post][tedinski] by Ted Kaminski.
While we started with how object-oriented languages
have a million different uses for classes
(because they have no alternative language construct)
and the extra language features to match,
in exploring this we’ve also seen how important classes are.

These class-related language features exist as a crutch
for shortcomings in other areas of language design.
Fancier classes aren’t the solution to everything!
First, the addition of freestanding functions
would liberate classes from standing in for namespaces.
Next, data is the bread and butter of programming,
whether it be structs or algebraic data types,
and convenient, boilerplate-free support which isn’t entwined with classes
is sorely missed.
Finally, streamlining the experience of using objects
by making `sealed` the default,
[removing constructors][constructors],
and considering [alternatives to inheritance][OOP without inheritance]
would be a welcome change.

[fragile]: https://en.wikipedia.org/wiki/Fragile_base_class
[tedinski]: https://www.tedinski.com/2018/01/23/data-objects-and-being-railroaded-into-misdesign.html
[constructors]: https://matklad.github.io/2019/07/16/perils-of-constructors.html
[OOP without inheritance]: https://www.tedinski.com/2018/02/20/an-oo-language-without-inheritance.html
