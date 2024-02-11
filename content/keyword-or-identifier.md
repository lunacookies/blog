---
title: "To Use a Keyword or an Identifier?"
date: "2024-02-11"
---

The latest C standard declares that
`true`, `false`, `int`, `float` and all the other core types are keywords.
As a result, a definition like

```c
union int_or_float {
	int int;
	float float;
};
```

is illegal since you can’t use keywords as field names.
This isn’t just a contrived edge case, in my opinion:
a union like the above is genuinely useful if you’re doing a lot of bitcasts.
I think this situation is a shame,
because being forced to use more elaborate field names to circumvent the rule
doesn’t help anyone -- `my_union.int` is perfectly clear as it is.

Unsurprisingly[^Go from C], Go fixes this apparent wart in C
and doesn’t make any of the numeric types like `int`, `float64` and
`bool` (shush I know booleans aren’t technically numeric but go with me here)
keywords.
Go treats them the same as other types, except that they have literal syntax,
importing them isn’t necessary, operators work on them, and so on.
They’re still hard-coded in the compiler, but their names remain available.
The same goes for `true`, `false` and `nil`, which count as constants --
magical constants, of course, with special treatment in the language.
What this means is that

```go
type intAndFloat struct {
	int     int
	float64 float64
}
```

is perfectly valid Go code that uses perfectly valid field names,
no matter what my blog’s syntax highlighter might imply.

[^Go from C]: To me, Go is basically a cleaned-up C with a GC
and built-in concurrency thrown on top.

You can also do some tricky things with this:

```go
package main

import "fmt"

func main() {
	fmt.Printf("true is %v and false is %v.\n", true, false)
	true := false
	fmt.Printf("true is %v and false is %v.\n", true, false)
}
```

That’s right.
This _actually_ prints

```
$ go run demo.go
true is true and false is false.
true is false and false is false.
```

We can even change the type entirely:

```go
package main

import "fmt"

func main() {
	fmt.Printf("true is %v and false is %v.\n", true, false)
	true := "huh????"
	fmt.Printf("true is %v and false is %v.\n", true, false)
}
```

```
$ go run demo.go
true is true and false is false.
true is huh???? and false is false.
```

Let’s try the same with `nil` ...

```go
package main

import "fmt"

func main() {
	fmt.Printf("nil = %v\n", (*int)(nil))

	nil := 50
	fmt.Printf("nil = %v\n", nil)
}
```

```
$ go run demo.go
nil = <nil>
nil = 50
```

Even worse, we can redefine the built-in types in the same manner:

```go
package main

import "fmt"

type int string
type pair struct {
	a, b int
}

func main() {
	p := pair{"hi", "there!"}
	fmt.Println(p)
}
```

```
$ go run demo.go
{hi there!}
```

Thanks to Go’s philosophy of eschewing compiler warnings,
none of these programs produce as much as a peep from the compiler.
Even Go’s linter, `go vet`, has nothing to say.

Those cases were contrived, of course, but they still _feel bad._
Could this be used for evil?
If you ask the competitors in the [Underhanded C Contest]
they’d definitely say “yes”,
but I’m not sure if that’s so fair.
In my opinion, it’s a good idea to make writing unobvious & confusing code
harder through language design.
(Macros, I’m looking at you!)

[Underhanded C Contest]: http://www.underhanded-c.org

I think there’s a best-of-both-worlds solution here:
allow using `true`, `false`, `int`, etc as identifiers,
but make the compiler error out in troublesome situations.
More concretely: we don’t want a user-declared identifier
to use the same name as a built-in identifier
when the user-declared identifier is in the same “namespace”
as its built-in counterpart.
For example, it’s okay to create a package, field or type with the name `true`,
but it isn’t okay to create a function, constant or variable with that name
since functions, constants and variables inhabit the “value namespace”.
For example:[^vet complains]

[^vet complains]: Funnily enough,
`go vet` does complain about this particular example.

```go
package main

import "fmt"

func main() {
	fmt.Printf("true is %v and false is %v.\n", true, false)
	fmt.Printf("nil = %v\n", nil)
}

func true() {}
func nil() {}
```

```
$ go run demo.go
true is 0x102f84550 and false is false.
nil = 0x102f84560
```

Basically, `fmt.Println(true)` should always print `true` no matter what.
In the same vein, it’s acceptable to define
a package, function, constant, variable or field with the name `int`,
but not a type with that name.

The compiler should enforce these rules, thereby giving us the flexibility
to re-use the names built into the language where appropriate
without creating the possibility for confusing code.
