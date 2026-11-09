# Android e2e in about a minute

How the Android apps ([Calls Filter](../../../../apps/calls-filter/README.md),
[Ciphra Vault](../../../../apps/vault-native/README.md)) run their end-to-end tests on an
emulator fast and without hanging. Calls Filter went from about 5 minutes to about 35 s, the vault
from 2 min to about 55 s. This folder holds what both share; each app keeps its own
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
   does the app know of this place», «where is the button `place-save`» take about 35 ms, of
   which 20 are `adb` itself. The channel exists only in the APK built
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

6. **The phone's state from `adb`, not from the screen.**
   - calls: `adb emu gsm call` / `cancel`, the answer read from the service's journal;
   - position: `adb shell cmd location` test providers for `gps` and `network` (Play services
     builds its fix from those; a `fused` test provider is not seen);
   - calendars: `content insert` into the calendar provider;
   - permissions: `pm grant` / `pm revoke`;
   - the window's flags (`SECURE`): `dumpsys window windows`.

7. **The test drives the screen itself, over `adb`.** `screen.ts` taps an element's middle with
   `input tap` and types with `input text` — a whole password in a tenth of a second where Maestro
   types a key at a time; no JVM to start per flow, no settling around every tap. Where an element
   is comes from a locator:
   - **an app with a channel answers natively** — `locate` walks the app's own windows
     (`WindowInspector`, the sheets' windows too) for the view whose React Native `testID` matches
     and returns its rectangle and whether it is enabled: **about 35 ms**;
   - **otherwise `uiautomator dump`** — any app's window (Android's permission dialog, the vault),
     **about 2 s** a read whatever the screen, since the tool starts anew each time.

   A tap waits for its element to be enabled and — with the fast locator — to stop moving (two
   reads apart give the same place): a sheet sliding in reports where it is mid-way, and a dump
   only hid that by being slow. Against Maestro the vault's journey went from 75 s to 52 s; with
   the channel locating views, Calls Filter's map test went from 20 s to 4 s.

8. **Straight to the screen, nothing to scroll for.** A test opens its screen by a link
   (`openLink`) instead of walking there, a long form keeps its action pinned at the bottom,
   and a dialog that may not come is not waited for.

9. **Measure before optimising.** `node --test` reports every test's time; a test that is slow
   gets its steps timed before anything changes — that is how the two seconds of a dump, the
   half second of a merged journal read and the twenty of a position never coming were found.

## What lives where

- `device.ts` — `adb`, `waitFor`, `keepEvidence(name)`.
- `screen.ts` — `screenDriver(locate)`: `tap`, `fill` (taps a field, types at once),
  `scrollIntoView`, `waitForElement`, `waitForAbsent`; `locateByDump` as the default locator; and
  `hideKeyboard`, `openLink`, `launch`, `launchClean`.
- `e2e-test.ts` — `defineE2eTest(prepare)`: an app's `e2eTest(name, limit, body)`, with the hang
  guard and the evidence.
- In an app: `e2e-android.sh [--prebuilt] [--only <pattern>]` builds (with the channel switched
  on where there is one), installs, grants, and runs `node --test` over `e2e/*.e2e.mts`; the
  TypeScript runs straight in Node 24.
