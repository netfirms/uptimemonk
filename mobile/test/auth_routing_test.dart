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

  group('deleting an account', () {
    test('goes straight to login instead of the error screen', () {
      // The bug this exists for: deleting the account makes the next forced
      // token refresh fail, which lands in the same catch as a broken
      // workspace lookup. The router then showed workspaceUnavailable — an
      // error — for the moment between the account going and sign-out
      // completing. Someone who just asked to be deleted was told something
      // had gone wrong.
      expect(
        resolveDestination(
          initial: false,
          signedIn: true,
          needsEmailVerification: false,
          orgId: null,
          workspaceLookupFailed: true,
          deletingAccount: true,
        ),
        AuthDestination.login,
      );
    });

    test('outranks a dashboard that is still resolvable', () {
      // The org id may still be cached when the delete returns. Showing the
      // dashboard for an account that no longer exists is worse than showing
      // the login screen a moment early.
      expect(
        resolveDestination(
          initial: false,
          signedIn: true,
          needsEmailVerification: false,
          orgId: 'org_abc',
          workspaceLookupFailed: false,
          deletingAccount: true,
        ),
        AuthDestination.login,
      );
    });

    test('does not outrank the initial splash', () {
      // Before auth has resolved there is nothing to delete and nothing to
      // show; jumping to login here would flash a form at someone who is
      // already signed in.
      expect(
        resolveDestination(
          initial: true,
          signedIn: false,
          needsEmailVerification: false,
          orgId: null,
          workspaceLookupFailed: false,
          deletingAccount: true,
        ),
        AuthDestination.loading,
      );
    });

    test('a genuine workspace failure still earns the error screen', () {
      // The narrow case must stay narrow: a real broken lookup is what that
      // screen and its retry button are for.
      expect(
        resolveDestination(
          initial: false,
          signedIn: true,
          needsEmailVerification: false,
          orgId: null,
          workspaceLookupFailed: true,
          deletingAccount: false,
        ),
        AuthDestination.workspaceUnavailable,
      );
    });
  });
}
