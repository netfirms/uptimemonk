// Product analytics.
//
// The mirror of `web/src/lib/analytics.ts`, deliberately so. The event names
// and parameter names here are identical to the web client's, because GA4
// reports on the event name: `monitor_created` fired from Flutter and from
// the browser land in one funnel, and a platform breakdown is still available
// from the automatic `platform` dimension. Naming the mobile copy
// `mobile_monitor_created` would have produced two half-populated reports and
// no way to answer "how many monitors get created" without adding them up by
// hand.
//
// Every call is fire-and-forget and swallows its own errors. Measurement must
// never be able to break a screen, and it must never block one either — on a
// cold start the native SDK may not have finished initialising, which is a
// normal outcome rather than a failure to handle.
//
// Deliberately no personal data: no email addresses, no monitor targets, no
// URLs a customer is watching. Those are the customer's business, they would
// end up in Google's logs, and none of them are needed to answer the questions
// this exists for — which features get used, and where people give up.

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Off until [Analytics.init] succeeds.
///
/// Firebase may legitimately never initialise — the native config file is
/// absent in some development checkouts, and `main()` already tolerates that.
/// Without this guard every event would then throw into the void on a timer.
bool _ready = false;

FirebaseAnalytics? _instance;

/// The provider name in the form the web client reports it.
///
/// Firebase gives `google.com`, `github.com`, `apple.com`; the web client
/// sends `google`, `github`, `apple`. Without this the same sign-in would
/// split into two values of the `method` dimension in one GA4 report, which
/// reads as two smaller products rather than one.
///
/// Top-level and pure so it can be tested without Firebase, the same reason
/// `resolveDestination` lives outside the view model.
String analyticsMethodFor(String? provider) {
  if (provider == null || provider.isEmpty) return 'unknown';
  return provider.endsWith('.com')
      ? provider.substring(0, provider.length - 4)
      : provider;
}

/// GA4 accepts only strings and numbers as parameter values.
///
/// Passing a `bool` through makes the native SDK drop the parameter silently,
/// which is the worst outcome: the event arrives, the dimension is empty, and
/// the report looks like real data. The web SDK coerces booleans to
/// `"true"`/`"false"`, so doing the same here keeps the two platforms
/// comparable in the same report.
///
/// Null values are dropped rather than sent as `"null"`: an absent parameter
/// is absent in GA4, whereas the string "null" becomes a real dimension value
/// that shows up in reports as though it meant something.
Map<String, Object> sanitizeParams(Map<String, Object?> params) {
  final out = <String, Object>{};
  params.forEach((key, value) {
    if (value == null) return;
    // Numbers and strings are the only two things GA4 takes, so they pass
    // through and everything else — bools included — becomes its string form.
    out[key] = (value is num || value is String) ? value : value.toString();
  });
  return out;
}

class Analytics {
  const Analytics._();

  /// Called once from `main()` after `Firebase.initializeApp()`.
  ///
  /// Analytics collection is left at its default (enabled); this only binds the
  /// instance and flips the guard so events stop being discarded.
  static Future<void> init() async {
    try {
      _instance = FirebaseAnalytics.instance;
      _ready = true;
    } catch (e) {
      // A measurement failure is not worth a broken launch.
      debugPrint('Analytics unavailable: $e');
      _ready = false;
    }
  }

  /// The observer that reports pushed routes as screen views.
  ///
  /// Only catches named routes that go through the Navigator. The top-level
  /// destinations (login, dashboard, verify-email) are swapped by
  /// `MaterialApp.home` rather than pushed, so those are reported by hand via
  /// [screenView] — see `main.dart`.
  static FirebaseAnalyticsObserver? observer() {
    if (!_ready || _instance == null) return null;
    return FirebaseAnalyticsObserver(analytics: _instance!);
  }

  static Future<void> track(String event, [Map<String, Object?> params = const {}]) async {
    if (!_ready || _instance == null) return;
    try {
      await _instance!.logEvent(name: event, parameters: sanitizeParams(params));
    } catch (_) {
      // Never surface a measurement failure to the user.
    }
  }

  /// A screen view, for the destinations the Navigator never sees.
  static Future<void> screenView(String name) async {
    if (!_ready || _instance == null) return;
    try {
      await _instance!.logScreenView(screenName: name);
    } catch (_) {
      /* ignore */
    }
  }

  /// Plan is useful for segmenting; the org id is an opaque identifier, not PII.
  static Future<void> identify(String orgId, {String? plan}) async {
    if (!_ready || _instance == null) return;
    try {
      await _instance!.setUserProperty(name: 'org_id', value: orgId);
      await _instance!.setUserProperty(name: 'plan', value: plan ?? 'unknown');
    } catch (_) {
      /* ignore */
    }
  }

  /// Clears the identity on sign-out so the next account does not inherit it.
  static Future<void> resetIdentity() async {
    if (!_ready || _instance == null) return;
    try {
      await _instance!.setUserProperty(name: 'org_id', value: null);
      await _instance!.setUserProperty(name: 'plan', value: null);
    } catch (_) {
      /* ignore */
    }
  }
}

/// The events worth having names for.
///
/// Kept as a closed set rather than free-form strings: an event named three
/// different ways across the codebase is worse than no event, because the
/// numbers look real and are not. Every name here exists in the web client too
/// — if you add one, add it in both places or the funnel develops a hole on one
/// platform only.
class AnalyticsEvents {
  const AnalyticsEvents._();

  static Future<void> signIn(String method) => Analytics.track('login', {'method': method});
  static Future<void> signUpBootstrapped(String method) =>
      Analytics.track('sign_up', {'method': method});

  static Future<void> monitorCreated(String type, int intervalSeconds) => Analytics.track(
        'monitor_created',
        {'monitor_type': type, 'interval_seconds': intervalSeconds},
      );
  static Future<void> monitorEdited(String type) =>
      Analytics.track('monitor_edited', {'monitor_type': type});
  static Future<void> monitorDeleted(String type) =>
      Analytics.track('monitor_deleted', {'monitor_type': type});
  static Future<void> monitorPaused(bool paused) =>
      Analytics.track('monitor_paused', {'paused': paused});

  static Future<void> historyViewed(String type) =>
      Analytics.track('history_viewed', {'monitor_type': type});

  /// Channel only — never the destination, which is a real address.
  static Future<void> contactAdded(String channel) =>
      Analytics.track('contact_added', {'channel': channel});
  static Future<void> contactVerified(String channel) =>
      Analytics.track('contact_verified', {'channel': channel});
  static Future<void> contactTested(String channel, bool ok) =>
      Analytics.track('contact_tested', {'channel': channel, 'ok': ok});

  /// Amount only — no customer or payment identifiers.
  static Future<void> donateStarted(num usd) =>
      Analytics.track('donate_started', {'usd': usd});
  static Future<void> capacityBlocked() => Analytics.track('capacity_blocked');

  /// Kind only — never the message, which is the sender's words.
  ///
  /// Defined here with no call site yet: the feedback form is on the web only
  /// so far, and the names have to match when mobile grows one.
  static Future<void> feedbackSent(String kind) =>
      Analytics.track('feedback_sent', {'kind': kind});

  /// The failure the user actually saw — how we learn which errors are common.
  static Future<void> actionFailed(String action, [int? status]) =>
      Analytics.track('action_failed', {'action': action, 'status': status});

  /// Push permission is a mobile-only decision, so this one has no web twin.
  static Future<void> pushPermission(bool granted) =>
      Analytics.track('push_permission', {'granted': granted});
}
