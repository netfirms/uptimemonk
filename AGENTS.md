# UptimeMonk — agent context

An UptimeRobot-style uptime monitoring SaaS. **Firebase for people, a fleet of
AWS Lightsail workers for the work.** Read this before changing anything: most
of what follows is counter-intuitive and was arrived at by measurement, not
preference.

## This is running in production right now

| | |
|---|---|
| Dashboard | https://uptimemonke.com (Firebase Hosting) |
| API | https://api.uptimemonke.com (worker, Caddy + Let's Encrypt) |
| Worker `sg-1` | `ssh uptimemonk-worker-1` → 47.129.253.94, ap-southeast-1a |
| Hardware | $5 Lightsail: 2 vCPU, **414 MB RAM**, 1 GB swap |
| GCP project | `uptimemonk` (project id — unchanged by the domain rename) |
| Firebase plan | **Spark (free)**. No Cloud Functions exist or can be deployed. |

Live checks are running. `curl https://api.uptimemonke.com/healthz` should
return `"status":"ok"` with `lagMs` near 0. If `lagMs` climbs, the scheduler is
wedged — that is the failure mode that matters, not process liveness.

## Commands

```bash
npm --prefix server test     # 91 tests, no network or emulator needed
npm run test:rules           # 16 rules tests; needs the Firestore emulator
npm run emulators            # firebase-tools@14 — v15 requires Java 21, host has 17
npm run deploy               # deploy/deploy-all.sh (Firebase + Lightsail)
npm run deploy:lightsail     # worker only
```

Deploys run the test suite first and will refuse to ship a failing tree.

## The two rules everything else follows from

**1. One writer per field.** Hybrid systems rot when two runtimes write the
same document. The worker fleet owns every piece of monitor *state*; the
dashboard writes nothing but its own alert-contact names. Firestore rules
enforce this — `scripts/rules.test.mjs` asserts it. Monitor create/edit/pause
all go through the worker API, never direct Firestore writes.

**2. Check results never reach Firestore.** They land in SQLite on the worker.
Firestore holds only an aggregated status mirror: **one document per org**,
flushed every 5 min, plus an immediate write on any state change.

Rule 2 is what makes the free tier viable. Firestore bills per *document*, so
one doc per org makes the write bill independent of monitor count:

| Approach | Monitors supported on Spark |
|---|---|
| Per-check writes | ~34 |
| Per-monitor mirror | ~69 |
| **Per-org mirror (current)** | **~5,000 across ~50 orgs** |

## Invariants that look like bugs but are not

Each of these was a real failure. Do not "fix" them without re-measuring.

**`better-sqlite3` is synchronous.** Every query blocks the event loop. Results
are buffered and flushed in one transaction every 5 s — a thousand rows costs
~1 ms. Per-check writes would hand the loop a syscall per probe during 50+
concurrent sockets.

**Any `recordResult` path without the worker's flush timer must call `flush()`
itself.** `startFlushLoop()` runs only in the worker process. `/heartbeat/:token`
is an *API* route: without its explicit `flush()`, a recovered heartbeat monitor
stayed red forever while its due time kept advancing, so it was never rechecked.
See the regression test in `monitors/recordResult.test.ts`.

**`dueAt += interval`, never `dueAt = now + interval`.** The latter lets slow
probes drift until a 5-minute monitor quietly runs every 6. Catch-up is capped
so a restart does not replay a backlog. See `scheduler/heap.ts`.

**Keep-alive is deliberately OFF** (`probe/agent.ts`, `keepAliveTimeout: 1`). A
reused socket skips DNS, TCP and TLS, so response times read artificially fast
and an expiring certificate stays invisible. We measure what a first-time
visitor experiences.

**No per-check rows.** One row per monitor per hour: counters plus a JSON
sample array. At 5,000 monitors that is 120k inserts/day instead of 1.44M.

**`lib/targetGuard.ts` is load-bearing security, not validation politeness.**
Probe targets are attacker-controlled by design and requests leave from inside
the cloud. **AWS's metadata service answers on the same `169.254.169.254` as
Google's.** The guard resolves every hostname and checks every returned address
(a name can resolve to a link-local IP), re-validates every redirect hop, and
strips headers like `Metadata-Flavor`. IMDSv2 is enforced on the instance as a
second lock. Never bypass it for "internal" monitors.

**ICMP works through `ping`'s own file capability**, not through a capability
granted to Node. Ubuntu ships `/usr/bin/ping` with `cap_net_raw=ep`.
Measured: this works with `NoNewPrivileges=true`, but **breaks with an empty
`CapabilityBoundingSet`** — `execve()` on a binary whose permitted file caps
fall outside the bounding set fails with `EPERM`. Do not "harden" the unit by
adding `CapabilityBoundingSet=` without re-testing that ping still runs.

**The service-account key is `440 root:uptimemonk`, not `400`.** systemd's
`LoadCredential` reads it as root; anything reading it as the service user gets
`EACCES` and the worker will not start.

**Work is sharded by organisation, not by monitor** (`scheduler/assignment.ts`).
That follows from rule 1: the status mirror is one doc per org, so splitting an
org across workers would put two writers on one document. Ownership is
`hash(orgId) % WORKER_COUNT == WORKER_INDEX`, filtered by region — computed
locally, no leases, no lock service.

**There is no Redis and should not be.** Firestore's realtime listener *is* the
queue: it is the durable log and re-delivers everything on reconnect, so an
hour of downtime replays for free. Nothing on the Firebase side can speak Redis
anyway — Firestore's only push mechanism is a Cloud Function trigger, and Spark
has none, so the only possible publisher is a worker, which makes it a loop.

**Config sync must never reset live state.** On reconnect the listener
re-delivers every document as "added". `upsertMonitorConfig` deliberately
excludes `status`, `due_at` and failure counts; otherwise every reconnect would
restart every monitor's state machine.

## Layout

```
server/src/
  worker.ts             probe process entrypoint
  api.ts                HTTP process entrypoint (Fastify)
  config.ts             env config; refuses to boot half-configured
  scheduler/
    assignment.ts       which worker owns which org — read before scaling out
    heap.ts             min-heap + drift-free due-time arithmetic
    scheduler.ts        the check loop (replaces Cloud Scheduler; no 60s floor)
    rollup.ts           nightly compaction + retention
  probe/
    agent.ts            undici dispatcher, keep-alive off
    pool.ts             bounded concurrency
    verify.ts           HMAC-signed cross-region confirmation
  checks/               http · keyword · tcp · dns · ssl · icmp
  monitors/
    stateMachine.ts     pure up/down decision (heavily tested)
    recordResult.ts     buffering, incidents, outbox
    validate.ts         plan limits + SSRF guard — the single write path
  alerts/
    channels.ts         email · slack · discord · telegram · webhook
    drainer.ts          transactional outbox → network, with backoff
  sync/
    configListener.ts   Firebase → worker (listener + periodic reconcile)
    mirror.ts           worker → Firebase, aggregated per org
  db/                   connection, pragmas, repo, numbered SQL migrations

deploy/                 systemd units, Caddyfile, provision.sh, deploy scripts
web/                    Next.js dashboard (static export on Spark)
firestore.rules         tenancy; monitors are backend-only
functions/              LEGACY Firebase-only build. Not deployed. Reference only.
creds/                  gitignored. Real service-account key lives here.
```

Two systemd units run on each worker: `uptimemonk-worker` (scheduler, probes,
alerts) and `uptimemonk-api` (HTTP). Split so deploying the API never pauses
monitoring. Both are held by `ConditionPathExists=/etc/uptimemonk/sa.json` —
if that is missing they are *skipped with a readable reason* rather than
crash-looping.

## Known gaps

- **`RESEND_API_KEY` is empty, so no alert can be delivered.** Monitoring that
  cannot page anyone is the worst state this product can be in. Highest priority.
- **No dead-man's switch** (`UPTIMEMONK_HEARTBEAT_URL` empty). One worker means
  nothing notices if the box dies — and it dies silently. Use a *different*
  provider; a monitor that monitors itself proves nothing.
- **Rebalancing does not transfer state.** A worker inheriting an org has no
  SQLite history, so its monitors restart at `pending` and incidents open on the
  previous owner are orphaned. Fix is to seed from the `orgStatus` mirror on
  adoption. Not built.
- Litestream off-box backup not wired into provisioning.
- Stripe billing routes not ported from `functions/`.
- Alert-contact verification exists in `functions/` but is not yet a worker route.
- Status pages lose SSR on Spark; serve from a worker to keep SEO.

## Scaling out

Every worker runs the same build, differing only by identity:

```
UPTIMEMONK_REGION=ap-southeast-1
UPTIMEMONK_WORKER_ID=sg-2
UPTIMEMONK_WORKER_INDEX=1      # 0-based
UPTIMEMONK_WORKER_COUNT=3      # must be identical on every worker in the region
```

Raising `WORKER_COUNT` is **not** a safe rolling operation. While workers
disagree about the count, some orgs are claimed twice and others by nobody.
Raise it everywhere, then restart.

The $5 plan's 414 MB is below the 1 GB the defaults assume, so
`PROBE_CONCURRENCY=50` and the systemd `MemoryMax` values are tuned down.
Moving to the $7 plan means raising both together.

## Boundaries

- **Never commit anything under `creds/`** or paste a key into a file, log or
  commit message. It is gitignored; keep it that way.
- Secrets live in `/etc/uptimemonk/env` (0600 root) on the worker. Do not echo
  them in scripts or CI output.
- The worker is production and is actively monitoring. Restarting
  `uptimemonk-worker` pauses checks for that org shard — deploy the API alone
  when the worker has not changed.
- Ask before opening firewall ports, changing DNS, or touching billing.
