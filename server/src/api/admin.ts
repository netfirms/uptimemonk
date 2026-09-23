import type { FastifyInstance } from "fastify";
import { auth, col } from "../sync/firebase.js";
import { requireAdmin, requireAuth } from "./auth.js";
import {
  deleteAccountAndData,
  findOwnedOrg,
  otherMembersOf,
} from "../lib/accountDeletion.js";
import { listMonitors, getOrgCredit, creditLedger } from "../db/repo.js";
import { budgetFor, standingOf } from "../lib/credits.js";
import { readinessSummary } from "../lib/readiness.js";
import { readFileSync } from "node:fs";
import { log } from "../lib/log.js";

/**
 * Whether an account is shielded from deletion.
 *
 * An operator cannot delete an operator, themselves included. `requireAdmin`
 * fails closed on an empty allowlist, so emptying it by deleting the last
 * administrator would lock everyone out of this console permanently — with no
 * way back in through the console itself.
 *
 * Matching lowercases both sides because addresses are case-insensitive and
 * the allowlist is written by hand.
 */
export function isProtectedAccount(
  email: string | null | undefined,
  admins: string[]
): boolean {
  if (!email) return false;
  return admins.map((a) => a.toLowerCase()).includes(email.toLowerCase());
}

/** Same shape the config endpoint uses: enough to recognise, not to reuse. */
function maskForDisplay(val: unknown): string {
  const str = String(val ?? "");
  if (!str) return "";
  if (str.length <= 8) return "•".repeat(str.length);
  return str.slice(0, 4) + "•".repeat(Math.min(str.length - 8, 20)) + str.slice(-4);
}
import {
  ADMIN_EMAILS,
  SECRET_CONFIG_KEYS,
  getEffectiveConfig,
  API_VERSION,
  REGION,
  WORKER_ID,
  WORKER_INDEX,
  WORKER_COUNT,
} from "../config.js";

/** Written by the worker, read by the API — the same file `/healthz` uses. */
const STATUS_FILE = process.env.UPTIMEMONK_STATUS_FILE ?? "/var/lib/uptimemonk/worker.json";

/**
 * The operations console's data.
 *
 * Every route here is behind `requireAdmin`, which is an explicit allowlist
 * and not the `owner` role — every customer is an owner of their own
 * workspace, so using that would have handed the whole fleet's data to
 * anyone who signed up.
 *
 * The console previously rendered invented accounts and invented workers.
 * Fabricated operational data is worse than none: it reads as the truth, and
 * an operator makes decisions from it.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [requireAuth(), requireAdmin] };

  /** Every account, joined to the workspace it owns. */
  app.get("/v1/admin/users", guard, async () => {
    const [accounts, orgs] = await Promise.all([
      auth().listUsers(1000),
      col.orgs().get(),
    ]);

    const orgByOwner = new Map<string, { id: string; name: string; plan: string }>();
    for (const d of orgs.docs) {
      const v = d.data();
      if (typeof v.ownerUid === "string") {
        orgByOwner.set(v.ownerUid, {
          id: d.id,
          name: (v.name as string) ?? "",
          plan: (v.plan as string) ?? "free",
        });
      }
    }

    return {
      users: accounts.users.map((u) => {
        const org = orgByOwner.get(u.uid);
        const credit = org ? getOrgCredit(org.id) : null;
        return {
          uid: u.uid,
          email: u.email ?? null,
          name: u.displayName ?? null,
          emailVerified: u.emailVerified,
          providers: u.providerData.map((p) => p.providerId),
          disabled: u.disabled,
          createdAt: u.metadata.creationTime ?? null,
          lastSignIn: u.metadata.lastSignInTime ?? null,
          orgId: org?.id ?? null,
          orgName: org?.name ?? null,
          plan: org?.plan ?? null,
          // Counted from the worker's own tables, not guessed.
          monitorsCount: org ? listMonitors(org.id).length : 0,
          creditsRemaining: credit?.credits ?? 0,
          standing: credit ? standingOf(credit) : null,
        };
      }),
    };
  });

  /**
   * Erase an account and the workspace it owns.
   *
   * Irreversible, and it removes monitoring other people may be relying on,
   * so the rules are deliberately narrow:
   *
   * - An operator cannot delete an operator, themselves included. Otherwise
   *   one misclick empties the allowlist and nobody can reach this console
   *   again — `requireAdmin` fails closed on an empty list by design.
   * - A workspace with other members attached is refused rather than
   *   silently taking them down with it. Bootstrap only ever creates owners
   *   today, so this should never fire; it is here because "should never"
   *   stops being true the moment invites ship.
   *
   * Order matters and is chosen to fail safe. The data goes first and the
   * account last: if this dies halfway, the account survives owning nothing,
   * and signing in simply bootstraps a fresh workspace. The reverse order
   * leaves data no one owns, which is exactly the orphaned-workspace state
   * this console had to clean up by hand once already.
   */
  app.delete<{ Params: { uid: string } }>(
    "/v1/admin/users/:uid",
    guard,
    async (req, reply) => {
      const { uid } = req.params;

      let account;
      try {
        account = await auth().getUser(uid);
      } catch {
        return reply.code(404).send({ error: "No such account" });
      }

      if (isProtectedAccount(account.email, ADMIN_EMAILS)) {
        return reply.code(403).send({
          error: "Administrators cannot be deleted from the console.",
          code: "admin-protected",
        });
      }

      const orgId = await findOwnedOrg(uid);
      if (orgId && (await otherMembersOf(orgId, uid))) {
        const others = await otherMembersOf(orgId, uid);
        return reply.code(409).send({
          error: `That workspace has ${others} other member(s). Move or remove them first.`,
          code: "org-has-members",
        });
      }

      // The deletion itself lives in lib/accountDeletion so this and the
      // self-service route cannot drift into deleting different things.
      const result = await deleteAccountAndData(uid, "operator", req.user?.email);
      return { deleted: true, ...result };
    }
  );

  /**
   * The fleet.
   *
   * One entry, because there is one worker. The console listed three, two of
   * which have never existed — inventing `sg-2` and `sg-3` made the system
   * look redundant when a single box failing takes everything with it.
   */
  app.get("/v1/admin/workers", guard, async () => {
    // The same file `/healthz` reads. The worker writes it; the API only
    // looks, so a stale or missing file means the worker is the problem.
    let status: {
      lagMs?: number;
      queueDepth?: number;
      scheduled?: number;
      updatedAt?: number;
    } | null = null;
    try {
      status = JSON.parse(readFileSync(STATUS_FILE, "utf8"));
    } catch {
      status = null;
    }
    return {
      workers: [
        {
          id: WORKER_ID,
          region: REGION,
          index: WORKER_INDEX,
          count: WORKER_COUNT,
          version: API_VERSION,
          status: "active",
          lagMs: status?.lagMs ?? null,
          queueDepth: status?.queueDepth ?? null,
          scheduled: status?.scheduled ?? null,
          updatedAt: status?.updatedAt ?? null,
        },
      ],
      readiness: readinessSummary(),
    };
  });

  /**
   * The live config document, for the console to edit.
   *
   * Read through the worker rather than from the browser: `system/config` is
   * backend-only in the rules, because it holds credentials and every
   * customer used to be able to read *and write* it.
   *
   * Secrets come back masked. An operator setting one does not need to read
   * the old value back, and a console that displays them is one screenshot
   * away from leaking them.
   */
  app.get("/v1/admin/system-config", guard, async () => {
    const snap = await col.system().doc("config").get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = (SECRET_CONFIG_KEYS as readonly string[]).includes(k)
        ? maskForDisplay(v)
        : v;
    }
    return { config: out, exists: snap.exists };
  });

  /**
   * Save it.
   *
   * Only keys the config actually has are written — an open merge would let
   * the console (or anything that could reach it) put arbitrary fields into a
   * document the workers read.
   *
   * A masked value means "unchanged". The console renders secrets masked, so
   * saving the form would otherwise write the bullets back over the real key
   * and silently break email or payments.
   */
  app.put<{ Body: Record<string, unknown> }>(
    "/v1/admin/system-config",
    guard,
    async (req, reply) => {
      const incoming = req.body ?? {};
      const known = new Set(Object.keys(getEffectiveConfig()));
      const patch: Record<string, unknown> = {};
      const ignored: string[] = [];

      for (const [k, v] of Object.entries(incoming)) {
        if (!known.has(k)) {
          ignored.push(k);
          continue;
        }
        if (
          (SECRET_CONFIG_KEYS as readonly string[]).includes(k) &&
          typeof v === "string" &&
          (v.includes("•") || v === "")
        ) {
          continue; // masked or blank: leave whatever is stored alone
        }
        patch[k] = v;
      }

      if (!Object.keys(patch).length) {
        return reply.code(400).send({ error: "Nothing to change", ignored });
      }

      patch.updatedAt = new Date().toISOString();
      patch.updatedBy = req.user!.email ?? req.user!.uid;

      await col.system().doc("config").set(patch, { merge: true });
      log.info(
        { by: req.user!.email, keys: Object.keys(patch).length, ignored: ignored.length },
        "system config updated"
      );
      return { saved: Object.keys(patch).length, ignored };
    }
  );

  /** Fleet-wide monitor totals, straight from SQLite. */
  app.get("/v1/admin/monitors", guard, async () => {
    const all = listMonitors();
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const m of all) {
      byType[m.type] = (byType[m.type] ?? 0) + 1;
      const s = m.enabled ? m.status : "paused";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return { total: all.length, byType, byStatus };
  });

  /** Donations, from the ledger rather than from Stripe's dashboard. */
  app.get("/v1/admin/donations", guard, async () => {
    const orgs = await col.orgs().get();
    const rows = [];
    for (const d of orgs.docs) {
      const credit = getOrgCredit(d.id);
      const ledger = creditLedger(d.id, 20).filter((e) => e.reason === "grant");
      if (!ledger.length && credit.credits === 0) continue;
      rows.push({
        orgId: d.id,
        orgName: (d.data().name as string) ?? "",
        credits: credit.credits,
        budgetPerDay: budgetFor(credit),
        standing: standingOf(credit),
        grants: ledger.map((e) => ({ at: e.at, delta: e.delta, note: e.note })),
      });
    }
    return { orgs: rows };
  });
}
