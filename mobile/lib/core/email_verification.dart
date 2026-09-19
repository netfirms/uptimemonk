/// The rule for whether an account still has a confirmation link to click.
///
/// Kept as a plain function, separate from `AuthViewModel`, so it can be
/// tested without standing up Firebase — the view model touches
/// `FirebaseAuth.instance` in its constructor.
///
/// Must stay in step with `needsEmailConfirmation` in `server/src/api/auth.ts`
/// and `web/src/lib/authProviders.ts`. The server is the enforcement; this
/// copy decides which screen the app shows. If they disagree the user gets the
/// worst of both: a dashboard where nothing loads, or a confirmation screen
/// for an address that needs no confirming.
library;

const String passwordProvider = 'password';

/// True when this account still has a confirmation link to click.
///
/// The gate exists for one attack: anyone can type any address into a
/// registration form, so a password account proves it owns the address before
/// it can do anything. A federated sign-in has already proven it.
///
/// It has to key on the provider rather than on [emailVerified], because
/// Firebase only sets that flag for Google — GitHub and Apple sign-ins arrive
/// with it false, and gating on the flag alone would strand those users behind
/// a link that does not exist for them.
///
/// [signInProvider] comes from the ID token and is what the server gates on,
/// so it wins whenever it is known. It is null in the moment between signing
/// in and the token resolving; there [linkedProviderIds] stands in, so a
/// federated user never sees the confirmation screen flash past.
bool needsEmailConfirmation({
  required String? email,
  required bool emailVerified,
  required String? signInProvider,
  required List<String> linkedProviderIds,
}) {
  if (email == null || email.isEmpty) return false;
  if (emailVerified) return false;

  if (signInProvider != null) return signInProvider == passwordProvider;

  return linkedProviderIds.isNotEmpty &&
      linkedProviderIds.every((id) => id == passwordProvider);
}
