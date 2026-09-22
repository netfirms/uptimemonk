import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/analytics.dart';

/// These cover the two pieces of real logic in the analytics layer. The rest
/// of it is thin delegation to the Firebase SDK, which is not worth a mock —
/// a test that only proves `logEvent` was called proves nothing about whether
/// the numbers are right.
void main() {
  group('analyticsMethodFor', () {
    test('strips the .com Firebase appends, matching the web client', () {
      expect(analyticsMethodFor('google.com'), 'google');
      expect(analyticsMethodFor('github.com'), 'github');
      expect(analyticsMethodFor('apple.com'), 'apple');
    });

    test('leaves a provider that has no suffix alone', () {
      // Firebase reports password sign-in as plain `password`, and the web
      // client sends the same string.
      expect(analyticsMethodFor('password'), 'password');
    });

    test('reports an absent provider rather than an empty dimension', () {
      // Null until the ID token resolves. Sending "" would create a blank
      // value in the report that looks like a bug in the product rather than
      // a sign-in whose provider was not known yet.
      expect(analyticsMethodFor(null), 'unknown');
      expect(analyticsMethodFor(''), 'unknown');
    });
  });

  group('sanitizeParams', () {
    test('coerces bools to strings so GA4 does not drop them', () {
      // The native SDK silently discards boolean values, which would leave
      // `monitor_paused` arriving with no `paused` dimension at all.
      expect(sanitizeParams({'paused': true}), {'paused': 'true'});
      expect(sanitizeParams({'ok': false}), {'ok': 'false'});
    });

    test('passes strings and numbers through untouched', () {
      final out = sanitizeParams({
        'monitor_type': 'http',
        'interval_seconds': 300,
        'usd': 5.5,
      });
      expect(out, {
        'monitor_type': 'http',
        'interval_seconds': 300,
        'usd': 5.5,
      });
    });

    test('drops nulls instead of sending the string "null"', () {
      // `actionFailed` passes a nullable status; "null" would become a real
      // value in the status dimension.
      final out = sanitizeParams({'action': 'delete_monitor', 'status': null});
      expect(out, {'action': 'delete_monitor'});
      expect(out.containsKey('status'), isFalse);
    });

    test('an all-null map produces an empty map, not a map of "null"s', () {
      expect(sanitizeParams({'a': null, 'b': null}), isEmpty);
    });
  });
}
