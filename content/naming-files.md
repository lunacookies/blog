---
title: "Naming Files"
date: "2025-04-16"
---

I used to name files like a “normal person” --
with capitalization, spaces, and so on.

> Non-Fiction Book Report

Partly because I thought the programmer aesthetic looked cool
and partly because I’d begun using the command-line heavily,
I started naming my files so they’d be easy to type into a shell instead.

> `nonfictionbookreport.md`

Over the years I came to embody the programmer aesthetic I had once imitated,
and so the file names became a force of habit.
I disabled macOS’s hiding of file extensions
which seemed almost patronizing to me --
“you users are too dumb to understand technical details like file extensions anyway”.
All this is typical programmer behavior, I think.

But recently I had a change of heart.
It started when I learnt that file extension hiding
is actually an [artifact of history][docs]
rather than a product of Apple’s arrogance.
The non-“computery”, even _friendly_ appearance of
files named with capitals and spaces devoid of a file extension
was appealing all of a sudden,
and so my habits reverted to the behavior of a typical Mac user.
It’s somehow so indescribably nice to look at a list of files in Finder
and see, well, _files,_ in the same way I’d refer to them in conversation
-- replete with highly-detailed preview thumbnails --
rather than a name you’d tell a computer to refer to a file.

In the context of programming, though, the idea of using spaces in file names
remained unthinkable.
Programming is the domain of computers after all,
so it somehow seems wrong to bend them to follow
typographic vagaries like capitalization.
Would you really name a file `File System.c` instead of `fs.c`?
As you might guess, it was at this point that
I noticed how many Objective-C and Swift [project][Ghostty]s
seem to use spaces in file names,
and so this final reservation of mine fell away too.[^entities]

[^entities]:
    The one exception to my current pattern of “human” file names
    is when a file is named after a physical identifier in the code,
    such as the name of a class.
    So far I’ve left these file names untouched.

I wrote this in the hope that other programmers
who blindly follow the typical all-lowercase & no spaces file naming convention
might reconsider.
You have the freedom to choose!

[docs]: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPFileSystem/Articles/FilenameExtensions.html
[Ghostty]: https://github.com/ghostty-org/ghostty/tree/f7394c00c12543742185d8ed682d64d2d6fa1586/macos/Sources/Features
