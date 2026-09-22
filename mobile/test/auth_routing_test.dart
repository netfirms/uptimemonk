import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth_routing.dart';

AuthDestination where({
  bool initial = false,
  bool signedIn = true,
  bool needsEmailVerification = false,
  String? orgId,
  bool workspaceLookupFailed = false,
}) =>
    resolveDestination(
      initial: initial,
      signedIn: signedIn,
      needsEmailVerification: needsEmailVerification,
      orgId: orgId,
      workspaceLookupFailed: workspaceLookupFailed,
    );

void main() {
  group('where a session lands', () {
    test('no session goes to the login form', () {
      expect(where(signedIn: false), AuthDestination.login);
    });

    test('a resolved session goes to the dashboard', () {
      expect(where(orgId: 'org-1'), AuthDestination.dashboard);
    });

    test('an unconfirmed address goes to the verify screen', () {
      expect(
        where(needsEmailVerification: true),
        AuthDestination.verifyEmail,
      );
    });

    test('verification outranks a missing workspace', () {
      // orgId is deliberately left null while unverified, so without this
      // ordering an unverified user would be told the workspace failed.
      expect(
        where(needsEmailVerification: true, workspaceLookupFailed: true),
        AuthDestination.verifyEmail,
      );
    });

    test('a failed lookup gets its own screen, never the login form', () {
      // The bug this exists to prevent: a valid session shown a sign-in
      // prompt, repeating on every launch, reading as permanently logged out.
      expect(
        where(workspaceLookupFailed: true),
        AuthDestination.workspaceUnavailable,
      );
    });

    test('a lookup still in flight shows the splash, not an error', () {
      // No orgId yet and nothing has failed — flashing an error screen here
      // would be a lie about a request that is still running.
      expect(where(workspaceLookupFailed: false), AuthDestination.loading);
    });

    test('the initial state wins over everything', () {
      expect(
        where(initial: true, orgId: 'org-1', workspaceLookupFailed: true),
        AuthDestination.loading,
      );
    });

    test('signing out from a failed state returns to login', () {
      expect(
        where(signedIn: false, workspaceLookupFailed: true),
        AuthDestination.login,
      );
    });
  });
}
