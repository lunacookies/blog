---
title: "How to Choose Colors for Your CLI Applications"
date: "2023-01-29"
description: "A plea to CLI developers"
---

Let’s say you’re creating
a CLI tool which has to display
syntax highlighted source code.
You begin by choosing some colors
which look nice with
your chosen terminal theme:

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×11
</div>
<div class="code sorcerer">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

Nice!
However,
who knows if it’ll still look good
for people who use
a theme different to yours?
It seems sensible to try out
the defaults, at least.
Let’s start with
the macOS Terminal.app default theme:

<div class="term light">
<div class="titlebar">
~ — zsh — Basic — 51×11
</div>
<div class="code basic-light">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

<div class="term dark">
<div class="titlebar">
~ — zsh — Basic — 51×11
</div>
<div class="code basic-dark">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

Youch!
It seems fair to try the Tango themes next,
since those are the default on e.g. Ubuntu:

<div class="term auto">
<div class="titlebar">
~ — zsh — Tango Light — 51×11
</div>
<div class="code tango-light">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

<div class="term auto">
<div class="titlebar">
~ — zsh — Tango Dark — 51×11
</div>
<div class="code tango-dark">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

Hmm, better, but not by much.
Finally,
let’s try what is likely
the most popular custom terminal theme -- Solarized:

<div class="term auto">
<div class="titlebar">
~ — zsh — Solarized Light — 51×11
</div>
<div class="code solarized-light">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

<div class="term auto">
<div class="titlebar">
~ — zsh — Solarized Dark — 51×11
</div>
<div class="code solarized-dark">% highlight foo
<span class="brblack"># just some docs</span>
<span class="brblue">func</span> <span class="bryellow">HelloWorld</span>() [<span class="brred">12</span>]<span class="brmagenta">u8</span> {
&#9;<span class="brblue">return</span> <span class="brgreen">"hello world</span><span class="green">\n</span><span class="brgreen">"</span>
}
Finished highlighting in 0.02 seconds.
% █</div>
</div>

Well then ...
Let’s take a look at each palette
and investigate.

## Sorcerer

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×11
</div>
<div class="code sorcerer">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

In Sorcerer,
all colors are readable
on the default background
except for `black`,
which is in fact darker than the background.
This is useful as the background color
for status bars and the like.
`white` is the same color as
the default foreground,
and `brblack` is a nice faded color.
Additionally, `brwhite` is
even lighter than the foreground;
this allows for subtle emphasization
of important text
like error messages and titles.

## Basic

<div class="term light">
<div class="titlebar">
~ — zsh — Basic — 51×11
</div>
<div class="code basic-light">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

<div class="term dark">
<div class="titlebar">
~ — zsh — Basic — 51×11
</div>
<div class="code basic-dark">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

The Basic themes are, well, _horrendous._
Really owning that 90s xterm look, it seems.
`bryellow` is unreadable in light mode
(check out that function name
from the code sample earlier),
while in dark mode
both `blue` and `brblue`
are totally illegible.

That leaves us with thirteen colors
we can safely use:

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×11
</div>
<div class="code sorcerer">% colortest --only-usable
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow gone">██ bryellow</span>
<span class="blue gone">██ blue</span>&#9;&#9;<span class="brblue gone">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

## Tango

<div class="term auto">
<div class="titlebar">
~ — zsh — Tango Light — 51×11
</div>
<div class="code tango-light">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

<div class="term auto">
<div class="titlebar">
~ — zsh — Tango Dark — 51×11
</div>
<div class="code tango-dark">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

In my opinion
these did a lot better than
Terminal.app’s Basic themes,
but they are still far from perfect.
`bryellow` is again unreadable in the light theme,
and perhaps `brgreen` is
a little difficult to see,
though it’s nothing that would
stop me from using `brgreen`
in an application.

At this point you may have noticed
how the greyscales --
`black`, `brblack`, `white` & `brwhite` --
have remained consistent
between light and dark themes
for both Basic and Tango.
Of course,
this means that
`{,br}white` is unreadable in Tango Light
(owing to the light background)
and `black` is unreadable in Tango Dark
(owing to the dark background).

In other words:
forget about
that idea of mine from earlier
about using `brwhite` to emphasize content.
Unless, of course,
you don’t mind if your
eminently _emphasized_ words
are completely unreadable
for the user of your software
who deigns to use the default light theme
of A Popular Linux Distro.

On the other hand,
using `brblack` to de-emphasize content
still seems fine to me.
I suppose some extra contrast
for `brblack` in Tango Dark
would be nice,
but with text which is meant to be ignored
I don’t think this matters much.

And lo, but ten colors remain.

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×11
</div>
<div class="code sorcerer">% colortest --only-usable
<span class="black gone">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow gone">██ bryellow</span>
<span class="blue gone">██ blue</span>&#9;&#9;<span class="brblue gone">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white gone">██ white</span>&#9;<span class="brwhite gone">██ brwhite</span>
% █</div>
</div>

## Solarized

<div class="term auto">
<div class="titlebar">
~ — zsh — Solarized Light — 51×11
</div>
<div class="code solarized-light">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

<div class="term auto">
<div class="titlebar">
~ — zsh — Solarized Light — 51×11
</div>
<div class="code solarized-dark">% colortest
<span class="black">██ black</span>&#9;<span class="brblack">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow">██ bryellow</span>
<span class="blue">██ blue</span>&#9;&#9;<span class="brblue">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan">██ brcyan</span>
<span class="white">██ white</span>&#9;<span class="brwhite">██ brwhite</span>
% █</div>
</div>

Solarized is a curious beast.
Every color in it
was chosen using [_L\*a\*b\*_][lab],
a perceptually-uniform color space
from the 1970s.
(For what it’s worth,
color science has
[progressed significantly][oklab] since then;
the only reason
Ethan Schoonover used _L\*a\*b\*_
is that it’s commonly used in photography,
and he used to be a professional photographer.)

Its lightnesses are perfectly symmetrical
so that Solarized Light and Dark
can share a set of accent colors
while maintaining identical contrast.
Moreover,
the warm tones of the light theme
and cool tones of the dark theme
are complementary.
(The hue gap is
closer to 150° than 180° in reality.
See [here](https://bottosson.github.io/misc/colorpicker/#002b36)
and [here](https://bottosson.github.io/misc/colorpicker/#fdf6e3)
to compare hue values.)

Solarized is also incredibly popular.
I have no data here,
but as of the date of writing
it’s the most starred theme repository on GitHub
I can find.
Solarized has 15.4 thousand stars at the moment,
while the next-closest is [Gruvbox]
with 11.8 thousand.
Solarized is available as a plugin
or sometimes even as a built-in preset
in damn near every
popular terminal emulator and editor
on the planet.

To understand Solarized’s
peculiar arrangement of the 16-color palette,
we have to travel back in time to 2011
[when Solarized was first released][solarized-init].
In this dark era,
terminals supporting 24-bit color
didn’t exist / weren’t widespread.
One option common among Vim themes at the time
was to round every color
to the nearest 256-color palette value.
In Solarized’s case,
this destroys the mathematical symmetry
at the heart of the theme.
([I’m not kidding, it looks awful][solarized-256].)

The solution
-- rather, _hack_ --
chosen at the time
was to distill
all the colors used in the Vim interface
down to a palette of sixteen colors.
Conveniently,
Solarized’s accent colors
fit nicely into the non-bright column
of the 16-color palette,
while Solarized’s monotones
fit into the bright column.
Once the user sets their terminal
to use the Solarized palette,
Vim can color its entire interface
using only the 16-color palette
and get correct color values,
no clunky color approximations needed.

The downside to all this is that
an application which uses
any of the bright colors
which Solarized co-opted for itself
will look strange.
Users of Solarized
-- and, by god, there’s so many of them --
[appear](https://github.com/gradle/gradle/issues/2417)
[frequently](https://github.com/gruntjs/grunt/issues/181)
[on](https://github.com/crate-ci/cargo-release/issues/41)
[issue](https://github.com/cli/cli/issues/1743)
[trackers](https://github.com/mintty/mintty/issues/683)
asking why command-line output
is inexplicably gray or even invisible
as a result of CLIs
using these forsaken bright colors.

Our beloved `brblack`
is unreadable in Solarized Dark,
so we’ll have to strike it from the table
in addition to the affected bright colors.

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×11
</div>
<div class="code sorcerer">% colortest --only-usable
<span class="black gone">██ black</span>&#9;<span class="brblack gone">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen gone">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow gone">██ bryellow</span>
<span class="blue gone">██ blue</span>&#9;&#9;<span class="brblue gone">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan gone">██ brcyan</span>
<span class="white gone">██ white</span>&#9;<span class="brwhite gone">██ brwhite</span>
% █</div>
</div>

## A sad note about bold

Far back in the past,
there was no way for terminals
to display bright colors.
As a workaround,
manufacturers
(we’re talking about
physical terminals here)
[started making all bold text bright
instead of using a heavier font weight][boldbright].
One way or another
this ended up in the default settings of
many modern terminal emulators
(in spite of not being in the standard),
meaning that
regular colorful text made bold
can become bright too,
depending on the user’s configuration.

## Conclusion

And so, I present to you the final version
of our table of acceptable colors:

<div class="term auto">
<div class="titlebar">
~ — zsh — Sorcerer — 51×21
</div>
<div class="code sorcerer">% colortest --only-usable --bold
Regular:
<span class="black gone">██ black</span>&#9;<span class="brblack gone">██ brblack</span>
<span class="red">██ red</span>&#9;&#9;<span class="brred">██ brred</span>
<span class="green">██ green</span>&#9;<span class="brgreen gone">██ brgreen</span>
<span class="yellow">██ yellow</span>&#9;<span class="bryellow gone">██ bryellow</span>
<span class="blue gone">██ blue</span>&#9;&#9;<span class="brblue gone">██ brblue</span>
<span class="magenta">██ magenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan">██ cyan</span>&#9;&#9;<span class="brcyan gone">██ brcyan</span>
<span class="white gone">██ white</span>&#9;<span class="brwhite gone">██ brwhite</span>
<br><br>
Bold:
<strong>
<span class="black gone">██ boldblack</span>&#9;<span class="brblack gone">██ boldbrblack</span>
<span class="red">██ boldred</span>&#9;<span class="brred">██ boldbrred</span>
<span class="green gone">██ boldgreen</span>&#9;<span class="brgreen gone">██ boldbrgreen</span>
<span class="yellow gone">██ boldyellow</span>&#9;<span class="bryellow gone">██ boldbryellow</span>
<span class="blue gone">██ boldblue</span>&#9;<span class="brblue gone">██ boldbrblue</span>
<span class="magenta">██ boldmagenta</span>&#9;<span class="brmagenta">██ brmagenta</span>
<span class="cyan gone">██ boldcyan</span>&#9;<span class="brcyan gone">██ boldbrcyan</span>
<span class="white gone">██ boldwhite</span>&#9;<span class="brwhite gone">██ boldbrwhite</span></strong>
% █</div>
</div>

Only around 34% of our available palette
is permissible,
given that we want applications
to remain readable
for as many people as we can.

If you’re developing a command-line tool
which will be used by
anyone apart from yourself,
I strongly recommend
you limit your use of color
to the ones I’ve identified here
as being “mostly alright”
and “not unreadable in
a common configuration
used by tons of people”.

## Appendix

You probably didn’t notice,
but I styled the “terminal windows”
in this post to look
as similar as possible
to macOS Terminal.app windows
through painstaking
color picking and pixel counting.

The dimensions in each window’s titlebar
matches as closely as I can
with its actual dimensions on-screen.

The `colortest` and `highlight` utilities
are entirely fictional.

Terminal.app doesn’t actually provide
individual access to
the light and dark variants of Basic;
they appear as a single theme,
which switches seamlessly
when the OS theme changes.
As far as I know,
this reactive functionality
isn’t exposed to any other theme,
whether pre-installed or user-created.
In order to capture this,
I made the terminal windows in this post
react to whether the rest of the site
is in light or dark mode,
_except for the Basic windows._
They remain fixed in
either light or dark mode,
since in real life you’ll never see,
for example,
a light Basic terminal
with dark window chrome.

[lab]: https://en.wikipedia.org/wiki/CIELAB_color_space
[oklab]: https://bottosson.github.io/posts/oklab/
[gruvbox]: https://github.com/morhetz/gruvbox
[solarized-init]: https://github.com/altercation/solarized/commit/3da9bd10d3b8c1ad6e2a5ab8617ef8c82fca0df7
[solarized-256]: https://github.com/lifepillar/vim-solarized8#but-my-terminal-has-only-256-colors
[boldbright]: https://en.wikipedia.org/wiki/ANSI_escape_code#3-bit_and_4-bit
