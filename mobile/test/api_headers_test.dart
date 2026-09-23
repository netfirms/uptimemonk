import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/services/api_client.dart';

/// The header rule that broke five features in production.
///
/// Fastify rejects an empty body declared as `application/json` with
/// `FST_ERR_CTP_EMPTY_JSON_BODY`. Every bodyless call in this client used to
/// send the header regardless, so pausing a monitor, deleting a monitor,
/// deleting an alert contact, unregistering the device on sign-out and
/// deleting an account all answered 400 — and each caller turned that into a
/// generic toast, so nothing looked broken enough to investigate.
///
/// The web client hit this once and fixed it there only. These tests are what
/// stops the same fix being needed a third time.
void main() {
  group('buildHeaders', () {
    test('a bodyless request does not claim to send JSON', () {
      final h = buildHeaders(token: 't', json: false);
      expect(
        h.containsKey('content-type'),
        isFalse,
        reason: 'declaring JSON with no body is FST_ERR_CTP_EMPTY_JSON_BODY',
      );
    });

    test('a request with a body declares the type', () {
      final h = buildHeaders(token: 't', json: true);
      expect(h['content-type'], 'application/json');
    });

    test('the token is always carried, either way', () {
      expect(buildHeaders(token: 'abc', json: false)['authorization'], 'Bearer abc');
      expect(buildHeaders(token: 'abc', json: true)['authorization'], 'Bearer abc');
    });
  });

  group('client identification', () {
    test('x-client stays exactly "mobile"', () {
      // The server's bot gate keys on this literal, and the app cannot mint a
      // reCAPTCHA token. Narrowing it to a platform name — which is tempting,
      // since the platform is right there — would re-arm the captcha and break
      // sign-up on that platform.
      for (final json in [true, false]) {
        expect(buildHeaders(token: 't', json: json)['x-client'], 'mobile');
      }
    });

    test('the platform travels in its own header', () {
      // Read by the server to withhold every payment path from the iOS build
      // (App Store Guideline 3.1.1). Separate from x-client precisely so the
      // two concerns cannot collide.
      final h = buildHeaders(token: 't', json: false);
      expect(h.containsKey('x-platform'), isTrue);
      expect(h['x-platform'], anyOf('ios', 'android'));
    });

    test('identification does not depend on whether a body is sent', () {
      final withBody = buildHeaders(token: 't', json: true);
      final without = buildHeaders(token: 't', json: false);
      expect(withBody['x-client'], without['x-client']);
      expect(withBody['x-platform'], without['x-platform']);
    });
  });
}
