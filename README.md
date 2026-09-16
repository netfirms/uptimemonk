# UptimeMonke — an UptimeRobot-style monitoring SaaS

Firebase for people, a fleet of $5 workers for the work.

```
   Browser                Firebase (Spark)          Worker fleet (Lightsail)
  ┌─────────┐            ┌──────────────────┐     ┌────────────────────────┐
  │dashboard│──sign in──▶│ Auth             │     │ worker sg-1  shard 0/3 │
  │         │            │                  │     │  Fastify API           │
  │         │◀─onSnapshot│ Firestore        │◀───▶│  Scheduler (min-heap)  │──▶ targets
  │         │            │  · monitors      │     │  Probe pool (50)       │
  │         │──writes───────────────────────────▶ │  SQLite ◀ all history  │
  └─────────┘  Bearer ID │  · orgStatus     │     └────────────────────────┘
                  token  │  · incidents     │     ┌────────────────────────┐
                         │ Hosting (static) │◀───▶│ worker sg-2  shard 1/3 │
                         └──────────────────┘     └────────────────────────┘
                                                  ┌────────────────────────┐
                                                  │ worker sg-3  shard 2/3 │
                                                  └────────────────────────┘
```

A **worker** is one Lightsail instance. The system scales out by running more
of them: each owns a deterministic slice of the organisations, decided locally
from a stable hash with no coordination between workers.

**The high-volume path — every check, every response time — terminates in
SQLite on the worker that owns it.** Only an aggregated status document per organisation
crosses into Firestore. That single decision is what makes the Firestore bill
independent of monitor count, and what keeps a real product inside the free
tier.

> Working on this with an AI agent? Read **[AGENTS.md](AGENTS.md)** first — it
> carries the invariants that look like bugs but are not, and the boundaries
> around credentials and the live worker.

## What it does

| | |
|---|---|
| Check types | HTTP · keyword · TCP port · DNS record · SSL expiry · ICMP ping · cron heartbeat |
| Intervals | 5 s to 24 h, floored by plan |
| Confirmation | `confirmationThreshold` consecutive failures, plus cross-region verification when a peer is configured (see below) |
| Alerts | Email (Mailgun, falling back to Resend) · Slack · Discord · Telegram · webhook, through a transactional outbox. A monitor with no contacts chosen pages every confirmed contact in the org; `muteAlerts` is the explicit opt-out |
| History | Per-check samples for 35 days, then daily rollups; charts read the last 90 days |
| Charts | 24 h · 7 d · 30 d · 90 d, on the dashboard and the public status page |
| Status page | Public, per-monitor opt-in, at `/status/<org-id>` |

**Cross-region confirmation is currently inactive.** `verifyWithPeer` asks a
second worker whether it sees the same failure, which kills the largest source
of false alarms — a network blip between one probe and the target. It needs
`VERIFY_PEER_URL` and `VERIFY_SECRET`, and with a single worker there is no
peer, so it returns `unavailable` and the decision falls back to
`confirmationThreshold` alone. It starts working when a second worker exists.

### Plans

| Plan | Monitors | Fastest check |
|---|---|---|
| free | 10 | 60 s |
| solo | 50 | 5 s |
| team | 200 | 5 s |
| scale | 1,000 | 5 s |

Defined in one place, `server/src/lib/plans.ts`, and enforced in
`monitors/validate.ts` — the single write path. The free tier's 60 s floor is a
product decision, not a technical one: the old 300 s floor existed because
Firestore writes cost money per check, and that constraint disappeared when
history moved to SQLite.

### Public status pages

A monitor appears on its org's status page only if someone ticks **Show on
public status page** in the monitor form. Absence means private — a monitor
created before the field existed does not become public because the value is
missing.

The feed is `GET /v1/status/:slug`, unauthenticated, which makes its response
shape a security decision rather than a convenience:

- only opted-in monitors appear;
- names and health only — never the probe target, the keyword, the alert
  contacts or the last error;
- a paused monitor reads as `paused`, not as its stale last status;
- an unknown slug and a published-but-empty page return the **same** 404, so
  the endpoint cannot be walked to discover which orgs exist.

The page is client-rendered: a static export on Spark has no Node runtime, so
one shell is prerendered and a hosting rewrite points `/status/**` at it. That
costs server-rendered content for crawlers, so the page is `noindex` to match.
See Known gaps.

## Why this shape

The product was first built entirely on Firebase. Three hard limits killed it:

| Limit | Consequence | On a worker |
|---|---|---|
| Cloud Scheduler floors at 60s | No 30s or 10s tier — where competitor revenue is | A local heap ticks at any interval |
| No `CAP_NET_RAW` | No real ping, ever | `checks/icmp.ts` |
| Dynamic egress IP | Static IP needs VPC + NAT, $40–200/mo | Lightsail includes one free |

Cost went from ~$75/month at 2,500 monitors to ~$13/month for two probe
regions and roughly 5,000 monitors.

## Two rules the design depends on

**One writer per field.** Hybrid systems rot when two runtimes write the same
document. The worker fleet owns every piece of monitor *state*; the dashboard
writes monitor *configuration* only, and only by calling the worker API.
`firestore.rules` denies client writes to `monitors` outright — see
`scripts/rules.test.mjs`.

The API is not a formality. `target` becomes an outbound request from inside
our network, so it has to clear `targetGuard`, and plan limits need a count.
A security rule can do neither.

This rule is also why work is sharded by **organisation** rather than by
monitor: the status mirror is one document per org, so splitting an org across
workers would put two writers on one document.

**Firestore is the queue.** Config flows Firebase → workers through a realtime
listener, which re-delivers everything on reconnect. An hour of downtime costs
nothing because the durable store replays. There is no Redis, and adding one
would mean two sources of truth to reconcile.

## Scaling out

Every worker runs the same build. They differ only by three environment
variables:

```
UPTIMEMONK_REGION=ap-southeast-1   # probe vantage point
UPTIMEMONK_WORKER_ID=sg-2          # for logs
UPTIMEMONK_WORKER_INDEX=1          # 0-based position in the pool
UPTIMEMONK_WORKER_COUNT=3          # pool size — must match on every worker
```

Ownership is `hash(orgId) % WORKER_COUNT == WORKER_INDEX`, filtered by region.
No leases, no lock service, no shared database — every worker computes the same
answer independently, and `assignment.test.ts` asserts the invariant that
matters: **every org is owned by exactly one worker.**

Adding a worker means provisioning it, then raising `WORKER_COUNT` on *every*
worker in that region and restarting them. If they disagree about the count,
some organisations are probed twice and others not at all.

> **Rebalancing loses local state.** A worker that inherits an org has no
> SQLite history for it, so those monitors restart at `pending` and any
> incident still open on the previous owner is orphaned. See Known gaps — the
> fix is to seed from the Firestore mirror on adoption, and it is not built yet.
> Until then, rebalance during a quiet window and expect a brief `pending` gap.

## Layout

```
server/                 one worker. This is where the product runs.
  src/
    config.ts           env config; refuses to boot half-configured
    types.ts            domain types — epoch ms, no Firestore Timestamps
    db/
      index.ts          connection, pragmas, migration runner
      repo.ts           every query, including the batched result flush
      migrations/       numbered .sql, applied in order
    scheduler/
      assignment.ts     which worker owns which org — read before scaling out
      heap.ts           min-heap + drift-free due-time arithmetic
      scheduler.ts      the check loop
      rollup.ts         nightly compaction and retention
    probe/
      agent.ts          undici dispatcher, keep-alive deliberately OFF
      pool.ts           bounded concurrency
      verify.ts         HMAC-signed cross-region confirmation
    checks/             http · keyword · tcp · dns · ssl · icmp
    monitors/
      stateMachine.ts   pure up/down decision
      recordResult.ts   buffering, incidents, outbox
      validate.ts       plan limits + SSRF guard, one place
      series.ts         chart data — picks hour buckets or day rollups
    alerts/
      channels.ts       email · slack · discord · telegram · webhook
      drainer.ts        outbox → network, with backoff
    sync/
      configListener.ts Firebase → worker
      mirror.ts         worker → Firebase, aggregated
    lib/
      targetGuard.ts    SSRF defence — read this before touching a probe
      ranges.ts         the four chart windows, and which table serves each
      plans.ts          plan limits
      readiness.ts      flags missing critical config at boot and on /healthz
    api/                Fastify routes, incl. the public status feed
    worker.ts           probe process entrypoint
    api.ts              HTTP process entrypoint
server/test/            emulator-backed integration tests
deploy/                 provision.sh, deploy.sh, Caddyfile, systemd units
web/                    Next.js dashboard + public status page (static export)
firestore.rules         tenancy; monitors are backend-only
scripts/rules.test.mjs  16 emulator tests for the above
functions/              LEGACY — the Firebase-only build, kept for reference
```

## The parts that are easy to get wrong

**`better-sqlite3` is synchronous.** Every query blocks the event loop. Check
results are therefore buffered and flushed in one transaction every 5s — a
thousand rows costs about a millisecond. Writing per-check would hand the loop
a syscall per probe, in the middle of every concurrent socket in the pool.

**Advance the grid, never reset it.** `dueAt += interval`, not
`dueAt = now + interval`. The latter lets slow probes drift until a 5-minute
monitor quietly runs every 6. See `nextDueAt` and its tests.

**Keep-alive is off on purpose.** A reused socket skips DNS, TCP and TLS, so
response times read artificially fast and an expiring certificate stays
invisible. We measure what a first-time visitor experiences.

**No per-check rows.** One row per monitor per hour, counters plus a JSON
sample array. At 5,000 monitors that is 120k inserts a day instead of 1.44M.

**A chart range picks its own table.** 24h and 7d read `hour_buckets`, which
hold the individual samples but are pruned at 35 days; 30d and 90d read
`day_rollups`. Serving a long range from buckets returns a third of the window
it claims. `lib/ranges.ts` is the one place that decides, and both the
dashboard and the status page go through `monitors/series.ts` so they cannot
drift apart.

**The SSRF guard is not optional.** AWS's metadata service answers on the same
`169.254.169.254` as Google's. `targetGuard.ts` blocks it, IMDSv2 is the second
lock, and both are load-bearing.

## Running it

```bash
# Tests — no emulator, no network needed
npm test                          # 165 server + 33 monitoring + 23 feature
npm --prefix server test          # 165 server tests alone

# Security rules, against the Firestore emulator
npx firebase-tools@14 emulators:start --only firestore --project demo-uptimemonk
npm run test:rules                # 16 tests

# Status page, end to end — starts its own emulator
npm run test:status               # 6 tests

# Locally
cp deploy/uptimemonk.env.example server/.env   # then fill it in
npm --prefix server run build
node --env-file=server/.env server/dist/worker.js
node --env-file=server/.env server/dist/api.js
```

Note: `firebase-tools@15` requires Java 21; pin `@14` if you are on Java 17.

## The fleet

| Worker | Host | Region | Shard | Plan |
|---|---|---|---|---|
| `sg-1` | `uptimemonk-worker-1` (47.129.253.94) | ap-southeast-1a | 0/1 | $5 · 2 vCPU · 414 MB |

**Live and serving traffic.** Both units active, Firestore listener syncing,
10 monitors scheduled, queue depth 0, scheduler lag 0 ms. Memory in use: worker
49 MB against a 220 MB cap, API 40 MB against 110 MB. Deployed as plain Node
under systemd — see Deploying below.

`/healthz` also reports readiness. It currently answers `ok: false` with two
**critical** issues — `RESEND_API_KEY` and `UPTIMEMONK_HEARTBEAT_URL` are both
unset — which is accurate and deliberate: checks run and incidents are
recorded, but nobody is told about them. See Known gaps.

Note the RAM: the $5 plan is 414 MB, not the 1 GB the defaults assume, so
`PROBE_CONCURRENCY=50` and the systemd `MemoryMax` values are tuned down, and
provisioning adds a 1 GB swap file. Moving to the $7 plan means raising both.

### Public endpoints

Both are live and verified:

| | |
|---|---|
| https://uptimemonke.com | dashboard (Firebase Hosting) |
| https://api.uptimemonke.com | worker API, Let's Encrypt cert valid to 2026-12-15 |

`/healthz` returns `200` with `lagMs` near 0; unauthenticated `/v1/monitors`
correctly returns `401`.

Port 443 had to be opened in the **Lightsail console firewall** — it is outside
the OS, so `ufw` allowing 443 is not sufficient. Port 80 being open is the only
reason the certificate could be issued at all while 443 was closed
(`tls-alpn-01` timed out, HTTP-01 succeeded). If TLS ever breaks after an
instance rebuild, check that firewall first:

```bash
aws lightsail open-instance-public-ports --region ap-southeast-1 \
  --instance-name uptimemonk-worker-1 \
  --port-info fromPort=443,toPort=443,protocol=TCP
```

## Deploying

### 1. Firebase (Firestore rules & indexes)

```bash
# Deploy Firestore security rules and indexes
bash deploy/deploy-firebase.sh

# Or via npm
npm run deploy:firebase
```

### 2. AWS Lightsail (Worker Fleet & API)

```bash
# Once per worker, on a fresh Ubuntu 24.04 Lightsail instance
scp -r deploy/ ubuntu@<ip>:/tmp/
ssh ubuntu@<ip> 'sudo bash /tmp/deploy/provision.sh'

# Then, from your workstation — enforce IMDSv2
aws lightsail update-instance-metadata-options \
  --instance-name uptimemonk-sg --http-tokens required

# Every deploy after that — an ssh alias works as well as ubuntu@<ip>
bash deploy/deploy-lightsail.sh uptimemonk-worker-1
# Or via npm / deploy.sh
npm run deploy:lightsail uptimemonk-worker-1
```

### 3. Deploy Everything

```bash
# Deploys Firebase resources followed by the Lightsail worker(s)
bash deploy/deploy-all.sh ubuntu@<ip>
# Or via npm
npm run deploy -- ubuntu@<ip>
```

`deploy-lightsail.sh` builds locally, runs the tests, rsyncs the output, runs
`npm ci --omit=dev` on the target, and restarts both services.

`provision.sh` sets `net.ipv4.ping_group_range` so `ping` works from an
unprivileged datagram socket. That is why the systemd unit grants **no**
capabilities and keeps `NoNewPrivileges=true` — better than the
`AmbientCapabilities=CAP_NET_RAW` you will see suggested elsewhere.

Secrets are yours to place:

```bash
sudo install -m 600 -o root -g root env /etc/uptimemonk/env
sudo install -m 440 -o root -g uptimemonk key.json /etc/uptimemonk/sa.json
```

The key is **440 root:uptimemonk**. systemd's `LoadCredential` reads it as
root and hands the path to the process, which runs as the `uptimemonk` user.
The service account needs `roles/datastore.user` and nothing else.

## Free-tier budget

Firestore gives 20,000 writes/day. The mirror spends 288 per organisation per
day, so the ceiling is roughly **50 orgs / 5,000 monitors** — and monitor count
does not affect it, because Firestore bills per document, not per field.

Outgrowing that means switching to Blaze, not rewriting: the free quotas are
identical, so the same design just starts costing cents.

## Known gaps

- **A worker is a single point of failure for the orgs it owns.** Set
  `UPTIMEMONK_HEARTBEAT_URL` on every worker, pointing at an external dead-man's
  switch on a *different* provider. Not optional.
- **Rebalancing does not transfer state.** Orgs moving between workers restart
  at `pending`, and incidents open on the old owner are orphaned. The fix is to
  read last-known status from the `orgStatus` mirror when adopting an org.
- Telegram has no bot token, so Telegram contacts cannot deliver. Email
  (Mailgun), Slack, Discord and webhook all work. The UI marks a contact on an
  unconfigured channel *undeliverable* rather than letting it fail quietly.
- **No dead-man's switch** (`UPTIMEMONK_HEARTBEAT_URL` empty). With one worker,
  nothing notices if this box dies.
- Litestream backups are not yet wired into `provision.sh`.
- Stripe billing routes have not been ported from `functions/`.
- **Public status pages have no server-rendered content** and are `noindex` as
  a result. Static export on Spark has no Node runtime. Moving to App Hosting
  (Blaze) restores SSR without changing anything else about the page.
- **Status pages cannot be titled or given a custom slug from the UI.** The
  worker resolves a `statusPages` document if one exists and otherwise treats
  the slug as an org id, so `/status/<orgId>` works with no setup — but the
  heading stays "Service status" until that document is written by hand. The
  fallback deliberately does not borrow the org's name: bootstrap derives it
  from the local-part of the owner's email address, and that is not ours to
  publish.
