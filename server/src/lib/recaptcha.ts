import { RECAPTCHA_MIN_SCORE, RECAPTCHA_SECRET } from "../config.js";
import { log } from "./log.js";

/**
 * reCAPTCHA v3 verification.
 *
 * What this can and cannot protect is worth being precise about, because it
 * is easy to install and feel safer than you are.
 *
 * Sign-up and sign-in happen in the browser, straight against Google's
 * identitytoolkit — this server never sees them, so it cannot gate them. A
 * check run purely in the page is advice an attacker simply skips.
 *
 * What *is* enforceable is `/v1/bootstrap`, and that is the request with the
 * actual cost: it creates a workspace, which is a Firestore document, a
 * scheduler slot and a free capacity allowance. A bot that manages to create
 * a Firebase account but cannot create a workspace has achieved nothing and
 * costs nothing, and Google rate-limits the account creation itself.
 *
 * So the token is minted in the browser at sign-up and spent here.
 */

export interface RecaptchaVerdict {
  ok: boolean;
  score?: number;
  reason?: string;
}

/** Off entirely until a secret is set, like the other integrations. */
export const recaptchaEnabled = () => Boolean(RECAPTCHA_SECRET);

export async function verifyRecaptcha(
  token: string | undefined,
  expectedAction: string,
  remoteIp?: string
): Promise<RecaptchaVerdict> {
  if (!RECAPTCHA_SECRET) return { ok: true, reason: "not configured" };

  if (!token) return { ok: false, reason: "missing token" };

  let body: {
    success?: boolean;
    score?: number;
    action?: string;
    "error-codes"?: string[];
  };

  try {
    const params = new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(8_000),
    });
    body = (await res.json()) as typeof body;
  } catch (err) {
    /**
     * Google being unreachable must not stop people signing up. An outage at
     * a spam filter is not a reason to close the front door — failing open
     * here trades a little spam risk for not being down because someone
     * else is.
     */
    log.warn({ err }, "recaptcha verification unreachable — allowing");
    return { ok: true, reason: "verifier unreachable" };
  }

  if (!body.success) {
    return { ok: false, score: body.score, reason: (body["error-codes"] ?? []).join(",") || "rejected" };
  }

  /**
   * The action must match. Without this check a token minted on any other
   * page of the site — or any other site sharing the key — is accepted here,
   * which is most of the point of v3's action field.
   */
  if (body.action !== expectedAction) {
    return { ok: false, score: body.score, reason: `action was ${body.action}` };
  }

  const score = body.score ?? 0;
  if (score < RECAPTCHA_MIN_SCORE) {
    return { ok: false, score, reason: `score ${score} below ${RECAPTCHA_MIN_SCORE}` };
  }

  return { ok: true, score };
}
