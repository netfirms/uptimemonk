import type { FastifyInstance } from "fastify";
import { auth, col } from "../sync/firebase.js";
import { requireAdmin, requireAuth } from "./auth.js";
import { listMonitors, getOrgCredit, creditLedger } from "../db/repo.js";
import { budgetFor, standingOf } from "../lib/credits.js";
import { readinessSummary } from "../lib/readiness.js";
import { readFileSync } from "node:fs";
import {
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
