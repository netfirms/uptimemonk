# UptimeMonke — mobile

The UptimeMonke mobile client (Flutter). It signs in to the same Firebase
project the dashboard uses, lists the organisation's monitors, creates and edits
them through the worker API, and receives downtime/recovery alerts as push
notifications.

## Architecture

```
+-------------------------------------------------------------+
|  Platform shell                                             |
|  android/app/src/main/AndroidManifest.xml                   |
|    - Firebase Auth deep link (genericidp / firebase.auth)   |
|    - FCM channel "uptime_alerts" (flutterEmbedding=2)       |
|  ios/Runner/AppDelegate.swift  (FlutterImplicitEngineDelegate)
|    - GeneratedPluginRegistrant registers plugins            |
+-------------------------------------------------------------+
              |  (runs)
              v
+-------------------------------------------------------------+
|  lib/main.dart  -  entrypoint                               |
|    Firebase.initializeApp()                                 |
|    PushNotificationService.initialize()                     |
|    MultiProvider(AuthViewModel)  ->  routes by auth state   |
+-------------------------------------------------------------+
      |            |            |            |
      v            v            v            v
+-----------+ +-----------+ +-------------+ +----------------+
| ui/auth   | | ui/       | | ui/         | | ui/settings    |
| login     | | dashboard | | monitor_    | | alert contacts |
| register  | | monitor   | | detail      | | display name   |
| verify    | | list, 12h | | status bars | | workspace name |
| email     | | sparkline | | latency,    | | app version    |
|           | | status    | | incidents   | |                |
|           | | link      | | 24h/7d/30/90| |                |
+-----------+ +-----------+ +-------------+ +----------------+
      |            |            |            |
      +------+-----+-----+------+------------+
             v
+-------------------------------------------------------------+
|  viewmodels/    AuthViewModel, DashboardViewModel,          |
|                 MonitorDetailViewModel                      |
|    (provider) - hold UI state, call services                |
+-------------------------------------------------------------+
               v
+-------------------------------------------------------------+
|  data/services/                                             |
|    API client      -> http  -> AppConstants.apiUrl           |
|    push_service.dart -> firebase_messaging +                 |
|                        flutter_local_notifications           |
+-------------------------------------------------------------+
               |
     +---------+----------+
     v                    v
+-------------+   +----------------------------+
| Worker API  |   | Firebase                    |
| api.uptime  |   |  Auth (sign-in, email gate)  |
| monke.com   |   |  Firestore (read-only mirror)|
| (all writes)|   |  FCM (downtime/recovery)     |
+-------------+   +----------------------------+
```

Monitor state is read from the Firebase mirror but every mutation goes to the
worker API; the app never writes `monitors` in Firestore directly. See
`firestore.rules`.

## Stack

From `pubspec.yaml`:

- **Flutter** (Dart SDK `^3.8.1`), `provider` for state management
- **Firebase**: `firebase_core`, `firebase_auth`, `cloud_firestore`,
  `firebase_messaging`, `firebase_analytics`
- **Auth**: Google Sign-In (`google_sign_in`) and Sign in with Apple
- **UI/data**: `http`, `fl_chart` (charts), `intl`, `flutter_svg`,
  `shared_preferences`, `package_info_plus` (app version label),
  `url_launcher` (opens the public status page in the device browser)
- **Notifications**: `firebase_messaging` + `flutter_local_notifications`

## Layout

```
lib/
  core/            AppTheme (theme.dart), AppConstants (constants.dart),
                   email-verification gate (email_verification.dart),
                   analytics.dart (GA4), external_link.dart (browser)
  data/models/     MonitorConfig, LiveState, MonitorHistory, AlertContact
  data/services/   API client (api_client.dart) and push (push_service.dart)
  viewmodels/      AuthViewModel, DashboardViewModel, MonitorDetailViewModel
  ui/
    auth/          login, register, verify-email, social auth buttons
    dashboard/     monitor list + status-page link share + pull-to-refresh
      widgets/     monitor_card, hourly_bars (12h sparkline), stats_header,
                   filter_bar
    monitor_detail/ per-monitor charts and incidents
      widgets/     status_bars_chart (up/down history), response_chart
                   (latency), incident_list
    monitor_form/  create/edit a monitor (incl. heartbeat setup)
    settings/      alert contacts, display name, workspace name
    widgets/       shared UI — app_version_label (login + settings footer),
                   probe_pulse (loading), glass_panel, grid_floor,
                   animated_counter, stagger_in, status_dot
main.dart          entrypoint; initialises Firebase + push, routes by auth state
```

### Dashboard charts

- **Card sparkline** (`ui/dashboard/widgets/hourly_bars.dart`) — the last 12
  hourly buckets on each monitor card, colour-coded up/down/mixed, so recent
  health reads at a glance without opening the monitor.
- **Detail charts** (`ui/monitor_detail/widgets/`) — a `StatusBarsChart`
  (up/down per bucket) and a `ResponseChart` (latency), both selectable across
  **24h / 7d / 30d / 90d**. The range selector drives both charts; the choice
  is a single `MonitorDetailViewModel.range`.

Both read `MonitorHistory.buckets`, which the worker API returns for every
range — hourly buckets up to 7d, daily rollups for 30d/90d — so one widget
serves all four windows without knowing which table answered. Per the server's
`lib/ranges.ts`, a long range *must* read rollups: buckets are pruned at 35
days, so pointing 90d at them would return a third of the window.

History is fetched from the **worker API, not Firestore**, so charts cost
nothing against the free-tier Firestore write bill. `DashboardViewModel`
fetches per-monitor history after the monitor list arrives, fire-and-forget,
bounded to four concurrent requests, and caches it by monitor id.

## Design system

`lib/core/theme.dart` holds the palette, and its hex values are the same ones
in `web/src/app/globals.css` — token for token, asserted by a test in
`test/glass_grid_test.dart`. Two products meant to look like one product
cannot each keep their own idea of what the brand colour is; when they drift,
nobody notices until the two are put side by side.

The palette is Tron Legacy: the cyan of the programs and CLU's orange on
near-black. Near-black matters — cyan only reads as luminous against something
close to true black, and lifting the base makes the glow read as a pale fill.

**Status colours are the deliberate exception.** `statusUp` takes the cyan, but
`statusDown` stays red and `statusMaintenance` stays amber. Orange reads as
"warning" to anyone who has seen a dashboard, and this is a monitoring product:
being truer to the film would be worse at the job the colour is doing.

Surfaces and motion:

| Widget | What it is for |
|---|---|
| `GlassPanel` | frosted pane — blur, gradient fill, lit top lip, two shadows |
| `GridFloor` / `GridBackdrop` | the Grid; a perspective plane with a lit horizon |
| `AnimatedCounter` | numbers that travel to a new value instead of snapping |
| `StaggerIn` | list rows that arrive in sequence |
| `StatusDot` | a dot that breathes only while the state it reports is live |
| `ProbePulse` | the loading state, with captions saying what is being waited on |

Two constraints that are easy to get wrong:

- **`GlassPanel` is not free.** `BackdropFilter` forces a `saveLayer` per panel.
  It is right for the four dashboard stat boxes and wrong for a scrolling list,
  where the cost is paid per row per frame for an effect hidden behind opaque
  cards. Pass `blurEnabled: false` to keep the look without the blur.
- **Every animation stops under reduce-motion.** Each reads
  `MediaQuery.disableAnimationsOf` and has a test asserting it. A looping
  animation is exactly what that OS setting exists to suppress.

`GridFloor` is on the login screen only. Behind the dashboard list its
converging lines showed through the gaps between cards and competed with the
data — which is also why the web keeps its grid in the hero rather than behind
the tables.

## Configuration

All runtime constants live in `lib/core/constants.dart` (`AppConstants`):

- `appName` — `UptimeMonke`
- `apiUrl` — `https://api.uptimemonke.com` (the worker API)
- `appUrl` — `https://uptimemonke.com` (the dashboard)
- `requestTimeout` — 15s
- `defaultIntervalSeconds` — 60; `minIntervalSeconds` — 5

**Firebase**: the app is bound to the `uptimemonk` project. The Android config
lives in `android/app/google-services.json` (package `com.mfx.uptimemonke`);
iOS configuration is provided via the Runner target.

**Client/server boundary**: the app talks to the worker API over `http` and
**does not write monitor state directly**. `firestore.rules` is backend-only for
the things that matter — `statusPages`, `statusSlugs`, `apiKeys`,
`notifications` and `system` are all non-client-writable (some are
`allow read: if false` too). The client reads what it is permitted to and
performs mutations by calling the API (`createMonitor`, `updateMonitor`,
`updateDisplayName`, etc. in the API client).

## Push notifications

- The Android channel is `uptime_alerts` ("Downtime & Recovery Alerts",
  importance HIGH), created natively in
  `android/app/src/main/kotlin/com/mfx/uptimemonke/MainActivity.kt` and mirrored
  in `AppConstants.notificationChannelId` / `notificationChannelName` /
  `notificationChannelDesc`.
- `push_service.dart` requests permission at runtime (required on iOS and
  Android 13+), sets iOS foreground presentation options, syncs the device token
  on refresh, shows foreground messages via `flutter_local_notifications`
  (Android + `DarwinNotificationDetails` for iOS), and handles background
  notification taps.

## Analytics

`lib/core/analytics.dart` reports to GA4 through `firebase_analytics`.

**The event names are identical to the web client's** (`web/src/lib/analytics.ts`),
and that is the whole point. GA4 reports on the event name, so `monitor_created`
fired from Flutter and from the browser land in one funnel, with the platform
split still available from the built-in dimension. Naming the mobile copy
`mobile_monitor_created` would have produced two half-populated reports and no
way to answer "how many monitors get created" without adding them up by hand.

Sign-in is instrumented in `AuthViewModel._resolveOrgId` rather than in each of
the six sign-in methods. All of them funnel through it, it already reads
`signInProvider` off the ID token, and it already knows whether `bootstrap`
created the workspace — which is exactly where `login` and `sign_up` part ways.
One site cannot drift out of step with another, and a seventh provider is
measured the day it is added.

Two things to know before adding an event:

- **GA4 silently drops boolean parameters.** `sanitizeParams` coerces them to
  `"true"`/`"false"`, matching what the web SDK does. Without it an event
  arrives with an empty dimension — data that looks real and is not.
- **No personal data.** Channels without destinations, an opaque org id, never
  a monitor target or an address. Those are the customer's business and none of
  them are needed to answer what this exists for: which features get used, and
  where people give up.

## Getting started

```sh
flutter pub get
flutter run
```

Push notifications require a real device and the platform notification
configuration; permission is requested at runtime.

## Testing

Tests live in `test/` and use `flutter_test` (see `pubspec.yaml`). Run them with:

```sh
flutter test
flutter analyze
```

`flutter analyze` uses the lint set configured in `analysis_options.yaml`
(`package:flutter_lints/flutter.yaml`), which excludes `build/**`, `android/**`
and `ios/**`.

Current tests (62 in total):

- `test/email_verification_test.dart` — unit tests for `needsEmailConfirmation`
  in `lib/core/email_verification.dart`. Covers the gate itself (a password
  sign-in with an unconfirmed address is blocked) and the deliberate
  exceptions: `google.com`, `github.com` and `apple.com` are let straight
  through because Firebase reports `emailVerified: false` for them, and an
  Apple private-relay address (`@privaterelay.appleid.com`) is never asked to
  confirm because only Apple can confirm it.
- `test/widget_test.dart` — domain-model unit tests: `MonitorConfig.fromFirestore`
  and `LiveState.fromMap` from `lib/data/models/`.
- `test/models_test.dart` — more `MonitorConfig.fromFirestore` parsing,
  including double→int coercion and header-value stringification.
- `test/api_client_test.dart` — `ApiClient` defaults (base URL, client header).
- `test/monitor_card_overflow_test.dart` — the dashboard card renders a long
  monitor name without overflowing on a narrow screen.
- `test/monitor_card_name_test.dart` — the card name is **not** ellipsized: a
  21-character name wraps to two lines. Asserts via a `TextPainter` at the
  card's real width that `didExceedMaxLines` is false.
- `test/hourly_bars_test.dart` — the card sparkline: one bar per bucket, the
  up/down/mixed colour rules, the no-checks gap (never red), windowing to the
  most recent N, and out-of-order input.
- `test/status_bars_chart_test.dart` — the detail status chart: the range
  selector, the empty state, the colour rules, the no-checks gap, legend
  counts, and a 168-bucket 7d range rendering without overflow.
- `test/app_version_label_test.dart` — `AppVersionLabel`: default-build
  omission, a non-default build number, a custom prefix, and the
  pre-resolution empty state.

Native tests: `ios/RunnerTests/RunnerTests.swift` is an XCTest stub run via the
Xcode test action; there is no equivalent Android instrumentation test.

Fastlane also exposes a `test` action on each platform (see
`android/fastlane/README.md` and `ios/fastlane/README.md`).

## Auth flow

`main.dart` routes by `AuthViewModel` state: a loading screen while `initial`, a
`VerifyEmailScreen` for a signed-in but unconfirmed password account (the API
refuses those tokens and `orgId` is deliberately null until verified), the
`DashboardScreen` once authenticated with an `orgId`, otherwise the login
screen.

## Release (fastlane)

Both platforms are released with fastlane. See the auto-generated action lists
in `android/fastlane/README.md` and `ios/fastlane/README.md`.

- **Android** (`android/fastlane/README.md`): `test`, `prepare`,
  `prepare_single_apk`, `firebase_deploy` (Firebase App Distribution),
  `internal_deploy`, `alpha_deploy`, `huawei_deploy`.
- **iOS** (`ios/fastlane/README.md`): `prepare`, `testflightupload`, `release`.

These READMEs are re-generated by fastlane and should not be edited by hand.

## Status

`pubspec.yaml` reports version `1.0.0+1`, and **that number never ships**. Both
release lanes stamp the build from `number_of_commits()`, so a release is
`1.0.<commit count>` with a matching build number — currently around `1.0.116`.
That is why the store listing shows a version the pubspec has never contained,
and why the build number always increases without anyone editing a file.

The app version is shown at the foot of the login and settings screens via
`AppVersionLabel`, read from the platform with `package_info_plus` so it tracks
the build rather than a Dart constant.

The iOS App Store metadata directory (`ios/fastlane/metadata/`) is not currently
present in the tree; when it is restored for a release, ensure its copy matches
this product rather than a leftover template.
