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
|    auth/            login, register, verify_email, social buttons      |
|    dashboard/       monitor list + status-page link + pull-to-refresh  |
|      widgets/       monitor_card, hourly_bars (12h sparkline),         |
|                     stats_header, filter_bar                           |
|    monitor_detail/  per-monitor status + latency charts, incidents     |
|      widgets/       status_bars_chart, response_chart, incident_list   |
|    monitor_form/    create/edit a monitor (incl. heartbeat setup)      |
|    settings/        alert contacts, display name, workspace name       |
|    widgets/         app_version_label (shared footer)                  |
+---------------------------------+-------------------------------------+
                                  |  widgets call viewmodels via provider
                                  v
+-----------------------------------------------------------------------+
|  State          lib/viewmodels/                                        |
|    AuthViewModel            - session, orgId, verification state       |
|    DashboardViewModel       - monitor list, live state, history cache  |
|    MonitorDetailViewModel   - one monitor's history + selected range   |
+---------------------------------+-------------------------------------+
                                  |  viewmodels call services
                                  v
+-----------------------------------------------------------------------+
|  Services       lib/data/services/                                     |
|    api_client.dart   -> http -> AppConstants.apiUrl (worker API)       |
|    push_service.dart -> firebase_messaging + flutter_local_notifications
+---------------------------------+-------------------------------------+
                                  |  typed models
                                  v
+-----------------------------------------------------------------------+
|  Domain / data  lib/data/models/                                       |
|    MonitorConfig (fromFirestore), LiveState (fromMap),                 |
|    MonitorHistory (Bucket/Point/Incident), AlertContact                |
+-----------------------------------------------------------------------+
```

**`LiveState.fromMap` is a wire contract, not a convenience.** Its keys must
match `buildStatusDoc` in `server/src/sync/mirror.ts` exactly. A key that does
not match never fails loudly — it parses as `null` and the UI renders an em
dash, which looks exactly like a value that has legitimately not been measured
yet. That is how every latency in the app read empty for months: the mirror
writes `lastResponseTimeMs`, the model read `responseTimeMs`, and the test
covering it supplied its own key names and so agreed with the bug.

The model's test now builds its input from the mirror's field list, and asserts
that an unknown key stays null. If you add a field to the mirror, add it in
both places; if a field disappears from the mirror, delete it here rather than
leaving a property that can only ever be null.

### Shared foundations (used by every layer)

```
+-----------------------------------------------------------------------+
|  lib/core/                                                             |
|    theme.dart      AppTheme  - Tron Legacy palette, status colors,     |
|                    glass parameters. Hex values mirror the web's       |
|                    globals.css token for token (asserted by a test).   |
|    constants.dart  AppConstants - apiUrl, appUrl, timeouts, intervals  |
|    email_verification.dart - needsEmailConfirmation() gate             |
|    analytics.dart  GA4 events; names identical to the web client's     |
|    external_link.dart - opens a URL in the device browser              |
+-----------------------------------------------------------------------+
|  lib/ui/widgets/                                                       |
|    app_version_label.dart  - reads the build version via               |
|                              package_info_plus; used by login+settings |
|    probe_pulse.dart    - the app's loading state (radar sweep)         |
|    glass_panel.dart    - frosted pane; blur, gradient fill, lit edge   |
|    grid_floor.dart     - the Grid; perspective plane + GridBackdrop    |
|    animated_counter.dart - numbers that travel to a new value          |
|    stagger_in.dart     - list rows that arrive in sequence             |
|    status_dot.dart     - a dot that breathes while the state is live   |
+-----------------------------------------------------------------------+
```

Every animation here reads `MediaQuery.disableAnimationsOf` and stops when
the OS reduce-motion switch is on. That is not decoration: a looping
animation is the precise thing that setting exists to suppress, and each of
these widgets has a test asserting it.

### Charts and their data

Two families of chart, both fed by the worker API's range-aware history
endpoint (`/v1/monitors/:id/history?range=`):

- **Card sparklines** (`hourly_bars.dart`) show the last 12 hourly buckets on
  each dashboard card.
- **Detail charts** (`status_bars_chart.dart`, `response_chart.dart`) cover
  **24h / 7d / 30d / 90d**. One range selector drives both; it lives on the
  status chart and both read the same `MonitorDetailViewModel.history`.

Every range returns `MonitorHistory.buckets` — hourly up to 7d, daily rollups
for 30d/90d. The widget does not care which table answered, which is the point
of the shared `seriesFor()` on the server. `lib/ranges.ts` is authoritative:
a long range *must* read `day_rollups`, since `hour_buckets` is pruned at 35
days.

Crucially, history is fetched from the **worker API, not Firestore** — so
charts add nothing to the Firestore write bill. `DashboardViewModel` fetches
per-monitor history after the monitor list arrives, fire-and-forget, bounded to
four concurrent requests, and caches it by monitor id.

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
| Analytics          | `lib/core/analytics.dart` (`Analytics`, `AnalyticsEvents`) |
| External links     | `lib/core/external_link.dart` (`openExternalUrl`) |
| Models             | `lib/data/models/` (`MonitorConfig`, `LiveState`, `MonitorHistory`, `AlertContact`) |
| API client         | `lib/data/services/api_client.dart` (`ApiClient`) |
| Push               | `lib/data/services/push_service.dart`          |
| Card sparkline     | `lib/ui/dashboard/widgets/hourly_bars.dart`     |
| Detail charts      | `lib/ui/monitor_detail/widgets/status_bars_chart.dart`, `response_chart.dart` |
| Version label      | `lib/ui/widgets/app_version_label.dart`        |
| Glass surfaces     | `lib/ui/widgets/glass_panel.dart` (`GlassPanel`) |
| Grid graphics      | `lib/ui/widgets/grid_floor.dart` (`GridFloor`, `GridBackdrop`) |
| Motion primitives  | `lib/ui/widgets/animated_counter.dart`, `stagger_in.dart`, `status_dot.dart`, `probe_pulse.dart` |
| Android shell      | `android/app/src/main/` and `MainActivity.kt`  |
| iOS shell          | `ios/Runner/AppDelegate.swift`, `project.pbxproj` |
| Release identity   | `ios/fastlane/Appfile`                         |
| Lints              | `analysis_options.yaml`                        |
| Dependencies       | `pubspec.yaml`                                 |

## 7. Out of scope

- Native shell internals beyond the plugin registration point (`AppDelegate`,
  `MainActivity`) are not modelled here.
- Fastlane action internals are documented by their own generated READMEs.
