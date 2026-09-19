import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/services/api_client.dart';
import 'package:mobile/core/constants.dart';

// These tests stay offline: they cover the parts of ApiClient that do not
// touch FirebaseAuth. The request paths (_authHeaders and everything that
// calls it) require a signed-in Firebase user and belong in an
// emulator-backed integration test, not here.

void main() {
  group('ApiClient construction', () {
    test('defaults baseUrl to the worker API', () {
      final client = ApiClient();
      expect(client.baseUrl, AppConstants.apiUrl);
    });

    test('accepts an overridden baseUrl', () {
      final client = ApiClient(baseUrl: 'https://staging.example.test');
      expect(client.baseUrl, 'https://staging.example.test');
    });
  });

  group('ApiException', () {
    test('carries the status code and message', () {
      final e = ApiException('Not found', 404);
      expect(e.statusCode, 404);
      expect(e.message, 'Not found');
    });

    test('toString includes both the code and the message', () {
      final e = ApiException('Forbidden', 403);
      expect(e.toString(), contains('403'));
      expect(e.toString(), contains('Forbidden'));
    });

    test('is an Exception', () {
      expect(ApiException('x', 500), isA<Exception>());
    });

    test('a 401 reads as an auth failure for the UI to surface', () {
      final e = ApiException('You must be signed in to perform this action', 401);
      expect(e.statusCode, 401);
      expect(e.message, contains('signed in'));
    });
  });
}
