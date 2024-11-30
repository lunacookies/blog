---
title: "macOS Tips for Programmers: Threading"
date: "2024-11-25"
---

Most people writing code that ends up running on macOS machines
aren’t super familiar with the operating system,
its unique features or its rough edges.
That’s okay!
If you’re a programmer using macOS
and your code will actually end up running on a Mac
rather than a server somewhere or whatever
-- even if your software isn’t a user-facing graphical application --
then this post is for you.

I’ve laid this post out in a typical “problem--solution” format,
interspersed with **Recommandation**s which I’d encourage you to adopt.

## Motivation

Energy consumption is one of Apple’s highest priorities.
Sipping energy means batteries last longer,
laps remain cool and fans stay silent.
Their processors have a massive dynamic range in power consumption:
the CPU in my laptop, a 10-core M1 Pro,
can scale from consuming 10 mW sitting on the desktop to 40 W at full tilt,
a ratio of 1 to 4,000.
You can see other examples of the sliding scale
between low energy consumption and high performance
in the GPU, memory bus, flash storage, and so on.
As a result of this dynamicism, a crucial aspect of optimizing energy consumption
is knowing what work it’s worth ramping up the system for
versus what work doesn’t care about wall clock performance very much,
and which work you prioritize when there’s contention.

Really take a moment to think about this:
you have a processor which can consume between 10 and 40,000 mW
-- 4,000 _times_ more power --
depending on what sort of state the kernel tells it to be in.
Figuring out where each chunk of code should sit on that scale
is incredibly important.

Apple’s solution to prioritize work effectively is to assign a “semantic tag” to all work
which indicates how important it is to the user that the work is completed quickly.
These tags are called “quality of service classes”, or QoS classes.
There are five[^maintenance] QoS classes. In order of priority:

User Interactive
: your app’s user interface will stutter if this work is preempted

User Initiated
: the user must wait for this work to finish before they can keep using your app,
e.g. loading the contents of a document that was just opened

Default
: [used as a fallback][guide] for threads which don’t have a QoS class assigned

Utility
: the user knows this work is happening but doesn’t wait for it to finish
because they can keep using your app while it’s in progress,
e.g. exporting in a video editor, downloading a file in a web browser

Background
: the user doesn’t know this work is happening, e.g. search indexing

These are applied extremely aggressively throughout the system,
from CPU scheduling decisions, I/O throttling,
whether to run a process on the CPU’s efficiency or performance cores,
to timer coalescing settings.
There’s several applications of QoS which are more unusual, too:
Background QoS work is paused when in Low Power Mode on iOS;
the CPU scheduler is fundamentally [structured around QoS][sched-clutch-edge];
and requests to the SoC’s last level cache
are [tagged with QoS _in hardware_][patent]!
(Well, _maybe,_ it’s just a patent,
but I wouldn’t put it past Apple to do something like that.)

## Synchronization

You might have heard that [thread priorities are evil]
because you can end up with all sorts of tricky deadlock-ish bugs;
say, if you have a high-priority thread
consuming data being produced by a low-priority thread,
and the thread priorities work out such that
the producer keeps being preempted by the consumer,
slowing progress down to a crawl
-- a priority inversion.
And you’d be right!
Using thread priorities is a dangerous game,
and doubly so when they’re applied as pervasively and forcefully
as they are on Apple platforms.

Thankfully, Apple platforms include mechanisms so you can
have your energy efficiency and eat it too!
The kernel knows the QoS of everything on the system,
so it can resolve priority inversions across thread and process boundaries,
but only if you use certain synchronization primitives.
It goes without saying that
you’d be right back in “thread priorities are evil” land
if you don’t use these primitives.
There are only a few:

- `pthread_mutex`
- `os_unfair_lock`
- Dispatch queues and workloops
- Mach messages

If a high QoS thread tries to take a lock held by a low QoS thread
_and the lock being used is `pthread_mutex`, `os_unfair_lock`,
or a lock built on either of these,_
then the low QoS thread will have its QoS boosted
to match that of the high QoS thread
until it releases the lock.
The same thing works for inter-process communication over Mach messages,
or indeed any IPC mechanism built on them (such as XPC).

**Recommendation**: avoid reader/writer locks,
semaphores and custom lock implementations
since they can’t participate in QoS inheritance.
Instead prefer `os_unfair_lock` where possible
(and if not `os_unfair_lock` then `pthread_mutex`).
Ignore this advice at your peril.
And no, [you aren’t safe if you don’t use QoS classes][bazel]
since everything else on the system does.

There’s another interesting aspect to these priority-inheriting primitives.
Imagine you have some code that’s sitting there pre-calculating data,
and then suddenly a request comes in for the data you’re pre-calculating.
Assuming the pre-calculation code is running at a low QoS,
is holding a lock on the data,
and the requesting code tries to acquire the lock,
with priority inheritance the pre-calculation code
will have its QoS boosted automatically
until the pre-calculation is finished and the request has been fulfilled.
Given how little impact code running at Background has on the rest of the system,
with QoS and priority inheritance
you can prefetch more aggressively than on other operating systems,
knowing that your QoS will be boosted only when needed.

## Prioritizing work

When you make a new thread its QoS class defaults to, well, Default,
which isn’t what you want.
At minimum, consciously decide how important the work that thread is doing is
and assign a QoS class to the thread with `pthread_set_qos_class_self_np(3)`.
If you don’t do this you can easily end up in scenarios
where tons of User Interactive and User Initiated work
is prioritized over your thread when the system comes under load.
(It’s worth noting that the main thread is
automatically assigned the User Interactive QoS class,
which might be inappropriate for your context
-- say, a command-line tool that performs heavy computation on the main thread.)

In my experience, most of the time it isn’t possible to
cleanly assign a single priority to a thread.
For example, take a thread that acts as a database,
periodically syncing data to disk
while other threads in the program send it messages
asking for data to be retrieved or saved.
With these kinds of actor-like threads,
it isn’t the _thread_ that has a priority, but _the requests themselves._
You could try to have callers track their own priority,
and the callers of those callers track theirs, etc,
but really it isn’t possible to solve 100% without kernel integration.

The built-in Dispatch library
lets you create these actor-like threads very easily.
Instead of threads you use _workloops,_
which are like threads except that you can queue up multiple worker functions
instead of just one when you create the thread.
Dispatch handles all the priority inheritance stuff for you,
changing the underlying thread’s QoS automatically
and reordering work items by QoS.

Dispatch also has _queues,_
which are like workloops except that they maintain submission ordering
in case that’s something you need.
(Dispatch treats workloops as a “subclass” of queues, for what it’s worth.)

**Recommendation**: replace your program’s threading with Dispatch.

Apple frameworks often assume that you’re using Dispatch
(e.g.
[`nw_connection_set_queue`](<https://developer.apple.com/documentation/network/nw_connection_set_queue(_:_:)?language=objc>),
[`xpc_connection_set_target_queue`](https://developer.apple.com/documentation/xpc/1448786-xpc_connection_set_target_queue?language=objc),
[`FSEventStreamSetDispatchQueue`](https://developer.apple.com/documentation/coreservices/1444164-fseventstreamsetdispatchqueue?language=objc))
so using it pervasively might make your life easier later on.

[^maintenance]:
    There’s a little-known sixth QoS class, Maintenance,
    which sits below Background, even.
    Accessing it from regular programs requires private API.
    I suspect you might be able to [use XPC activities to access it](https://developer.apple.com/documentation/xpc/xpc_activity_priority_maintenance?language=objc),
    though I haven’t tested this.

[sched-clutch-edge]: https://github.com/apple-oss-distributions/xnu/blob/8d741a5de7ff4191bf97d57b9f54c2f6d4a15585/doc/scheduler/sched_clutch_edge.md#scheduling-bucket-level
[patent]: https://patents.google.com/patent/US9053058B2/en
[bazel]: https://jmmv.dev/2019/03/macos-threads-qos-and-bazel.html
[thread priorities are evil]: https://blog.codinghorror.com/thread-priorities-are-evil/
[guide]: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/PrioritizeWorkAtTheTaskLevel.html
