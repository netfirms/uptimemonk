/**
 * Public status-page slugs.
 *
 * The slug becomes a public URL, so it is not merely a label: it is chosen by
 * one customer and visible to everyone, and two customers cannot have the
 * same one. That makes validation and uniqueness security-adjacent rather
 * than cosmetic.
 */

export class InvalidSlugError extends Error {}

/** Names that would collide with a route, imply endorsement, or mislead. */
const RESERVED = new Set([
  // Routes on the same host.
  "status", "dashboard", "api", "admin", "app", "www", "assets", "_next",
  "static", "public", "health", "healthz", "login", "signin", "signup",
  "verify", "billing", "donate", "support", "help", "docs", "blog",
  // Speaking for us.
  "uptimemonke", "uptimemonk", "official", "security", "abuse", "root",
  "system", "team", "staff",
]);

/**
 * A slug is lowercase letters, digits and single hyphens.
 *
 * Deliberately narrow. Anything richer invites homograph tricks — a status
 * page at a name that reads as someone else's brand in a different script is
 * a phishing page we would be hosting.
 */
export function normaliseSlug(input: unknown): string {
  const raw = String(input ?? "").trim().toLowerCase();

  if (!raw) throw new InvalidSlugError("Choose an address for your status page");
  if (raw.length < 3) throw new InvalidSlugError("Too short — use at least 3 characters");
  if (raw.length > 40) throw new InvalidSlugError("Too long — 40 characters at most");

  if (!/^[a-z0-9-]+$/.test(raw)) {
    throw new InvalidSlugError("Use lowercase letters, numbers and hyphens only");
  }
  if (raw.startsWith("-") || raw.endsWith("-")) {
    throw new InvalidSlugError("Cannot start or end with a hyphen");
  }
  if (raw.includes("--")) {
    throw new InvalidSlugError("Cannot contain two hyphens in a row");
  }
  if (RESERVED.has(raw)) {
    throw new InvalidSlugError("That address is reserved — pick another");
  }
  // A 20-character hex-ish string is what a Firestore id looks like, and
  // `/status/<orgId>` already resolves. Letting someone claim a string shaped
  // like another workspace's id invites confusion at best.
  if (/^[a-za-z0-9]{20}$/i.test(raw) && !raw.includes("-")) {
    throw new InvalidSlugError("Pick something more readable than an id");
  }

  return raw;
}

/** A starting suggestion from the workspace name — never auto-claimed. */
export function suggestSlug(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base.length >= 3 ? base : "";
}

export function normaliseOrgName(input: unknown): string {
  const name = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw new InvalidSlugError("A workspace needs a name");
  if (name.length > 60) throw new InvalidSlugError("Too long — 60 characters at most");
  return name;
}
