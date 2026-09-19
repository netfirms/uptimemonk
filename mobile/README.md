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
      |                 |                  |
      v                 v                  v
+-----------+   +---------------+   +----------------+
| ui/auth   |   | ui/dashboard  |   | ui/settings    |
| login     |   | monitor list  |   | alert contacts |
| verify    |   | history       |   | display name   |
| email     |   | status link   |   | workspace name |
+-----------+   +---------------+   +----------------+
      |                 |                  |
      +--------+--------+------------------+
               v
+-------------------------------------------------------------+
|  viewmodels/    AuthViewModel, DashboardViewModel           |
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
- **Firebase**: `firebase_core`, `firebase_auth`, `cloud_firestore`, `firebase_messaging`
- **Auth**: Google Sign-In (`google_sign_in`) and Sign in with Apple
- **UI/data**: `http`, `fl_chart` (charts), `intl`, `flutter_svg`, `shared_preferences`
- **Notifications**: `firebase_messaging` + `flutter_local_notifications`

## Layout

```
lib/
  core/            AppTheme and AppConstants (constants.dart)
  data/services/   API client and push notifications (push_service.dart)
  viewmodels/      AuthViewModel, DashboardViewModel
  ui/
    auth/          login, verify-email, social auth buttons
    dashboard/     monitor list, history, status-page link share, delete
    monitor_form/  create/edit a monitor (incl. heartbeat setup)
    settings/      alert contacts, display name, workspace name
main.dart          entrypoint; initialises Firebase + push, routes by auth state
```

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

Current tests:

- `test/email_verification_test.dart` — unit tests for `needsEmailConfirmation`
  in `lib/core/email_verification.dart`. Covers the gate itself (a password
  sign-in with an unconfirmed address is blocked) and the deliberate
  exceptions: `google.com`, `github.com` and `apple.com` are let straight
  through because Firebase reports `emailVerified: false` for them, and an
  Apple private-relay address (`@privaterelay.appleid.com`) is never asked to
  confirm because only Apple can confirm it.
- `test/widget_test.dart` — domain-model unit tests: `MonitorConfig.fromFirestore`
  and `LiveState.fromMap` from `lib/data/models/`.

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

`pubspec.yaml` reports version `1.0.0+1`. The iOS App Store metadata under
`ios/fastlane/metadata/th/` currently describes a car-installment calculator
(e.g. `keywords.txt`: "ค่างวด, ดอกเบี้ย, รถยนต์, คำนวน"), which does **not** match
this product — correct it before an iOS release.
