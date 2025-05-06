---
title: "Cocoa Basics Part One: The Application Structure"
date: "2025-05-06T00:00:01"
---

In the last part I took a bit of a shortcut:
I had you compile and run a Mac app as a single executable.
This isn’t how Mac apps are supposed to be built.
Although they appear as single “files” in the Finder,
a Mac app is what’s known as a _package_
-- a directory that appears as a file in the user interface.
(It’s worth pointing out that the term _folder_ is used
to refer to directories which aren’t packages.)

## Packaging

Files have file types, which are
rules surrounding the arrangement of the bytes contained in the file.
Packages have the same but for their internal directory structure.
Mac apps are a type of package known as a _[bundle],_
used to contain executable code and associated resources.
There are several types of bundle, each with their own structure:
Mac apps, frameworks, iOS apps, and so on.

[bundle]: https://developer.apple.com/library/archive/documentation/CoreFoundation/Conceptual/CFBundles/AboutBundles/AboutBundles.html

The directory structure of a Mac app is quite simple:

```
My App.app/
└── Contents/
    ├── Info.plist
    ├── MacOS/
    │   └── My App
    └── Resources/
        └── arbitrary resource files go here ...
```

`My App` is the actual executable,
`Resources` contains whatever resource files the app needs,
and `Info.plist` holds metadata about the application.

In case you aren’t familiar, a _property list_ file, or _plist,_
is Apple’s flavor of key-value structured data format,
similar in spirit to JSON.
Plists come in several formats,
including an efficient binary format,
an ergonomic but unfortunately deprecated and not-Unicode-aware textual format,
and XML (yuck).
macOS comes with a command-line utility named `plutil` which,
among other useful functions,
can translate between the two extant formats as well as JSON.

What sort of metadata, then, does `Info.plist` actually contain?
There’s a small number of keys that are mandatory[^mandatory] for all types of bundles:

[^mandatory]:
    Technically you can avoid specifying some of these keys
    and things will still appear to work,
    but it’s generally not a good idea.
    For example, if you omit the `CFBundleExecutable` key
    the system will simply use the bundle’s name on the filesystem
    as the executable’s name,
    which means your app will stop working
    if the user decides to rename it from the Finder.

`CFBundleInfoDictionaryVersion`
: what version of the `Info.plist` format this bundle uses (the latest is 6.0)

`CFBundleIdentifier`
: a unique identifier for this bundle in [reverse-DNS] format

`CFBundlePackageType`
: what type of bundle this is, e.g. `APPL` for applications,
`FMWK` for frameworks, and so on

`CFBundleExecutable`
: the filename of the bundle’s executable

`CFBundleDisplayName`
: the user-visible name of the bundle

[reverse-DNS]: https://en.wikipedia.org/wiki/Reverse_domain_name_notation

Let’s create a folder `Data ` to store
all the miscellaneous data files associated with our app,
and create a new file named `Info.json` in that folder:

```json
{
	"CFBundleInfoDictionaryVersion": "6.0",
	"CFBundleIdentifier": "org.xoria.blog.Counter",
	"CFBundlePackageType": "APPL",
	"CFBundleExecutable": "Counter",
	"CFBundleDisplayName": "Counter"
}
```

Let’s also make a new folder called `Source` to hold all our code
and move `main.swift` into it.
We’re now ready to write our build script
to create the application structure I described earlier!
In `Scripts/build` (which you should mark as executable):

```sh
#!/bin/dash

set -e

swift format --in-place Source/*.swift

buildDirectory="Build"
infoJSONPath="Data/Info.json"

rm -rf "$buildDirectory"

bundleName=$(jq --raw-output ".CFBundleDisplayName" < "$infoJSONPath")
executableName=$(jq --raw-output ".CFBundleExecutable" < "$infoJSONPath")
bundlePath="$buildDirectory/$bundleName.app"

mkdir -p "$bundlePath/Contents"
plutil \
	-convert binary1 \
	-o "$bundlePath/Contents/Info.plist" \
	"$infoJSONPath"

mkdir -p "$bundlePath/Contents/MacOS"
swiftc \
	-o "$bundlePath/Contents/MacOS/$executableName" \
	"Source/main.swift"
```

We start by clearing out the entire build directory each time,
then convert the JSON `Info.plist` into the binary format,
and finally compile the actual executable.
Note that I’ve used the `dash` shell
(which comes pre-installed since macOS 10.15 Catalina)
rather than the more typical `bash` or `sh`
because it’s faster and forces us to be POSIX compliant.
`set -e` makes the shell exit on the first error it encounters.

After you’ve run the build script,
an app named “Counter” should appear in the Build folder.
How do you run it, though?
My preferred way of running apps during development
(so I can see logs and such)
is to run them in a debugger.
Let’s use the debugger that comes with Xcode, LLDB:

```
$ lldb Build/Counter.app
(lldb) target create "Build/Counter.app"
Current executable set to '/Users/luna/Developer/CocoaBasics/Build/Counter.app' (arm64).
(lldb)
```

To run the app, type `r` and hit enter.

{{< screenshot src="counter-in-dock" caption="Our new Counter app in the Dock." >}}

The app now has not only a name, but also the system default app icon!
We’re finally getting somewhere, it feels like.

## The app delegate

With all that out of the way, how do we actually run code in our app?
That final `NSApp.run()` call in `main.swift` never actually returns,
so it isn’t like we can just tack on some code underneath.
To answer this question we’ll need to learn a bit about
how Cocoa handles our app’s lifecycle.

Apps are represented as instances of the `NSApplication` class,
which has reasonable-sounding methods like `terminate(_:)` and `activate()`.
`NSApplication` has a type property named `shared`
which returns the `NSApplication` instance corresponding to the current app.
The instance is created the first time `NSApplication.shared` is accessed.
There exists a confusingly-named global variable
`NSApp`, of type `NSApplication`,
which is automatically initialized to the value of `NSApplication.shared`
when that property is accessed for the first time.
This lets us write `NSApp` instead of `NSApplication.shared` everywhere --
we just need to access `NSApplication.shared` once
at the beginning of our program.

`NSApplication` also has an instance property, `delegate`.
Delegation is a very important concept in Cocoa.
A common approach to customizing existing objects in object-oriented languages
is to subclass.
This is fraught with danger, though, because [inheritance is fragile]:
it often isn’t clear if or when you need to call the superclass’s implementation
and whether you’re even allowed to override certain methods,
which in turn can lead to subtle bugs when the superclass is modified.
Delegation turns this idea on its head:
rather than let the client override anything they want however they want,
you instead have the object explicitly expose _customization points,_ or “hooks”,
which give the client a chance to run custom logic at particular times.

[inheritance is fragile]: https://www.tedinski.com/2018/02/13/inheritance-modularity.html

Let’s say we wanted to print some text right before the application quits.
Using subclassing we’d write something like this:

```swift
class Application: NSApplication {
	override func terminate(_ sender: Any?) {
		print("terminating!")
		super.terminate(sender)
	}
}
```

With delegation we instead assign an existing object a delegate
(the object that receives callbacks when customization points are reached):

```swift
NSApp.delegate = AppDelegate()

class AppDelegate: NSObject, NSApplicationDelegate {
	func applicationWillTerminate(_ notification: Notification) {
		print("terminating!")
	}
}
```

The original object calls us, rather than the other way around.
You’ll often see Apple name methods using `Will` and `Did`
to indicate whether they’re called before or after some event occurs.

Let’s try this in our actual `main.swift`!

```swift
import AppKit

let _ = NSApplication.shared // initialize NSApp

// That `setActivationPolicy` line from before doesn’t do anything now,
// so we’ll remove it. (It was there for uninteresting reasons.)

NSApp.delegate = AppDelegate()
NSApp.run()

class AppDelegate: NSObject, NSApplicationDelegate {
	func applicationWillTerminate(_ notification: Notification) {
		print("terminating!")
	}
}
```

Sadly, when we try to compile this we’re greeted with a compile error:

```
Source/main.swift:4:16: warning: instance will be immediately deallocated because property 'delegate' is 'weak'
 2 |
 3 | let _ = NSApplication.shared
 4 | NSApp.delegate = AppDelegate()
   |                |- warning: instance will be immediately deallocated because property 'delegate' is 'weak'
   |                `- note: a strong reference is required to prevent the instance from being deallocated
 5 | NSApp.run()
 6 |
```

Look familiar to anyone else?
I’m getting flashbacks to the Rust borrow checker ...
Swift’s memory management isn’t like that, though.

## Reference counting

Swift uses a memory management strategy called
Automatic Reference Counting, or ARC.
Under this scheme every object maintains a “retain count”
which tracks how many other objects are referring to it.
Whenever an object starts relying on the existence of another object
it increments that object’s retain count (the object is _retained_),
and when it stops relying on that object
it decrements the retain count (the object is _released_).
An object’s retain count reaching zero indicates, of course,
that no other objects retain that object anymore,
and so it can safely be deallocated.
The compiler automatically inserts calls to
retain and release objects where necessary.
The main weakness of ARC is that it can’t handle cycles:

-   If object A retains object B,
-   and if B retains A,
-   and if A only releases B when A is deallocated,
-   and if B only releases A when B is deallocated,

then neither object will ever reach a retain count of zero,
so neither object will ever be deallocated,
so neither object will ever reach a retain count of zero,
and so on.
See the problem?
Though no other objects retained A or B,
they keep each other alive.
We have created a memory leak.

What does any of this have to do with delegation, though?
Delegates often retain the objects they’re delegates of.
For instance, imagine we have a class that created a window
and has stashed the window away in a `myWindow` property.
Now, the class wants to customize the window’s behavior.
To do this it makes itself the window’s delegate,
which means the window now retains the class.
The class retains the window due to the `myWindow` property, though,
so we’ve now created a retain cycle:
the class retains the window, and the window retains the class.

To solve this, delegate properties are typically made “weak”,
meaning that they don’t retain the objects they’re set to.
As a result, the delegate might actually be deallocated
while the original object still exists.
The object doesn’t “hold onto” its delegate tightly enough
to stop it from going away.
When this happens the delegate property is automatically set to `nil`.

Back to our error, then.
The compiler wasn’t happy with this line:

```swift
NSApp.delegate = AppDelegate()
```

Now you can hopefully see why!
The newly-created `AppDelegate` instance is never retained
since the `delegate` property is weak.
The `AppDelegate` instance is immediately deallocated,
which in turn sets the `delegate` property back to `nil`.
To solve this error we can retain the `AppDelegate` instance ourselves:

```swift
let _ = NSApplication.shared
let appDelegate = AppDelegate()
NSApp.delegate = appDelegate
NSApp.run()
```

Running the app now results, as you’d expect, in
`terminating!` being printed to stdout when you quit the app:

```
(lldb) r
Process 32576 launched: '/Users/luna/Developer/CocoaBasics/Build/Counter.app/Contents/MacOS/Counter' (arm64)
terminating!
Process 32576 exited with status = 0 (0x00000000)
(lldb)
```

And there you have it!
In the next post we’ll _finally_ get started
on making things appear on the screen.
