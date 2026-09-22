/// Which screen a signed-in session should land on.
///
/// Pulled out of `AuthViewModel` so it can be tested without standing up
/// Firebase, the same way `needsEmailConfirmation` is. It is worth testing:
/// getting it wrong means either a dead end (a valid session shown a login
/// form) or an error screen in front of somebody whose account is fine.
library;

enum AuthDestination {
  /// Still resolving — show the splash.
  loading,

  /// No session. The login form is correct here.
  login,

  /// Password account whose address is unconfirmed.
  verifyEmail,

  /// Signed in and confirmed, but the workspace could not be loaded.
  workspaceUnavailable,

  /// Everything resolved.
  dashboard,
}

AuthDestination resolveDestination({
  required bool initial,
  required bool signedIn,
  required bool needsEmailVerification,
  required String? orgId,
  required bool workspaceLookupFailed,
}) {
  if (initial) return AuthDestination.loading;
  if (!signedIn) return AuthDestination.login;
  if (needsEmailVerification) return AuthDestination.verifyEmail;
  if (orgId != null) return AuthDestination.dashboard;

  // Signed in, confirmed, no workspace. Only a *failed* lookup earns the
  // error screen — a lookup still in flight must not flash one, so an
  // unattempted lookup falls back to the splash rather than to login.
  return workspaceLookupFailed
      ? AuthDestination.workspaceUnavailable
      : AuthDestination.loading;
}
