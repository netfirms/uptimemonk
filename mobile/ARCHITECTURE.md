# UptimeMonke mobile — high-level architecture

A generated, separated high-level view of the Flutter mobile client. Grounded in
the files listed at the bottom; see `README.md` for setup and release notes.

## 1. System context

```
   +------------------------+          +--------------------------+
   |  UptimeMonke mobile    |          |  UptimeMonke dashboard   |
   |  (Flutter app)         |          |  (web)                   |
   +-----------+------------+          +------------+-------------+
               |                                    |
               |  same Firebase project: "uptimemonk"
               |
               v
   +-----------------------------------------------------------+
   |  Firebase (Spark)                                          |
   |    Auth        - sign-in, email-confirmation gate          |
   |    Firestore   - read-only org status mirror               |
   |    Cloud       - FCM push (downtime / recovery)            |
   |    Messaging                                               |
   +-----------------------------------------------------------+
               ^
               |  reads share the same project
               |
   +-----------------------------------------------------------+
   |  Worker API  (api.uptimemonke.com)                         |
   |    - monitor CRUD, alert contacts, display/workspace name  |
   |    - SQLite-backed check history (worker-owned)            |
   +-----------------------------------------------------------+
```

The app is a **client of two backends**. It reads from Firebase (Auth,
Firestore mirror, FCM) but performs **all mutations through the worker API**;
it never writes `monitors` to Firestore directly.

## 2. Layered view

```
+-----------------------------------------------------------------------+
|  Presentation   lib/ui/                                                |
|    auth/          login_screen, verify_email_screen, social buttons    |
|    dashboard/     monitor list, history, status-page link, delete      |
|    monitor_form/  create/edit a monitor (incl. heartbeat setup)        |
|    settings/      alert contacts, display name, workspace name         |
+---------------------------------+-------------------------------------+
                                  |  widgets call viewmodels via provider
                                  v
+-----------------------------------------------------------------------+
|  State          lib/viewmodels/                                        |
|    AuthViewModel       - session, orgId, email-verification state      |
|    DashboardViewModel  - monitor list + live state for the org         |
+---------------------------------+-------------------------------------+
                                  |  viewmodels call services
                                  v
+-----------------------------------------------------------------------+
|  Services       lib/data/services/                                     |
|    API client        -> http -> AppConstants.apiUrl (worker API)       |
|    push_service.dart -> firebase_messaging + flutter_local_notifications
+---------------------------------+-------------------------------------+
                                  |  typed models
                                  v
+-----------------------------------------------------------------------+
|  Domain / data  lib/data/models/                                       |
|    MonitorConfig (fromFirestore), LiveState (fromMap)                  |
+-----------------------------------------------------------------------+
```

### Shared foundations (used by every layer)

```
+-----------------------------------------------------------------------+
|  lib/core/                                                             |
|    theme.dart      AppTheme  - dark design system, status colors       |
|    constants.dart  AppConstants - apiUrl, appUrl, timeouts, intervals  |
|    email_verification.dart - needsEmailConfirmation() gate             |
+-----------------------------------------------------------------------+
```

## 3. Auth routing (from main.dart)

```
  AuthViewModel.status
        |
        +-- initial ────────────> loading spinner
        |
        +-- authenticated
        |     + needsEmailVerification ──> VerifyEmailScreen
        |     + orgId != null ───────────> DashboardScreen
        |
        +-- otherwise ───────────> LoginScreen
```

A password account with an unconfirmed address is gated before the dashboard;
`orgId` is deliberately left null while unverified, and the API refuses those
tokens.

## 4. Platform shells

```
  Android                                   iOS
  -------                                   ----
  android/app/src/main/AndroidManifest.xml  ios/Runner/Info.plist
    - Firebase Auth deep link                 - Runner target config
      (genericidp / firebase.auth)            - CODE_SIGN_ENTITLEMENTS =
    - FCM channel "uptime_alerts"               Runner/Runner.entitlements
    - flutterEmbedding = 2                    - iPhoneDistribution (manual)
                                              - team KA8XY7F89Y
  android/.../MainActivity.kt               ios/Runner/AppDelegate.swift
    - creates the uptime_alerts channel       - FlutterImplicitEngineDelegate
      natively (IMPORTANCE_HIGH)                registers plugins
  android/settings.gradle.kts               ios/fastlane/Appfile
    - AGP 8.7.3, Kotlin 2.1.0,                - bundle id com.mfx.uptimemonke
      google-services 4.4.2                     team + App Store Connect ids
```

## 5. Push notification flow

```
  FCM message
      |
      +-- app in foreground --> push_service._showForegroundNotification
      |                           -> local notification (Android + Darwin)
      |
      +-- app in background --> tap -> onMessageOpenedApp -> handle click

  Android channel: "uptime_alerts"  (AppConstants.notificationChannelId)
        created natively in MainActivity.kt and mirrored in constants.dart
```

## 6. Data sources referenced

| Concern            | Source file                                    |
|--------------------|------------------------------------------------|
| Entrypoint / routes | `lib/main.dart`                               |
| Design system      | `lib/core/theme.dart` (`AppTheme`)             |
| Constants          | `lib/core/constants.dart` (`AppConstants`)     |
| Email gate         | `lib/core/email_verification.dart`             |
| Models             | `lib/data/models/` (`MonitorConfig`, `LiveState`) |
| Push               | `lib/data/services/push_service.dart`          |
| Android shell      | `android/app/src/main/` and `MainActivity.kt`  |
| iOS shell          | `ios/Runner/AppDelegate.swift`, `project.pbxproj` |
| Release identity   | `ios/fastlane/Appfile`                         |
| Lints              | `analysis_options.yaml`                        |
| Dependencies       | `pubspec.yaml`                                 |

## 7. Not shown / to verify

- Concrete monitor CRUD method names live in the API client under
  `lib/data/services/` (referenced by `_apiClient` in the UI, file name not
  shown).
- The full `lib/data/models/` set beyond `MonitorConfig` and `LiveState`.
- `AssistantEditor` tooling config is out of scope for this document.
