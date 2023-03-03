---
title: "Signing Your Commits in 2023 on macOS"
date: "2023-03-02"
description: "Featuring Git, SSH and Keychain"
---

> Edit:
> It has been one day since I posted this.
> I have now learned of the existence of [Secretive] and [YubiKeys],
> and how keeping a private key in a file accessible to, say, malware,
> might not be the best idea.
>
> If you have a capable Mac, I highly recommend playing around with Secretive!
> It and the Secure Enclave are very cool pieces of technology.
> Once again: let this be a lesson to not take security advice
> from some random blog post :)

Let me preface this with a disclaimer: I am not a security expert,
and I in fact know very little about either digital security or cryptography.
This is just a little note on what I’ve learned about this topic
so you don’t need to go scrounging around the internet like I did.

## The bad old days

In the past, I used GPG to sign my commits.
It sounded simple enough:
just `brew install gnupg`,
run a few commands to generate a key,
paste the results into GitHub
and I’d be on my way.
Unfortunately, it wasn’t that easy.
Maybe it’s because I’m completely clueless about this topic
and I made some sort of silly mistake,
but I constantly had problems.

I don’t want to bore you with my pains and give an excruciating recount of
everything I can remember that went wrong with GPG commit signing.
Instead, I have included one example which I think is illustrative.
Feel free to skip to the next section if you’d like.

In the end, after one and a half years [I gave up] out of frustration
and stopped signing commits entirely.

Initially, whenever I tried to sign a commit
I was greeted by this error message:

```
$ git commit --gpg-sign
error: gpg failed to sign the data
fatal: failed to write commit object
```

Some googling revealed that the solution to this cryptic error
is buried in the manpages (as usual).
From `man gpg-agent`:

> You should always add the following lines
> to your `.bashrc` or whatever initialization file is used
> for all shell invocations:
>
> ```
> GPG_TTY=$(tty)
> export GPG_TTY
> ```
>
> It is important that this environment variable
> always reflects the output of the `tty` command.
> For W32 systems this option is not required.

Of course, [I obliged][tty] and added this to my shell configuration.

## The shiny new way

For a bit of context:
in 2019 it became possible to
[use OpenSSH keys to sign anything][openssh],
and in August of 2022 [GitHub added support
for signing commits with SSH keys][github].

I first found out about this because
my university’s private GitLab instance
does not allow saving HTTPS credentials;
when I wanted to access a repo,
I had to type my username and password in,
_every single time._
The options here are to either
store your credentials [forever in plaintext][store],
cache your credentials [for fifteen minutes in memory][cache],
or set up an SSH key.
None of those options sounded particularly appealing to me.

After much reluctance following my previous experience with GPG,
I followed some instructions I found in GitLab’s documentation,
and off I went!

Creating a key is easy: just run

```
$ ssh-keygen -t your-key-type-of-choice
```

(And yes, you don’t have to install anything
because OpenSSH is pre-installed.)

The recommended key type these days is `ed25519`
(don’t quote me on that),
so I ran

```
$ ssh-keygen -t ed25519
```

1. Enter a filename
   (or just hit enter and accept the default of `~/.ssh/id_ed25519`)
2. Enter a passphrase and confirm it
3. There is no third step!

`ssh-keygen` should have printed a big long string
after you confirmed your passphrase.
This is your key’s _fingerprint._
Paste this into GitLab.
(Confusingly, to add an SSH key to GitHub you need to full public key,
rather than just the fingerprint.
You can find it in `~/.ssh/id_ed25519.pub`, or whatever path you chose.)

Next, I configured Git to sign commits with my newly-generated key.
Your global Git configuration is likely
located in either `~/.gitconfig` or `$XDG_CONFIG_HOME/git/config`.
If you’re not sure, you can open it in your default editor
with `git config --global --edit`.

```ini
[user]
name = Foo Bar
email = foo@bar.org
signingkey = /Users/foo/.ssh/id_ed25519

[gpg]
format = ssh
```

You can also tell Git to automatically sign every commit
instead of having to use `--gpg-sign` every time:

```ini
[commit]
gpgsign = true
```

Unfortunately, this results in a prompt to enter your passphrase
each and every time you make a commit.
The solution to this is wonderfully simple:
first, add your key to the macOS Keychain with

```
$ ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Then, add this single line to `~/.ssh/config`:

```
UseKeychain yes
```

And now, after entering your passphrase one last time
the next time you sign a commit,
you will never have to type it again!
If you have iCloud Keychain enabled this _should_ also sync over iCloud
to any other Macs you might have,
though I don’t have another one to test this out.

Finally, you might like to confirm that everything’s worked.
You can view your commit history,
along with whether the commits have been signed with a valid signature,
using

```
$ git log --show-signature
```

If you’ve followed everything correctly so far,
this should yield something like the following output:

```
$ git log --show-signature
error: gpg.ssh.allowedSignersFile needs to be configured and exist for ssh signature verification
commit 366b70abf747b990fd4c6c239ce55bae012aabd1 (HEAD -> main)
No signature
Author: Luna Razzaghipour <lunarazzaghipour@gmail.com>
Date:   Thu Mar 2 20:12:18 2023 +1100

    Initialize repository
```

What this error message is trying to say is that
you have to tell Git what email and key combinations
you personally have reviewed to be correct (who you “trust”).

Let’s start by creating `~/.gitallowedsigners`.
If you prefer, you can use `$XDG_CONFIG_HOME/git/allowed_signers`
or whatever path you like.

Here, I’ve given my email and key for example’s sake.
Of course, you should fill in your own values instead.
You can find your public key in `~/.ssh/id_ed25519.pub`
(or whatever path you chose).
If you trust me, though, you can leave my email-key pair in there :P

```
lunarazzaghipour@gmail.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJC/Yu7JxBQSDUY013mO7L2nRl0xHQJkr0ysdE4zGeAo luna@firestorm.local
foo@bar.org public-key-here
```

Next, we need to tell Git about this file:

```ini
[gpg "ssh"]
allowedSignersFile = /Users/foo/.gitallowedsigners
```

If you now run that `git log` command from before,
you should see something like this instead:

```
$ git log --show-signature
commit 366b70abf747b990fd4c6c239ce55bae012aabd1 (HEAD -> main)
Good "git" signature for lunarazzaghipour@gmail.com with ED25519 key SHA256:Kywsc1vHG9+wPIxhxODjWIPvSdz5cteDXqpkYCB1qDo
Author: Luna Razzaghipour <lunarazzaghipour@gmail.com>
Date:   Thu Mar 2 20:12:18 2023 +1100

    Initialize repository
```

## My verdict

In summary, creating and managing keys with OpenSSH
is such a breath of fresh air,
even for someone who’s barely used GPG.
I mean, I loved it so much that I was motivated enough to write a blog post.
What more proof do you need?

I was elated to discover that keys are just text files.
There is no database of keys,
there isn’t even a directory the keys have to live in!
To reuse the default key name from the example above:
`~/.ssh/id_ed25519` contains the private key,
and `~/.ssh/id_ed25519.pub` contains the public key.
I could just as well have entered any path on the filesystem,
and everything would’ve worked perfectly.

Take fingerprints, for example: there exists a notion of a _fingerprint,_
which is essentially a shortened, transformed version of an SSH public key.
To generate this, simply run

```
$ ssh-keygen -l
```

and it’ll prompt you for a path.
This path can be either the path to a public key or a private key;
the same exact fingerprint can be derived from either.
Alternatively, you can use

```
$ ssh-keygen -lf ~/.ssh/id_ed25519
```

to avoid the interactive prompt.

Delightfully, during key generation
`ssh-keygen` prints not only the fingerprint,
but also an ASCII pictoral representation of it (“randomart”).
You can view it again after you’ve generated your key with

```
$ ssh-keygen -lvf ~/.ssh/id_ed25519
```

For example, here is the output from the key I use for signing commits:

```
$ ssh-keygen -lvf ~/.ssh/github
256 SHA256:Kywsc1vHG9+wPIxhxODjWIPvSdz5cteDXqpkYCB1qDo luna@firestorm.local (ED25519)
+--[ED25519 256]--+
|      ...        |
|     .o.         |
|    .+.o         |
|    o.=.o        |
|   . * =S.       |
|  E...=o=o       |
|  o.+o+o==+  o.  |
|   + +oooB=+ooo  |
|    .   .o==+  . |
+----[SHA256]-----+
```

You can recreate this for yourself with the following command.
Seriously, try it!
It fetches my public key from GitHub, and then runs it through `ssh-keygen`:

```
$ curl https://github.com/arzg.keys \
	| ssh-keygen -lvf /dev/stdin
```

Now, since I plan on signing every commit and tag I create,
I’ve enabled GitHub’s [vigilant mode].
This way each of my commits has
either a “Verified” or “Unverified” badge next to it.
It is my hope that, with SSH keys being so easy to work with
and with GitHub and GitLab both supporting them,
more developers will start signing their commits.

[secretive]: https://github.com/maxgoedjen/secretive
[yubikeys]: https://www.yubico.com/products/yubikey-5-overview/
[tty]: https://github.com/arzg/dotfiles/commit/45cca19c4527fb8aab92f2d30aad17fd9b7657c1
[i gave up]: https://github.com/arzg/dotfiles/commit/404711565c61725efa9d79aed702c3297715d69d
[openssh]: https://www.agwa.name/blog/post/ssh_signatures
[github]: https://github.blog/changelog/2022-08-23-ssh-commit-verification-now-supported/
[store]: https://git-scm.com/docs/git-credential-store
[cache]: https://git-scm.com/docs/git-credential-cache
[vigilant mode]: https://docs.github.com/en/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits
