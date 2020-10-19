---
title: "A Post-Mortem of syntax-rust"
date: "2020-07-22"
---

Earlier this year, I began a project that aims to create a development environment that is orthogonal, fast, and pleasant to use. It would be difficult for one person to write this all by themselves; my aim was to create but a few of the components involved in such a project. My focus started with the shell, which I called [Fjord][fjord]. Then, my focus shifted to creating a text editor.

I soon discovered the [kilo][kilo] project, whose aim is to create a simple command-line text editor in under 1,000 lines of code. Impressively, it manages to fit in comforts like search and syntax highlighting. This effort inspired me, and soon led me to [Build Your Own Text Editor][byote], a text that guides the reader through the construction of kilo, one piece at a time. Sadly, I skimmed this without reading it in its entirety, but still tried to implement a text editor of my own, leading to a broken and buggy implementation. Instead of trying to find these bugs and fix them, or alternatively start afresh and follow the guide along the way, I instead distracted myself with the problem of syntax highlighting.

# A brief aside about colour schemes

I have always held an interest in design, particularly graphic design, which managed to spill over to the setup of my programming environment. One particular obsession I found early on was colour schemes. Oh, how many hours I wasted scouring the internet for my next Vim colour scheme, trying to find one that I would stick with for more than a day. I did have my streaks, though, sticking with [Apprentice][apprentice] for around a year, and a few others. Nonetheless, my obsession was pretty bad -- at the moment my personal code folder contains forty Vim colour schemes, the majority of which are unreleased, never to be seen again after their brief day or so of usage.

At one point the default Xcode colour scheme caught my eye, with its pretty neon colours and harmonious palette.

![Xcode 11’s default dark colour scheme.](xcode11.png)

I managed to [recreate the colour scheme in Vim][xcodedark], but something was wrong -- Xcode highlighted the code differently. I won’t bore you with the details, but the gist of it is that I managed to create [a crude approximation of Xcode’s fancy semantic highlighting][vim-rust-syntax-ext] for Rust, using only the regex system Vim uses for its highlighting. This eventually led me to another obsession: syntax highlighting.

# The first attempt

My first attempt at creating Rust syntax highlighting for my editor used [nom][nom], a parser combinator library in Rust. I figured out how to use it quickly, and was soon on my way parsing Rust code and constructing ASTs. The highlighter returned the input text, splicing it up and assigning each chunk a ‘highlight group’; for example, `Keyword` or `FunctionCall`. Although this approach makes it easier to implement a highlighter using nom, it does mean that if the highlighter does not return the input in its entirety, an inconsistency can appear in the text editor between the text being shown and the text that is actually there. Not long after I had started the project I began to notice a pattern in the code I had written -- let’s take a function call as an example.

I would declare a struct `FunctionCall` with the fields, say, `name`, `open_paren`, `params`, `close_paren`. Then the constructor would follow, with variables for each field as they were parsed out of the input. The constructor would end by returning an instance of `FunctionCall`, which involves writing all those field names a third time. Finally, I would write a function to convert a `FunctionCall` into a list of `HighlightedSpan`s (the final output of the highlighter), which involved going through each of `FunctionCall`’s fields and turning it into a `HighlightedSpan` -- the fourth time I had to write out each of those field names.

That’s an awful lot of repetition! After realising this, something more worrying came to me: I never actually used those ASTs! They were immediately transformed into lists of `HighlightedSpan`s, never being utilised beyond a bag of variables.

# The second attempt

Having realised that around two thirds of the code I had written was unnecessary, I decided to rewrite the project, throwing out the two thousand lines I had written. Now, this might not sound like much, but it is to me -- I haven’t had any experience with larger codebases outside of Fjord and its related projects.

Once again, I used nom, but this time I omitted ASTs, outputting from each sub-parser a list of `HighlightedSpan`s directly. In the mean time, I wrangled with [the subject of error recovery][nom-error-recovery] (so the whole file wouldn’t turn red if you made a single mistake) in nom, which lead to a number of pretty nasty, hard-to-track-down bugs.[^1] Although I initially managed to solve these, eventually the project became swamped with little niggling problems that I didn’t know how to solve.[^2] And worst of all: the project had no tests.[^3]

It was during this time that I was learning TDD, so I decided that the only way forward was to write tests, or rewrite. Not having the motivation to slog through *every single sub-parser* I had written and painstakingly add tests for *every single case,* I chose the second. The wiser thing to do would have been to add the tests, but oh well.

# The third attempt

This time around I wrote tests for everything, just like a good test-driven developer does. I also used nom, again. I have nothing against nom or its developers, and I’m sure that error recovery is a breeze for people that know how to use nom well, just that *I’m not one of those people.* I don’t think there is much to say here, apart from that it didn’t take long before I started to get tired of nom and decided to rewrite. Fortunately, I didn’t get far into this third attempt, so little time and energy was lost.

# The fourth attempt

Although not as complete as attempts two and three, this attempt’s error recovery is far superior, and I found writing it easier. I ditched nom in favour of a lexer generated by [Logos][logos], combined with a hand-coded parser. I also wrote this in a test-driven manner, which helped catch a few bugs. The switch from parser combinators to the traditional lexer/parser model was a positive one, as it made the parser faster (according to my informal and completely unscientific hold-a-key-down-and-see-how-laggy-it-is experiments) and made error recovery simpler to understand, easier to implement and less mysterious. In hindsight, I’m not sure how I had so much trouble with error recovery in nom, considering how different the experience was in this fourth attempt. Another benefit that the move away from a library brought was that the whole setup was more transparent: apart from the lexer, I could see and understand what a given bit of code was doing more easily. Unfortunately, it was not meant to be.

# The end of the project

It was during the creation of this final attempt that I switched away for my code editor from Vim, in favour of VS Code (why I did is a story for another time). In any case, this meant that prior to the switch, I felt that the editor and syntax highlighting I was creating could feasibly replace Vim. This was an excellent motivator, as I was always thinking about what I felt was wrong with Vim and how I could improve it. And improving on Vim is a feasible project (for me at least) -- all I need to create is a simple text editor with thought-through modes, a composable ‘command language’, and syntax highlighting on top to sweeten the deal. However, once I had gotten used to VS Code’s intelligent autocomplete and language intelligence (courtesy of [rust-analyzer][ra]), the editor I was creating didn’t seem so enticing any more. There was, and is, no way that I could single-handedly recreate either rust-analyzer itself, or the custom extensions VS Code makes to the protocol rust-analyzer uses to communicate with the editor. I can no longer see myself ever using the editor I’m creating.

Before, I was building a tool for myself, that I could use every day and tune to my own preferences to the finest detail. Now that the expectations I hold of my text editor are so high, this is no longer possible.

# Future developments

While I’ve been doing all this syntax highlighting work, I have also rewritten the editor from scratch, closely following the guide I mentioned at the start of this post. I might create a fifth attempt of syntax-rust that only uses a lexer, so that the editor is at least palatable to use for quick edits. I doubt that I’ll use it at all, though, so I might stop developing the editor and syntax-rust.

During my focus on the editor and syntax highlighting, the project that used to be at the centre -- Fjord -- has been neglected. I have learnt a lot about parsing and the creation of programming languages throughout this process, so that when I now look back upon Fjord, I feel that it could be improved in many ways. Before I turn back to Fjord with my newfound knowledge, I need to do a little more work to determine if the changes I want to make to Fjord are possible.[^4]

[^1]: The worst reared its head when presented with (and there are likely other inputs that could trigger it) a struct definition followed by a function definition: a mistake in the struct definition seemed to recover fine, as the function definition was all highlighted correctly, *right up to* the second comma in the function definition’s list of parameters -- *what?!*

[^2]: A memorable one was a bug with error recovery in block expressions -- when a parsing error occurred in a function body (in Rust function bodies are identical to block expressions), the highlighter was able to skip the invalid text until it found something it could work with. However, if an error occurred in a block expression anywhere else, the *entire block* was marked as an error. Weird, right?

[^3]:  Well, it *did* have one or two that I had introduced to debug one specific problem, but that was it.

[^4]: Specifically, the change I intend to make to Fjord is to rewrite its parser with the same approach I used for syntax-rust attempt four, and use the [rowan][rowan] library to represent the parse results. In terms of experiments I need to conduct before I start working on the transition: I’ve already experimented with [Pratt parsing in rowan][expr-parser], but I still need to work out how to get line and column locations within rowan (for error messages). My final goal for all of these changes is to create an interpreter for Fjord that can also function as a language server implementation.

[fjord]: https://github.com/arzg/fjord
[kilo]: https://github.com/antirez/kilo
[byote]: https://viewsourcecode.org/snaptoken/kilo/index.html
[nom]: https://github.com/Geal/nom
[apprentice]: https://github.com/romainl/Apprentice
[xcodedark]: https://github.com/arzg/vim-colors-xcode
[vim-rust-syntax-ext]: https://github.com/arzg/vim-rust-syntax-ext
[nom-error-recovery]: https://www.eyalkalderon.com/nom-error-recovery/
[logos]: https://github.com/maciejhirsz/logos
[ra]: https://rust-analyzer.github.io
[rowan]: https://github.com/rust-analyzer/rowan
[expr-parser]: https://github.com/arzg/expr-parser
