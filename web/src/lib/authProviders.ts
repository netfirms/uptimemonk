import type { User } from "firebase/auth";

/**
 * Email confirmation applies to password sign-ups, and nothing else.
 *
 * Must stay in step with `needsEmailConfirmation` in `server/src/api/auth.ts`.
 * The server is the enforcement; this copy exists so the dashboard shows the
 * right screen rather than rendering and then failing every request. If the
 * two disagree the customer gets the worst of both: a working-looking
 * dashboard where nothing loads, or a confirmation screen for an address that
 * needs no confirming.
 *
 * The gate exists for one attack: anyone can type any address into a
 * registration form. A federated sign-in has already proven the address — it
 * comes from the provider, not from the user — and Firebase only sets
 * `emailVerified` for Google anyway, so gating on that flag alone would lock
 * GitHub and Apple users out of accounts they could never unlock.
 */
const PASSWORD_PROVIDER = "password";

/**
 * True when this user still has a confirmation link to click.
 *
 * `signInProvider` comes from the ID token and is what the server actually
 * gates on, so it wins whenever it is known. It is `undefined` for the moment
 * between a sign-in and the token resolving — `Landing` sets the user straight
 * into state — and in that window the account's own providers stand in, so a
 * Google user never sees the confirmation screen flash past. An account with
 * any federated provider linked is not asked to confirm.
 */
export function needsEmailConfirmation(
  user: Pick<User, "email" | "emailVerified" | "providerData">,
  signInProvider?: string | null
): boolean {
  if (!user.email) return false;
  if (user.emailVerified) return false;

  if (signInProvider != null) {
    return signInProvider === PASSWORD_PROVIDER;
  }

  return (
    user.providerData.length > 0 &&
    user.providerData.every((p) => p.providerId === PASSWORD_PROVIDER)
  );
}
