---
title: A Little Hack for Nicer Underlines in CSS
description: It’s not too bad, I promise
date: 2022-10-07
---

`text-decoration: underline` looks <span style="text-decoration: underline">like this</span>.
To my eyes, the underline is too thick
and too close to the text.
How could we create our own custom underline using CSS?

## The basic idea

We can try creating a colored background
behind the text we wish to underline,
then resize and position it so it:

- is one pixel tall
- spans the width of the text
- is positioned just above the very bottom edge of the text

```css
.underlined {
  background-color: currentColor;
  background-repeat: no-repeat;
  background-size: 100% 1px;
  background-position: 0 97%;
}
```

This doesn’t work, since it isn’t possible
to adjust the size and position
of a background created with `background-color`.
Instead, we can use a little hack
to circumvent this limitation:

```css
.underlined {
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 100% 1px;
  background-position: 0 97%;
}
```

We create a gradient which both starts and finishes
at the text’s current color;
this functions identically to the `background-color` property,
except that it lets us resize and reposition the background.

<span style="background-image: linear-gradient(currentColor, currentColor); background-size: 100% 1px; background-repeat: no-repeat; background-position: 0 97%">Much better.</span>

And here, enlarged for your viewing pleasure:

<span style="font-size: 2rem; line-height: 1; text-decoration: underline">lorem ipsum</span>

<span style="font-size: 2rem; line-height: 1; background-image: linear-gradient(currentColor, currentColor); background-size: 100% 2px; background-repeat: no-repeat; background-position: 0 97%">lorem ipsum</span>

(Note that I manually increased the underline thickness
to compensate for the larger font size.)

This technique works consistently across all browsers,
is highly customizable to your liking,
doesn’t require any spottily-supported CSS features
and functions correctly when the underlined text
is broken across multiple lines.

## Avoiding descenders

One downside of this approach
is that it doesn’t avoid descenders
like `text-decoration: underline` does in some browsers.
It _is_ possible to remedy this
through an obscene number of `text-shadow`s,
but this often leads to slow and sometimes outright buggy
rendering by the browser,
which in turn leads to more hacks around making
the shadows disappear when the text is selected.

Regrettably, I couldn’t resist not doing this
when I made my
[Make A Language](https://arzg.github.io/lang) tutorial series.
To give you an idea of what’s involved,
I’ve reproduced an edited version of the code
necessary for implementing this below.
I won’t go into the details though,
since frankly this is just Not A Good Idea.

```scss
// Note: this is SCSS, not CSS

@mixin text-shadow($background) {
  $shadows: ();

  @for $x from -3 through 3 {
    @for $y from -2 through 2 {
      // A shadow at 0px, 0px has no effect, so we omit it.
      @if not($x==0 and $y==0) {
        $shadows: append(
          $shadows,
          unquote("#{$x}px #{$y}px #{$background}"),
          $separator: comma
        );
      }
    }
  }

  text-shadow: $shadows;
}

a {
  background-size: 100% 1px;
  background-position: 0 100%;

  background-image: linear-gradient($light-faded, $light-faded);
  @include text-shadow($light-bg);
  @media (prefers-color-scheme: dark) {
    background-image: linear-gradient($dark-faded, $dark-faded);
    @include text-shadow($dark-bg);
  }
}

// Match color of links’ text shadow when selected to the selection color.
::selection {
  @include text-shadow($light-selection);

  // Selection backgrounds in dark mode have a reduced opacity, so the color we
  // pick won’t match the actual background color of the selection. The best
  // option here is to just disable the text shadow.
  @media (prefers-color-scheme: dark) {
    text-shadow: none;
  }
}
```

Even with all this effort,
the text shadows still don’t render _quite right_
when you select a portion of some underlined text:

<video autoplay muted loop src="/text-shadows.mp4">
</video>
