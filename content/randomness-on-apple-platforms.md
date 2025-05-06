---
title: "Randomness on Apple Platforms"
date: "2024-04-08"
---

In this post I’d like to lead you through my journey trying to discover
the “best” way to obtain randomness on Apple platforms.[^pedantry]
The goal throughout will be to
get as close to the underlying hardware random number generators
as the system allows
by stripping away layers of abstraction one by one.
Once we have a comprehensive picture of the entire system,
I’ll walk you through my opinions on
which use-cases are best served by which APIs.

I’ve seen plenty of discussion on this topic
across Stack Overflow, various GitHub repos and the Apple developer forums,
so I thought it might be helpful to have
a definitive post to point people towards.

[^pedantry]:
    For the pedants among you,
    I’m only including Apple operating systems based on Darwin here,
    i.e. macOS, iOS, watchOS, tvOS & visionOS.
    (Go look up RTKit!)

## Starting with `rand(3)`

Let’s begin with the most obvious choice: `rand(3)`.
A quick trip to the manual page, though,
assures us that our journey will not come to an end so quickly:

> `rand(3)` -- **Library Functions Manual**
>
> `rand`, `rand_r`, `srand`, `sranddev` --
> bad random number generator
>
> ```c
> #include <stdlib.h>
>
> int
> rand(void);
>
> int
> rand_r(unsigned *seed);
>
> void
> srand(unsigned seed);
>
> void
> sranddev(void);
> ```
>
> These interfaces are obsoleted by `arc4random(3)`.

That’s fairly ... decisive.
What’s this `arc4random(3)`, then?

> `arc4random(3)` -- **Library Functions Manual**
>
> `arc4random`, `arc4random_buf`, `arc4random_uniform` --
> random number generator
>
> ```c
> #include <stdlib.h>
>
> uint32_t
> arc4random(void);
>
> void
> arc4random_buf(void *buf, size_t nbytes);
>
> uint32_t
> arc4random_uniform(uint32_t upper_bound);
> ```
>
> These functions use a cryptographic pseudo-random number generator
> to generate high quality random bytes very quickly.
> One data pool is used for all consumers in a process,
> so that consumption under program flow can act as additional stirring.
> The subsystem is re-seeded from the kernel random number subsystem
> on a regular basis, and also upon `fork(2)`.
>
> This family of functions provides higher quality random data
> than those described in `rand(3)`, `random(3)`, and `rand48(3)`.
> They can be called in almost all environments, including `chroot(2)`,
> and their use is encouraged over
> all other standard library functions for random numbers.

Sounds perfect!
The positive wording -- “high quality”, “very quickly” --
almost makes me think that I’d be best served by calling it a day
and just using this family of functions as-is.

You might notice that `arc4random(3)` includes a function
for filling a buffer with random bytes.
This sort of interface is the most fundamental
-- all other random number generation interfaces
can be implemented on top of it --
and it’ll appear again and again from now on.

Did you notice how the manpage mentioned `random(3)` and `rand48(3)`?
Both families of functions are ancient in interface
(dating all the way back to 1983!)
and in implementation[^impls]
(last properly changed in 1995 and 2002 respectively).
The style of this code is quite unfamiliar to me,
as someone who’s read a fair bit of open source C code from Apple.
This, along with the copious [historical debris] littered throughout the code,
make me think these implementations have barely been touched
since one of Apple’s imports of the FreeBSD libc many years ago.

Something to take note of is that `rand(3)`, `random(3)` and `rand48(3)`
don’t automatically seed themselves with random data from the OS,
instead providing interfaces for explicit seeding
(so if you call them before passing in a seed you always get the same result!),
something we won’t see again from this point onward.

To really hammer the point home,
`rand48(3)`’s manpage outright recommends `random(3)` as a replacement,
which in turn advocates using `arc4random(3)`.

[^impls]: [`random(3)` source], [`rand48(3)` source].

[`random(3)` source]: https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/stdlib/FreeBSD/random.c
[`rand48(3)` source]: https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/gen/FreeBSD/_rand48.c
[historical debris]: https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/stdlib/FreeBSD/random.c#L93

So, how does `arc4random(3)` work, anyway?
Let’s [peek into Apple’s libc](https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/gen/FreeBSD/arc4random.c#L59-L99) and find out!

```c
static struct ccrng_state *rng;

static void
arc4_init(void)
{
	int err;

	if (rng != NULL) return;

	rng = ccrng(&err);
	if (rng == NULL) {
#if OS_CRASH_ENABLE_EXPERIMENTAL_LIBTRACE
		os_crash("arc4random: unable to get ccrng() handle (%d)", err);
#else
		os_crash("arc4random: unable to get ccrng() handle");
#endif
	}
}

// ...

uint32_t
arc4random(void)
{
	uint32_t rand;

	arc4random_buf(&rand, sizeof(rand));

	return rand;
}

void
arc4random_buf(void *buf, size_t buf_size)
{
	arc4_init();
	ccrng_generate(rng, buf_size, buf);
}

// ...

uint32_t
arc4random_uniform(uint32_t upper_bound)
{
	uint64_t rand;

	arc4_init();
	ccrng_uniform(rng, upper_bound, &rand);

	return (uint32_t)rand;
}
```

Hmm, so `arc4random` is a wrapper around `arc4random_buf`,
and `arc4random_buf` and `arc4random_uniform`
just wrap this `ccrng` thingy.
Upon the first call to `arc4random_buf` or `arc4random_uniform`
the `rng` global is initialized,
crashing the process (?) if initialization fails.

## A small diversion into corecrypto

I won’t include the code here, but those `ccrng` functions
come from the private `corecrypto/ccrng.h` header,
which is part of the mysterious [corecrypto project](https://developer.apple.com/security/):

> Although corecrypto does not directly
> provide programming interfaces for developers
> and should not be used by iOS, iPadOS, or macOS apps,
> the source code is available to allow for
> verification of its security characteristics and correct functioning.

What’s interesting here is that corecrypto,
along with libc, Grand Central Dispatch and other fundamental Darwin APIs,
is included in libSystem,
meaning every binary on the system (apart from the kernel)
links to it and can access its functions.
That’s how `arc4random(3)` can call out to it given only a header file.
We can even do the same ourselves with just two declarations:

```c
#include <stdio.h>

typedef void (*rng)(void *rng, size_t len, void *p);
extern rng *ccrng(void *err);

#define countof(a) (sizeof(a) / sizeof((a)[0]))

int
main(void)
{
	int random[10] = {0};

	rng *r = ccrng(NULL);
	(*r)(r, sizeof(random), random);

	for (int i = 0; i < countof(random); i++) {
		printf("%11d\n", random[i]);
	}
}
```

```
$ clang main.c
$ ./a.out
  716107109
  270360411
   92210539
 1606613486
 1211631300
-1498184223
   37003190
 -139214872
  -25243117
 1795431186
```

It goes without saying that you shouldn’t actually do this;
corecrypto is private API, and its license forbids use
for anything other than security research.

Sadly the `rand(3)` trail we’ve been following ends here.
Before we decree that `arc4random(3)` is the “best” randomness API available,
let’s try a different angle.

## Another classic: `/dev/random`

Manpages have served us well so far, so why not start there?

> `random(4)` -- **Device Drivers Manual**
>
> `random`, `urandom` -- random data source devices
>
> The random device produces uniformly distributed random byte values
> of potentially high quality.
>
> To obtain random bytes, open `/dev/random` for reading
> and read from it.
>
> The same random data is also available from `getentropy(2)`.
> Using the `getentropy(2)` system call interface
> will provide resiliency to file descriptor exhaustion, chroot, or sandboxing
> which can make `/dev/random` unavailable.
> Additionally, the `arc4random(3)` API
> provides a fast userspace random number generator
> built on the random data source
> and is preferred over directly accessing the system's random device.
>
> `/dev/urandom` is a compatibility nod to Linux.
> On Linux, `/dev/urandom` will produce lower quality output
> if the entropy pool drains,
> while `/dev/random` will prefer to block
> and wait for additional entropy to be collected.
> With Fortuna, this choice and distinction is not necessary,
> and the two devices behave identically.
> You may use either.
>
> The random device implements
> the Fortuna pseudo random number generator algorithm
> and maintains its entropy pool.
> The kernel automatically seeds the algorithm with additional entropy
> during normal execution.

ahHA! Now we’re getting somewhere!
So, on Apple platforms `/dev/random` and `/dev/urandom`
are identical cryptographic random number generators
(which makes things a little simpler for us),
and are both implemented in [XNU] using the Fortuna RNG.
An intriguing detail here is that `getentropy(2)` returns us the same data,
but is resistant to the inherent downsides of
accessing randomness through the filesystem.
Continuing with our theme of following a thread until we reach the end,
let’s move on to `getentropy(2)` since that’s a more direct interface
to the same implementation as the randomness devices:

[XNU]: https://github.com/apple-oss-distributions/xnu

> `getentropy(2)` -- **System Calls Manual**
>
> `getentropy` -- get entropy
>
> ```c
> #include <sys/random.h>
>
> int
> getentropy(void *buf, size_t buflen);
> ```
>
> `getentropy()` fills a buffer with random data,
> which can be used as input for process-context pseudorandom generators
> like `arc4random(3)`.
>
> The maximum buffer size permitted is 256 bytes.
> If `buflen` exceeds this, an error of `EIO` will be indicated.
>
> `getentropy()` should be used as a replacement for `random(4)`
> when random data derived directly from the kernel random byte generator is required.
> Unlike the `random(4)` pseudo-devices,
> it is not vulnerable to file descriptor exhaustion attacks
> and is available when sandboxed or in a chroot,
> making it more reliable for security-critical applications.
>
> However, it should be noted that `getentropy()`
> is primarily intended for use in the construction and seeding of
> userspace PRNGs like `arc4random(3)` or `CC_crypto(3)`.
> Clients who simply require random data should use `arc4random(3)`,
> `CCRandomGenerateBytes()` from `CC_crypto(3)`,
> or `SecRandomCopyBytes()` from the Security framework
> instead of `getentropy()` or `random(4)`.

Oooooh, it’s getting even more interesting.
Skipping past the paragraph where the `getentropy(2)` manpage
reiterates what we just read about `random(4)`,
we see references to two randomness APIs we haven’t come across yet:
`CCRandomGenerateBytes` and `SecRandomCopyBytes`.
We’ll be sourcing our documentation from header files this time,
since neither has a manpage.

Here’s `SecRandomCopyBytes`’s interface as listed in the Security framework’s
[`SecRandom.h`](https://github.com/apple-oss-distributions/Security/blob/ef677c3d667a44e1737c1b0245e9ed04d11c51c1/base/SecRandom.h#L53-L77):

> `SecRandomCopyBytes` -- **Security**
>
> ```c
> int
> SecRandomCopyBytes(SecRandomRef rnd, size_t count, void *bytes);
> ```
>
> Return `count` random bytes in `*bytes`, allocated by the caller.
> It is critical to check the return value for error.
>
> Parameters:
>
> -   `rnd`: Only `kSecRandomDefault` is supported.
> -   `count`: The number of bytes to generate.
> -   `bytes`: A buffer to fill with random output.
>
> Return `0` on success, any other value on failure.
>
> If `rnd` is unrecognized or unsupported, `kSecRandomDefault` is used.

It’s weird how that `SecRandomRef` parameter only has one possible value --
maybe the people who designed the API
originally intended for there to be multiple random number generators?
Either way, if we ignore that parameter then `SecRandomCopyBytes`’s interface
is equivalent to `getentropy`’s and `arc4random_buf`’s.

We see something similar with `CCRandomGenerateBytes`,
which comes from the Common Crypto library.
Common Crypto, like corecrypto, is included in libSystem,
meaning it is automatically accessible to all programs.
This stands in contrast to `SecRandomCopyBytes` from Security.framework,
which programs must explicitly link to
if they wish to make use of its functionality.
Unlike corecrypto, Common Crypto is public and available for us to use.
[`CommonRandom.h`](https://github.com/apple-oss-distributions/CommonCrypto/blob/0c0a068edd73f84671f1fba8c0e171caa114ee0a/include/CommonRandom.h#L42-L57)
has the docs:

> `CCRandomGenerateBytes` -- **Common Crypto**
>
> ```c
> CCRNGStatus
> CCRandomGenerateBytes(void *bytes, size_t count);
> ```
>
> Return random bytes in a buffer allocated by the caller.
>
> Parameters:
>
> -   `bytes`: Pointer to the return buffer.
> -   `count`: Number of random bytes to return.
>
> Return `kCCSuccess` on success.
>
> The PRNG returns cryptographically strong random bits
> suitable for use as cryptographic keys, IVs, nonces etc.

How could Apple possibly have implemented two _more_ random number generators
on top of all the ones we’ve seen so far?!
Well, they haven’t.
`SecRandomCopyBytes` just [calls out to `CCRandomGenerateBytes`](https://github.com/apple-oss-distributions/Security/blob/ef677c3d667a44e1737c1b0245e9ed04d11c51c1/OSX/sec/Security/SecBase.c#L105-L109):

```c
const SecRandomRef kSecRandomDefault = NULL;

int SecRandomCopyBytes(__unused SecRandomRef rnd, size_t count, void *bytes) {
	return CCRandomCopyBytes(kCCRandomDefault, bytes, count);
}
```

Hold on, that’s `CCRandomCopyBytes`, not `CCRandomGenerateBytes` ...
Running a search in Common Crypto yields a result in [`lib/CommonRandom.c`],
which sounds promising.

[`lib/CommonRandom.c`]: https://github.com/apple-oss-distributions/CommonCrypto/blob/0c0a068edd73f84671f1fba8c0e171caa114ee0a/lib/CommonRandom.c

```c
/*
  We don't use /dev/random anymore, use the corecrypto rng instead.
*/
struct ccrng_state *
ccDRBGGetRngState(void)
{
	int status;
	struct ccrng_state *rng = ccrng(&status);
	CC_DEBUG_LOG("ccrng returned %d\n", status);
	return rng;
}

// ...

int CCRandomCopyBytes(CCRandomRef rnd, void *bytes, size_t count)
{
	(void) rnd;

	return CCRandomGenerateBytes(bytes, count);
}

CCRNGStatus CCRandomGenerateBytes(void *bytes, size_t count)
{
	int err;
	struct ccrng_state *rng;

	if (0 == count) {
		return kCCSuccess;
	}

	if (NULL == bytes) {
		return kCCParamError;
	}

	rng = ccDRBGGetRngState();
	err = ccrng_generate(rng, count, bytes);
	if (err == CCERR_OK) {
		return kCCSuccess;
	}

	return kCCRNGFailure;
}

CCRNGStatus CCRandomUniform(uint64_t bound, uint64_t *rand)
{
	int err;
	struct ccrng_state *rng;

	rng = ccDRBGGetRngState();
	err = ccrng_uniform(rng, bound, rand);
	if (err == CCERR_OK) {
		return kCCSuccess;
	}

	return kCCRNGFailure;
}
```

Lo and behold!
It turns out that the hitherto-unseen `CCRandomCopyBytes`
used by `SecRandomCopyBytes`
actually just forwards to `CCRandomGenerateBytes`.
Again, same as `SecRandomCopyBytes`, the `rnd` parameter is ignored.
Curiously, `CCRandomCopyBytes` [is a deprecated, private API][CCRandomCopyBytes].

In another bit of intriguing similarity,
Common Crypto makes the same trio of corecryto calls as `arc4random(3)`:

|                             purpose | corecrypto       | `arc4random(3)`      | Common Crypto           |
| ----------------------------------: | :--------------- | :------------------- | :---------------------- |
|                      initialization | `ccrng`          | `arc4_init`          | `ccDRBGGetRngState`     |
|                        random bytes | `ccrng_generate` | `arc4random_buf`     | `CCRandomGenerateBytes` |
| random int between zero and a bound | `ccrng_uniform`  | `arc4random_uniform` | `CCRandomUniform`       |

However, Common Crypto’s “random integer between 0 and a bound” API
[is private][CCRandomUniform],
while `arc4random(3)`’s is public.
A strange difference here is that the underlying `ccrng_uniform` function
returns a `uint64_t` (and as such its `bound` parameter is also a `uint64_t`)
-- `CCRandomUniform` [mirrors this][CCRandomUniform signature],
while `arc4random_uniform` [casts back and forth][arc4random_uniform casts] to a `uint32_t`.

I could continue listing all the little odd things about these APIs,
but I’ll leave it there in the interest of brevity.

[CCRandomCopyBytes]: https://github.com/apple-oss-distributions/CommonCrypto/blob/0c0a068edd73f84671f1fba8c0e171caa114ee0a/include/Private/CommonRandomSPI.h#L68-L75
[CCRandomUniform]: https://github.com/apple-oss-distributions/CommonCrypto/blob/0c0a068edd73f84671f1fba8c0e171caa114ee0a/include/Private/CommonRandomSPI.h#L85-L95
[CCRandomUniform signature]: https://github.com/apple-oss-distributions/CommonCrypto/blob/0c0a068edd73f84671f1fba8c0e171caa114ee0a/lib/CommonRandom.c#L87
[arc4random_uniform casts]: https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/gen/FreeBSD/arc4random.c#L107-L116

## Let’s review

I’ve summarized everything we know so far in the diagram below.
Parts we haven’t examined yet are identified by question marks.

{{< figure src="diagram-partial.svg" >}}

So, `rand(3)`, `rand48(3)` and `random(3)` are out of the picture
because they are bad.
`/dev/random` and `/dev/urandom` are worse than `getentropy(2)` in every way,
so we’ll ignore those too.
`SecRandomCopyBytes` just forwards to `CCRandomGenerateBytes`
(and requires linking to Security.framework),
so we won’t consider it either.
Applications aren’t allowed to use corecrypto, so `ccrng` isn’t an option.

This leaves us with `getentropy(2)`, `arc4random(3)` and `CCRandomGenerateBytes`.
Two of these are more similar than the other,
so I’ll cover how to pick between those two first.

## Should I use `arc4random(3)` or `CCRandomGenerateBytes`?

One thing I neglected to mention earlier is that `arc4random(3)`
actually only delegates to corecrypto under certain circumstances.
Namely, the entire corecrypto-based implementation
[is gated under](https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/gen/FreeBSD/arc4random.c#L56)

```c
#if defined(__APPLE__) && !defined(VARIANT_STATIC)
```

whose `#else` clause contains an alternative implementation
with a custom random number generation algorithm
which seeds itself with entropy from `getentropy(2)`.

I can’t imagine under what circumstances Apple’s libc implementation
would be compiled for non-Apple devices,
so let’s ignore that part.
From what I can tell `VARIANT_STATIC`
is used for statically-linked builds of libc,
so I’d guess this implementation is only used for the kernel’s libc?
Either way, this minor uncertainty kind of bothers me --
maybe in future someone will accidentally change that preprocessor directive
and inadvertently use the non-corecrypto implementation.
Common Crypto’s `CCRandomGenerateBytes` uses corecrypto exclusively,
so it feels “purer” to me.
(I realize this all amounts to splitting hairs
and isn’t a meaningful difference.
But hey, if you’re asking me to choose ...)

You might point out that `arc4random(3)` gives us access to `ccrng_uniform`
(albeit reduced from 64-bit to 32-bit),
which Common Crypto only provides as a private API.
I had a look into corecrypto
to see if there’s any magic going on in `ccrng_uniform`,
but it’s just yet another variation on the classic
“generate a random number below a bound without introducing bias” problem
you’ll find a million variations of on StackOverflow,
so there’s no benefit to using `ccrng_uniform` over rolling your own.
The [non-corecrypto `arc4random_uniform` implementation][arc4random_uniform old]
is almost identical, so you can take a look at that if you like.
Besides, in your own code you’ll most likely want extra APIs like

-   random float between zero and one
-   random 64-bit integer, given both a lower and upper bound
-   random float between a lower and upper bound
-   coin flip-style random boolean, given the probability of heads
-   maybe distributions other than uniform?

so saving the effort to write a singular convenience function
isn’t of any significance when you’ll inevitably take on
the burden of writing and maintaining several others anyway.
Plus, if you write it yourself there’s a chance it’ll be inlined into your code,
which isn’t possible if you’re going through a function from a system library.

[arc4random_uniform old]: https://github.com/apple-oss-distributions/Libc/blob/c5a3293354e22262702a3add5b2dfc9bb0b93b85/gen/FreeBSD/arc4random.c#L373-L412

In the end, it really doesn’t matter which you pick --
personally I prefer `CCRandomGenerateBytes` for its assured simplicity,
and since I don’t mind writing a `CCRandomUniform` equivalent myself.

## Should I use `CCRandomGenerateBytes` or `getentropy(2)`?

I’ve taken the liberty of tracing random number generation
through the kernel and through corecrypto,
which fleshes out the picture from before a little:[^unfinished]

{{< figure src="diagram-full.svg" >}}

[^unfinished]:
    I sunk way more time into this than I’m willing to admit,
    and at one point I decided to cut my losses and leave the diagram unfinished.
    I got super confused by `cckprng` calling, seemingly recursively,
    back into `getentropy(2)`???
    No idea what’s going on there.
    Never did I manage to trace where the randomness _truly_ comes from.

With this extra context, we’re better equipped to answer the question.
The two APIs are very different:
one calls directly into the kernel, limits you to a buffer size of 256 bytes,
and gets us as close as we can get[^secure enclave]
to the random number generation hardware;
the other uses the former to periodically[^ccrng period] seed
a (presumably highly-optimized) AES-based random number generator
which runs in-process.

## Non-security-critical use-cases

Let’s begin by considering non-security-critical use-cases.
Maybe you’re making a game, doing some stochastic path tracing,
or making a [hashmap with random iteration order][go maps].
For all these cases, the generator’s output doesn’t have to be perfectly random;
it just has to look “random enough”.
For these cases something like a [PCG-based generator] or [wyrand] is sufficient,
and `CCRandomGenerateBytes` (let alone `getentropy(2)`) would be overkill
(and far slower, for sure).

If I’m suggesting a custom RNG for these scenarios,
where does that RNG get its seed from?
Given that these non-cryptographically-secure random number generators
have periods that reach easily into the quintillions,
you’ll only have to seed the generator once during startup.
Thus, the time taken to generate a seed is immaterial.
Since uniformly-distributed random data doesn’t magically get “more random”
by passing it through successive random number generators
(no matter how cryptographically-secure they may be),
you might as well just generate seeds using `getentropy(2)` directly
and avoid the indirection introduced by `CCRandomGenerateBytes`.
We’re only generating a seed once,
so the performance gains from
layering AES on top of the kernel’s random number generator in userspace
aren’t important to us.

However, there’s a problem:
out of all the Darwin-based operating systems,
macOS is the only one that supports `getentropy(2)` as a public API.
Although, yes, using `getentropy(2)` to generate seeds
may technically be more optimal,
we have to remember the use-case -- it just doesn’t matter.
So, for simplicity, I’d suggest using `CCRandomGenerateBytes` on all platforms
to seed random number generators which don’t have to be cryptographically secure.

## Security-critical use-cases

Moving on to security-critical workloads like generating encryption keys:
please just call `CCRandomGenerateBytes`.
`getentropy(2)` is too slow and is too limited in output size
to be used directly for generating random data.
Instead, as the manpage suggests,
it should be used to seed other, faster userspace generators
(which is what `ccrng` does!).
Writing your own cryptographically-secure random number generator is risky:
bugs in your hand-rolled RNG won’t be detected as quickly as
those in an extremely-widely-deployed RNG like `ccrng`,
and I doubt you have the time to optimize it like Apple does.

[PCG-based generator]: https://en.wikipedia.org/wiki/Permuted_congruential_generator
[wyrand]: https://github.com/wangyi-fudan/wyhash
[go maps]: https://nathanleclaire.com/blog/2014/04/27/a-surprising-feature-of-golang-that-colored-me-impressed/

[^secure enclave]: The kernel
[seeds its random number generator](https://support.apple.com/en-us/guide/security/seca0c73a75b/web)
from, among other sources,
the Secure Enclave’s hardware random number generator.
So, it might be possible to get closer to “true randomness”
by [generating key pairs on the Secure Enclave](https://developer.apple.com/documentation/security/certificate_key_and_trust_services/keys/protecting_keys_with_the_secure_enclave)
and using the bytes of the CPU-accessible half of the key pair.

    This doesn’t get us _all the way_ though,
    since the Secure Enclave’s TRNG actually
    [layers AES on top](https://support.apple.com/en-us/guide/security/sec59b0b31ff/1/web/1#sec285763cef)
    of the ring oscillators (?) it uses.
    There’s probably a very good reason for this,
    but I mean _come on_ --
    `ccrng_generate` is an AES layer on top of `cckprng`,
    which (I think) is a Fortuna layer on top of the Secure Enclave’s TRNG,
    which is another AES layer on top of
    whatever these ring oscillator thingies are!!
    I have absolutely no idea about any of this stuff,
    and I’m sure the people working on this know what they’re doing,
    so it’s probably all very reasonable.
    It is quite amusing to me, though.

[^ccrng period]: I briefly saw something in the corecrypto source
which mentioned a reseed period of five seconds,
though it could be that was for something else.
Given what I saw about different ways a reseed can be triggered,
I imagine there’s things which could cause a `getentropy(2)` call
outside of the every-five-seconds schedule.
