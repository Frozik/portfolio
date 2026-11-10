# Android e2e in about a minute

How the Android apps ([Calls Filter](../../../../apps/calls-filter/README.md),
[Ciphra Vault](../../../../apps/vault-native/README.md)) run their end-to-end tests on an
emulator fast and without hanging. Calls Filter went from about 5 minutes to about 35 s, the vault
from 2 min to about 12 s. This folder holds what both share — the TypeScript side, and the agent
the tests drive the screen through (`../../android-agent`); each app keeps its own
`e2e-android.sh` and `e2e/*.e2e.mts`.

## Why UI tests on a phone are slow

The usual tool, Maestro, drives the app from outside, as a user would. Before and after every tap it dumps the
whole view tree until the screen stops changing: about 2.4 s a tap. It types one key at a time,
scrolls one swipe at a time, waits out an `optional` element that never comes (about 7 s), and
starts a JVM for every flow (5–7 s). A suite of chained flows — create a group, then give it a
schedule, then… — repeats all of that just to get the app into a state.

## The ideas

1. **On the phone, only what only a phone can show.** A real call answered by the screening
   service, Android's permission dialog, a map in a WebView, a window kept from screenshots,
   Argon2 and the keystore. Everything else — a screen's logic, its sheets and edits — is a Jest
   test with React Native Testing Library over a phone of fakes, in milliseconds.

2. **A command channel, like WebMCP for the test.** [WebMCP](https://developer.chrome.com/docs/ai/webmcp)
   lets a browser agent call a page's typed tools instead of guessing at its DOM. Here the test
   calls the app's commands over `adb shell` instead of tapping its way to a state:

   ```
   adb shell am broadcast -a <app>.E2E -p <app> --es payload <base64 JSON>
     → a receiver in the app hands the command to JavaScript
     → the command runs the same edits the screens run
     → the answer comes back as the broadcast's result data (base64 JSON)
   ```

   «Create the group Spam with this number», «what did the service answer this number», «what
   does the app know of this place» take about 35 ms, of which 20 are `adb` itself. The channel exists only in the APK built
   for the tests (`BuildConfig.E2E`, set by an environment variable at build time); a release
   build refuses to open it, and only senders holding `android.permission.DUMP` — the shell and
   the system, no app — reach it. An app that must not have one, like the password vault, does
   without: its tests drive the state through the flow that is under test anyway.

3. **Seed and check through the channel, act through the UI only when the action is the
   subject.** A test of the move button seeds a call, taps the button, then asks the app where the
   number went — no screenshots or view-tree reads to assert, no screens walked to get there.
   A test of the service needs no UI at all.

4. **Every test stands alone.** It resets the app's state and uses data of its own (a fresh phone
   number per test), so any test runs alone and in any order, and none pays for another's setup.

5. **Events, not sleeps.** Every wait polls something cheap until it happens (100 ms steps) and is
   bounded only to catch a hang: a call is hung up the moment the service has answered, the next
   one dialled the moment the line is idle. Each test has a limit far above its normal time; one
   that runs past it fails, and the screen, the view tree and logcat land in `e2e-artifacts/`,
   which CI uploads.

   A fresh emulator's Play services restart themselves while they update, and Android takes
   their clients down with them — an app whose map holds Play services' fonts provider among
   them. When the app stops answering because its process is gone, `app-death.ts` reads logcat
   since the app's start: a process it depended on dying, or memory running out, lets the test
   start the app again — once, with the reason printed; a crash, an ANR or a forced stop fails the
   test as before. A retry of the whole test would hide the app's own crashes too.

6. **The phone's state from `adb`, not from the screen.**
   - calls: `adb emu gsm call` / `cancel`, the answer read from the service's journal;
   - position: `adb shell cmd location` test providers for `gps` and `network` (Play services
     builds its fix from those; a `fused` test provider is not seen);
   - calendars: `content insert` into the calendar provider;
   - permissions: `pm grant` / `pm revoke`;
   - the window's flags (`SECURE`): `dumpsys window windows`.

7. **An agent on the phone sees the screen; the test asks it.** Maestro and `uiautomator dump`
   start anew for every look at the screen — `uiautomator` alone needs about two seconds to start
   a VM, connect to accessibility and dump the tree, while finding an element in it takes
   microseconds. The agent (`libs/tooling/android-agent`) is an instrumentation test that never
   ends: started once per run, it keeps UiAutomation connected and serves on a socket the runner
   forwards with `adb forward`. Any app's window, the system's dialogs included, through
   accessibility, as the user sees it:
   - `locate` — where the element with this `testID` (or another app's resource id) is, whether it
     is wholly on screen, enabled, checked: **about 50 ms**, against 2 s for a dump;
   - `setText` — a field's text set through accessibility: three fields in a tenth of a second,
     no keyboard opening, so none to close; React Native sees it as typed;
   - `dump` — the view tree for a failed test's evidence (a `uiautomator dump` of its own would
     take UiAutomation away from the agent: Android allows one connection).

   Taps stay `adb shell input tap` at the element's middle. Fast looks bring out what slow ones
   hid, and each has its event to wait for, never a pause:
   - a tap waits for its element to be enabled and still (two reads 100 ms apart agree);
   - the effect of a tap is waited for, not assumed — a switch reported checked before the form it
     reshapes is used;
   - window animations are off for the run (`window_animation_scale` and its two siblings, restored
     afterwards): Android moves a sliding sheet or a growing dialog by window transforms that
     accessibility does not report, and a tap mid-way lands beside it — outside a permission
     dialog it even denies the permission;
   - Android's permission dialog ignores touches while it appears, so `tapUntilGone` taps until
     the dialog is gone;
   - an element found and gone before it is measured — a row just deleted — is reported absent,
     and a command that breaks answers as failed: an exception left to escape would end the agent,
     and every test after it would fail with «fetch failed»;
   - `launch` asks `monkey` for no system keys, which it otherwise refuses to send on a device
     without them (an emulator with no hardware keyboard).

   The agent ships in no app: it is built and installed only for the run. Against Maestro the
   vault's journey went from 75 s to 9 s; Calls Filter's map test from 20 s to 4 s, its
   permission test from 14 s to under 3 s.

8. **Straight to the screen, nothing to scroll for.** A test opens its screen by a link
   (`openLink`) instead of walking there, a long form keeps its action pinned at the bottom,
   and a dialog that may not come is not waited for.

9. **Measure before optimising.** `node --test` reports every test's time; a test that is slow
   gets its steps timed before anything changes — that is how the two seconds of a dump, the
   half second of a merged journal read and the twenty of a position never coming were found.

## What lives where

- `device.ts` — `adb`, `waitFor`, `keepEvidence(name)`.
- `app-death.ts` — `whyAppDied(logcat, package)`: killed by the system, crashed, stopped.
- `agent.ts` — the agent's client: `locate`, `setText`, `dumpViewTree`.
- `screen.ts` — `tap`, `tapUntilGone`, `fill`, `scrollIntoView`, `waitForElement` (with the state
  expected of it), `waitForAbsent`, `openLink`, `launch`, `launchClean`.
- `../../android-agent` — the agent (Java, `androidx.test.uiautomator`), built with its own Gradle
  wrapper; `../../scripts/android/e2e-agent.sh` builds, installs, starts and stops it, and switches
  the window animations off and back.
- `e2e-test.ts` — `defineE2eTest(prepare)`: an app's `e2eTest(name, limit, body)`, with the hang
  guard and the evidence.
- In an app: `e2e-android.sh [--prebuilt] [--only <pattern>]` builds (with the channel switched
  on where there is one), installs, grants, starts the agent and runs `node --test` over
  `e2e/*.e2e.mts`; the TypeScript runs straight in Node 24.
- The APK build (`build-apk`) runs `expo prebuild --clean` only when what it makes `android/`
  from has changed: `../../scripts/android/prebuild.sh` keeps a key — the Expo fingerprint of the
  native modules, plugins and dependencies, plus the variables the app's config reads — in
  `android/.prebuild-key`. Otherwise Gradle builds incrementally: about 15–35 s instead of 85 s.
