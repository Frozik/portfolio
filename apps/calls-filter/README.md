# Calls Filter — an Android call screener

Incoming calls are sorted into groups the user builds. Every call lands in exactly one group,
and that group's policy decides whether it rings: let it through or block it — and, with
«a repeat call rings» on, a blocked number that calls again within minutes rings. A policy can follow a schedule, the user's calendars and holidays,
and it can be overridden for a while — «let couriers through for three days».

Built with Expo SDK 57 (React Native 0.86, the New Architecture, Hermes) and Expo Router.
The screening itself is a Kotlin `CallScreeningService` in the local Expo module
`modules/call-screening`, so a call is answered in a few milliseconds even when the app's
JavaScript is not running.

## Groups

- **The user's groups** («Spam», «Delivery», «Work», «Family» — the app ships none and guesses
  none). A group has an include list and an exclude list of
  - **number masks** — digits, `.` for any digit, `*` for any run, `{n}` / `{n,m}` repeats, `+`
    and the separators `( ) -`; for example `+7 921 2{1,2}*.{3}5`. They are written as the
    user dials, and the home country's trunk prefix is understood (`06…` in the Netherlands is
    `+316…`);
  - **name masks** — the same syntax over the name the network sends or the contact's name,
    matched case-, accent- and space-insensitively;
  - **contacts** picked from the address book;
  - **special masks** — hidden numbers, foreign, premium-rate, VoIP, toll-free: a row of
    icons, holding one explains it. The kind of a number comes from its country's numbering
    plan (libphonenumber), so toll-free is 0800 in the Netherlands, 8 800 in Russia and 1-800
    in the US alike.

  «Exclude my contacts» keeps a mask from catching the people in the address book.
- **My contacts** — every contact, with its own exclude list. A contact the user adds to
  another group leaves it by itself.
- **Strangers** — the calls no group takes by number or by name. Nothing is added by hand: it
  fills from the screened calls and from the phone's own call history, and every row has a
  one-tap «move to a group».

Moving a call from any group writes an exact mask into the target group, plus the exclusions
the move needs. When two groups would take the same caller, the app shows the conflict and
offers one-tap resolutions (keep it in one group or the other). Until it is resolved the
service fails open: the more lenient group decides.

## Policies

- **Let through** or **Block**.
- **A repeat call rings** — a switch over a blocking rule: a second call from the same number
  within the group's window (5 minutes by default) rings. Each group has one, and one covers
  the whole filter; either is off, on for good, or on for 1, 4 or 8 hours, a day, a week or
  until a date. A group that takes hidden numbers says, under the switch, that those calls stay
  blocked: a hidden number cannot show it is calling again.
- **A schedule**, laid out like a Google Calendar event: times from the system's clock dial,
  a start date, the repeat menu (every day, weekdays, weekends, weekly, monthly, yearly) with
  «Custom…» (every N days/weeks/months/years, weekdays, ending on a date or after N times),
  holidays also or except.
- **Time zones as in Google Calendar**: a schedule keeps its zone (the phone's at the time, or
  any city), so «work 9–18» set in Amsterdam is 10–19 in Helsinki; «local time — wherever I am»
  follows the phone instead, so «asleep 21:00–06:00» is 21:00–06:00 in every zone.
- **Calendars**: during or outside the events of the phone's calendars (every Google account
  already on the phone), of iCal links, or of public holidays by country. The schedule and the
  calendars combine: «weekdays 9–18, except during meetings and holidays».
- **Places**: only at a place or anywhere but there — «work contacts only at the office». A
  place is a point on an OpenStreetMap map (tap, drag, «Where I am» or an address search) with a
  radius of 50 m to 10 km. Android's geofences tell the filter when the phone crosses it, even
  with the app closed; the app also measures again whenever it comes to the front, because a
  crossing can arrive minutes late. When the phone cannot say where it is, the place condition
  drops out and the schedule and calendars decide alone. Coordinates stay on the phone and in
  your own Drive.
- **For a while**: the other action for an hour, until the evening, for a number of days, until
  the first call that rings, or until the current meeting ends; then the usual policy returns.
- **Pause the whole filter** from the app, the Quick Settings tile or the notification it shows.

## Permissions

On start the app checks what it still needs — the call-screening role first, then contacts,
call history, the end of a call and notifications; the calendar, SMS and location (with
«Allow all the time», set in Settings) only once a group uses them — and asks for one at a time in a sheet that says why. «Allow» opens Android's own dialog;
once Android stops showing it, the button opens the exact place in Settings instead. Coming back
to the app re-reads the phone, so a granted permission closes its sheet and the next one shows;
«Later» puts one off until the next start.

## Calendars

A group's calendars are picked from every calendar on the phone — its name, and the account it
belongs to — or from iCal links added by URL right there. With no calendars on the phone, the
screen says so and opens Android's «Add a Google account».

## Groups look

Each group has a colour: one of nine theme colours (shaded for light and dark), or any colour
from the picker — saturation and brightness on a square, hue on a strip — or typed as hex
(`FF8800`). The pencil and palette by the group's name rename and recolour it.

## Where a call is from

Every call with a number says where it is from, as far as the numbering catalogue that ships with
the app knows: the country, the region when the range names one or two, the operator or an
international service — «Russia · Kirov Oblast · Beeline», «United States · New Jersey». The
catalogue is a few megabytes of JSON, read right after the app starts rather than before it, so
the first screen never waits for it; until then the line is simply not there.

## Check a number

The Calls tab's title holds «Check a number»: a number (or «hidden») and, if the operator sends
one, a name — and the app answers as the service would if it called now: the group, what
happens, until when, whether it is a contact, which other groups also claim it. It runs the
same rules the published ruleset carries, the journal included, so a second call within the
window shows as the repeat it would be.

## In the shade

- **A temporary policy** shows a quiet notice while it lasts — «Delivery: ✅ let through until
  Thu 18:00» — with «Back to usual»: the service stops applying it at once, and the app drops it
  from the group (on every phone, through sync) the next time it opens.
- **Summaries, not a notice per call** — calls turned away during a meeting are told once it is
  over («During «Planning» 2 calls were turned away»), any others in a digest at most once an
  hour. Each kind has its own notification channel, so Android can mute one alone.

## After a call

- **«Where does this number go?»** — after a stranger's call rang through, the shade offers
  the most used groups; a tap moves the caller (the setting is in Settings).
- **SMS reply** — a group may answer a turned-away **contact** with its text («In a meeting,
  will call back»), never a stranger (it would confirm the number is alive), never while
  roaming, at most once per number every three hours.

## Sync across phones

Settings → Sync connects one of the Google accounts already on the phone: Android's own account
picker and consent screen (Identity `AuthorizationClient`, through the shared
`libs/expo-google-authorization`); the app never sees a password. The groups live in one file,
`calls-filter.json`, in the app's hidden Drive folder (`drive.appdata`, which nothing but this app
can read). A sync reads the cloud copy, merges it with this phone's against the copy both had at
the last sync — the side that changed something wins, a newer edit beats an older one, an edit
beats a delete — and writes it back over the revision it read; another phone writing in between
means read and merge again. It runs on start, a few seconds after an edit, in the background and
on request; a cloud file the app cannot read is never overwritten without the user's say.

## Offline, private

Everything lives on the phone: the groups in SQLite, the compiled rules in a file the service
reads, the journal and the diagnostics in the service's own SQLite, the iCal feeds with their
last copy. No internet is needed to screen; the map's tiles and the address search are the only
requests that leave for third parties (OpenStreetMap, Nominatim), and only while a place is edited. Diagnostics redact numbers and names and are shared
only by the user, through the share sheet.

## How it is built

- `src/contexts/<context>/{domain,application}` — the bounded contexts: `phone`, `masks`,
  `grouping` (the `GroupBook` aggregate: membership, conflicts, moves), `policy` (schedules,
  window sets, the action now), `calendars`, `screening` (the ruleset compiler), `journal`,
  `device`, `diagnostics`, `places` (geofences), `sync`, and `shell`, where they meet. The domain imports no framework;
  `pnpm layers` checks the direction.
- `src/infrastructure` — the adapters: SQLite stores, zod codecs, libphonenumber, `rrule-temporal`,
  `ical.js`, `expo-calendar`, `expo-contacts`, `expo-location` geofences, Nominatim, the native
  module's bridges.
- `src/composition-root.ts` — every adapter wired once; the screens and the background refresh
  share the one app of the JavaScript runtime.
- `src/background-refresh.ts` — a WorkManager task (`expo-background-task`) that re-reads the
  calendars and iCal links about twice a day and republishes the rules.
- `src/ui`, `src/app`, `src/texts` — the screens, the routes, Russian and English. «As the
  system» picks the first supported language of the phone, else English; the choice is the
  Android per-app language, so the Kotlin notifications and the tile follow it too.
- `modules/call-screening/android` — the Kotlin side, hexagonal as well (`domain`,
  `application`, `adapters`, `bridge`; Konsist checks the rings, ktlint the style
  (`.editorconfig`, IntelliJ IDEA style), detekt the rest (`detekt.yml` lists what differs from
  its defaults, and why). The ruleset contract is
  `libs/proto/proto/frozik/callsfilter/v1/ruleset.proto`: TypeScript is generated by buf,
  Java-lite by Gradle at build time.
- **One decision, two languages.** The TypeScript `decide` and the Kotlin one answer the same
  scenarios: `src/fixtures/screening-fixtures.test.ts` writes `screening.json`, and the Kotlin
  `SharedFixturesTest` must give the same answers (`UPDATE_FIXTURES=1` regenerates it).
- **The numbering catalogue** — `src/contexts/phone/domain/numbering/gen/numbering-masks.json`,
  a tree of about 30 000 number masks (`{ mask: '+7963000*', countryCode: 'RU',
  networkOperatorCode: 'beeline', stateCodes: ['kirov-oblast'] }`). Every node lists the
  narrower masks inside it in `children`; siblings never overlap. A number is told by
  descending into the child that covers it and stopping where none does:
  `+7*` → `+7963*` → `+7963000*`. Unallocated numbers stop at the enclosing mask, which is
  what keeps the file to 3 MB instead of tens of megabytes.
  - **Sources.** Russian mobile ranges carry the network and the region from the Ministry of
    Digital Development's numbering registry (`DEF-9xx.csv`), with the brand names from
    kody.su; Russian landlines (`ABC-3xx/4xx/8xx`) carry the region only. Every other country
    comes from libphonenumber (calling code → ISO 3166-1 alpha-2, territories that share a code
    by their leading digits), with the US and Canadian area codes and a few sub-codes
    (Madeira, Transnistria, Belarus regions…) from Wikipedia's «Телефонные коды стран».
    `serviceCode` marks the codes of no country: +800, Inmarsat, satellite networks.
  - **What the codes mean.** `countryCode` is the country whose numbering plan holds the range,
    a place without its own ISO code is a `stateCodes` entry under it. `stateCodes` holds two
    regions where the registry never tells them apart (Moscow with its oblast). Regions,
    networks and services have their own kebab-case codes.
  - **Names.** Every code is named in `src/texts/numbering/<language>-{countries,states,
    operators,services}.ts`, typed by `gen/numbering-codes.ts`: a language that misses a name
    does not compile, and `numbering-texts.test.ts` checks every code the masks use. Another
    language is four such files and `numbering/<language>.ts`, joined into its `ITexts`.

## Development

```bash
pnpm --filter @frozik/calls-filter test     # jest-expo; screens with RNTL over a phone of fakes (src/testing)
pnpm --filter @frozik/calls-filter types
moon run calls-filter:kotlin-check          # ktlint, detekt and the service's JVM tests, shared fixtures included
moon run calls-filter:bundle-check          # expo export: the Hermes bundle builds
pnpm calls-filter-android                   # a development build on the emulator / a phone
pnpm calls-filter-android:e2e               # the e2e APK + every test in e2e/
apps/calls-filter/e2e-android.sh --prebuilt screening                 # one suite on the last APK
apps/calls-filter/e2e-android.sh --prebuilt --only 'repeat' screening # the tests whose name matches
```

The approach — and why it is fast — is described once for both Android apps in
[`libs/tooling/src/android-e2e`](../../libs/tooling/src/android-e2e/README.md).

**The e2e tests drive the app through a command channel, not through its screens.** The APK built
for them (`CALLS_FILTER_E2E=1`) opens a broadcast receiver that `adb shell am broadcast` reaches —
only the shell and the system may send to it (`android.permission.DUMP`) — and hands each command
to `src/infrastructure/e2e-control`: seed a group, flip a switch, read a group or the calls of a
number. The commands run the same edits the screens run, so the service gets the same ruleset as
after a tap. A release APK has no channel: the native side refuses to open it.

- `e2e/screening.e2e.mts` — the service on real calls (`adb emu gsm call`, hung up the moment the
  service has answered): strangers, a blocking group, a repeat, a place, a meeting in a phone
  calendar. No screen is touched.
- `e2e/screens.e2e.mts` — what only a phone shows: the map in its WebView with «Where I am», and
  Android's permission dialog. The state is seeded and checked over the channel, the phone's
  position comes from location test providers the tests move, and only the action under test goes
  through the screen, which the test drives through the shared e2e agent, opened on its screen by
  link.
- Every other screen — editing a group, its schedule, moving a call, conflicts — is a Jest test
  with RNTL over a phone of fakes (`src/**/*.test.tsx`): milliseconds, not seconds.

Every test resets the book and calls with numbers of its own, so any test runs alone and in any
order. The whole run takes about 35 s on a Mac. Each test is bounded as a hang guard — a minute
and a half for the service, four minutes for a screen — and a failure leaves the screen, the view
tree and logcat in `e2e-artifacts/`, which CI uploads.

## Signing

Releases are signed with one key for the app's whole life; an update signed with another key
does not install over the app. Its certificate:

```
SHA-256: CE:86:95:D4:C8:51:ED:0D:AC:B5:E6:6E:C6:DE:10:1E:FA:4A:35:AC:04:26:30:BD:66:02:C1:1D:99:62:FB:67
```

Check a downloaded APK with `apksigner verify --print-certs calls-filter.apk` (Android SDK
build-tools): the SHA-256 digest must be the one above. Google identifies the app for Drive by the
same certificate (its SHA-1), so only an APK signed with it can sign in.

`sign-apk.sh` signs a local build with the key: `~/calls-filter-release.keystore` (or
`$CALLS_FILTER_KEYSTORE`), the password from `$CALLS_FILTER_KEYSTORE_PASSWORD` or the macOS
Keychain item `calls-filter-keystore`. Without the key the APK keeps prebuild's debug signature,
as on CI.

## Releases

`.github/workflows/calls-filter-release.yml` runs after the portfolio's release: when the tag
changed Calls Filter since the last APK, it builds for phones (arm64-v8a, armeabi-v7a) without
secrets, signs in the `calls-filter-release` environment (checking the certificate above),
attests the build and attaches `calls-filter-<version>.apk` with `SHA256SUMS` to that release.
`…/releases/download/calls-filter-latest/calls-filter.apk` always is the newest APK.
