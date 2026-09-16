# UptimeMonke — agent context

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
| Naming | The product is **UptimeMonke**; the GCP project, systemd units, `UPTIMEMONK_*` env vars and the git repo stay `uptimemonk`. Renaming those buys nothing and breaks deploys. |
| Firebase plan | **Spark (free)**. No Cloud Functions exist or can be deployed. |
| Version | `curl https://api.uptimemonke.com/version` — compare against `package.json` to see whether the box is behind |
| Email | Mailgun, sending as `alerts@mg.uptimemonke.com`. Working. |
| Donations | Stripe Payment Link, **one-off $2.99**. Webhook secret is set; there is deliberately no `STRIPE_SECRET_KEY` — a link needs none. |

Live checks are running. `curl https://api.uptimemonke.com/healthz` should
return `"status":"ok"` with `lagMs` near 0. If `lagMs` climbs, the scheduler is
wedged — that is the failure mode that matters, not process liveness.

## Commands

```bash
npm test                     # everything that needs no emulator: 262 server
                             # + 33 monitoring + 23 feature tests
npm --prefix server test     # 262 server tests alone, no network or emulator
npm run test:rules           # 18 rules tests; needs the Firestore emulator running
npm run test:status          # 6 status-page integration tests; starts the emulator itself
npm run emulators            # firebase-tools@14 — v15 requires Java 21, host has 17
npm run deploy               # deploy/deploy-all.sh (Firebase + Lightsail)
npm run deploy:lightsail uptimemonk-worker-1     # worker only
```

Deploys run the test suite first and will refuse to ship a failing tree.

`npm test` also runs `scripts/test-all-features.mjs`, which the server-only
suite does not. A stale assertion has hidden there before — run the root
`npm test` before declaring a change green.

## Where things stand

Alerts, status pages and donations all work end to end. What is left is in
Known gaps below, and only one is critical: **no dead-man's switch**, so if
this box dies nothing external notices.

Do not take a passing test suite as proof a money or alert path works. Both
have failed in ways tests did not catch, because the tests asserted the
design rather than the deployment:

- Alerts had a complete outbox, drainer and five channels, and had **never
  delivered anything** — every monitor was created with an empty contact list
  and `queueAlerts` iterated it. Two real incidents passed in silence.
- The donation webhook returned 503 while correctly configured, because it
  demanded an API key that a Payment Link never needs.
- A $2.99 donation funded fourteen years of service for a light workload.

Each was found by checking production state or by driving a real request —
not by reading code. Do the same.

## The two rules everything else follows from

**1. One writer per field.** Hybrid systems rot when two runtimes write the
same document. The worker fleet owns every piece of monitor *state*; the
dashboard writes monitor *configuration* only, and only by calling the worker
API — `firestore.rules` denies client writes to `monitors` outright
(`allow create, update, delete: if false`), and `scripts/rules.test.mjs`
asserts it.

This has been broken once. The rules were loosened to `if inOrg(...)` and the
client grew direct-Firestore fallbacks, which reopened the SSRF hole: `target`
becomes an outbound request from inside our network, so it *must* pass
`targetGuard`, and a rule cannot resolve a hostname or count monitors against a
plan. If you find yourself adding a fallback because an API call failed, fix
the API call.

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

**Capacity is priced per check, not per monitor** (`lib/credits.ts`). This
replaced the plan paywall. A 5-second monitor is 12x the load of a 1-minute
one and the old per-monitor cap charged the same for both, which also made a
free workspace unable to run one fast monitor at any price despite it costing
the same as ten slow ones. Free is 14,400 checks/day forever; a donation adds
10,000/day per $1. That rate is set by **depletion**, not by capacity — a grant
must run out inside a month for a real workload, or one $2.99 funds years. And
credit pays for *every* check a donor runs, not only those above the free
allowance: discounting it made eleven monitors at 59s last fourteen years. **Grants are in cents** — `Math.round(usd)` granted
nothing for $0.49 and over-granted $1.50 by a third. There is no per-plan interval floor any more — the
only floor left is the scheduler's own, and `assertFitsBudget` is what refuses,
with a number rather than a tier name.

**Monitor count and check budget are separate caps** (`maxMonitorsFor`,
`fitsBudget`). Load falls with interval, so budget alone would let a free
workspace hold 600 hourly monitors — three times a donor's 200. The cap is 50
free / 200 donor, tiered precisely so free cannot out-reach paying at slow
intervals. It refuses with 402, not 403: donating lifts it.

**Running out of credit never stops monitoring.** Zero opens a 7-day grace
window at full service, then the workspace falls back to the *free* allowance —
not to nothing. Existing monitors keep checking; only adding and speeding up
are blocked. Silently stopping someone's monitoring because a card expired
would be the worst version of the failure this product exists to prevent.

**The nightly burn is idempotent via `credits_burned_day`.** A restart between
the rollup and the burn would otherwise charge a day twice, and a donor would
lose credit to an operational accident. It charges from `day_rollups`, so what
is billed is what was actually probed.

**The Stripe webhook verifies against the raw body.** It lives in its own
Fastify plugin scope with a buffer content-type parser, because re-serialising
parsed JSON changes the bytes and the signature stops matching — which is how
this endpoint ends up either permanently broken or quietly waved through.
Applied event ids are recorded in Firestore, not SQLite: the API process
serving the webhook may not be the worker that owns the org, and a grant must
land once across the fleet. See `api/billing.test.ts`.

**The test-notification button uses `deliver()`, not a shortcut.** It is the
same function the drainer calls, with the same secrets and per-channel
formatting, because a test that took its own path could pass while real alerts
fail — worse than having no test. Delivery is awaited rather than queued so the
response carries the provider's actual error; "sent" followed by silence is the
failure the button exists to rule out. Verified contacts only: an unverified one
already has the confirmation flow, and arbitrary test sends to unconfirmed
addresses would make this an open relay with extra steps.

**Email has two providers and picks at runtime.** `sendEmail` uses Mailgun
when `MAILGUN_API_KEY` is set and falls back to Resend, so changing provider is
an env edit and a restart rather than a deploy. Mailgun's v3 messages API is
**form-encoded** — posting JSON returns a 400 that reads like an auth failure —
and authenticates as HTTP Basic with the literal username `api`. `ALERT_FROM_EMAIL`
must sit on `MAILGUN_DOMAIN`; readiness warns when it does not, because a From
off the sending domain fails DMARC and lands in spam, which is the same failure
as not sending but harder to notice. See `alerts/email.test.ts`.

**An empty `alertContactIds` means *everyone verified in the org*, not
nobody.** This was a real, silent outage of the alerting system: every monitor
is created with an empty list, the old `queueAlerts` iterated that list, and so
two genuine incidents passed with zero rows written to the outbox while a
verified contact sat unused. Silence is the one failure a monitoring product
cannot have, so it is not the default. Deliberate silence is `muteAlerts`,
which is explicit and badged in the UI. Deleting a contact detaches it from
every monitor that named it — leaving the id behind would make the list
non-empty and pointing at nothing, which reads as "explicitly chosen" and
silences the monitor again. See `alerts/fanout.test.ts`.

**Alert contacts are backend-only in `firestore.rules`, like monitors.** A
Slack, Discord or webhook destination is a URL this server POSTs to from inside
our network, so it has to clear `targetGuard` — and a security rule cannot
resolve a hostname. The verification fields were already backend-only: a client
that could write the token hash could confirm a contact it does not own and
page a stranger.

**A chart range decides which table answers it** (`lib/ranges.ts`,
`monitors/series.ts`). 24h and 7d read `hour_buckets`, which carry the
individual samples but are pruned at `RETENTION_DAYS` (35). 30d and 90d read
`day_rollups`. Pointing a long range at buckets returns a third of the window
it claims and parses ~2,000 JSON blobs to do it. Both the dashboard and the
public status page go through `seriesFor()` so they cannot disagree about what
"last 7 days" means — they did diverge once, when the status page was reading a
Firestore subcollection the dashboard had stopped writing.

**Bucket timestamps are epoch ms, never formatted strings.** The keys in SQLite
are UTC; a pre-formatted label would show the wrong hour to most of the world.
The client formats in the viewer's own timezone.

**`publicOnStatusPage` is opt-in and absence means private.** `toMonitor` maps
it as `d.publicOnStatusPage === true` on purpose: a monitor written before the
field existed must not become public because the value is missing.

**`GET /v1/status/:slug` is unauthenticated, so its response shape is a
security decision.** Only opted-in monitors appear; the probe target, keyword,
alert contacts and last error are all withheld; a paused monitor reads as
`paused`; and an unknown slug and a published-but-empty page return the *same*
404 so orgs cannot be enumerated. `api/status.test.ts` pins each of these.

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
    series.ts           chart data; picks buckets or rollups per range
  alerts/
    channels.ts         email · slack · discord · telegram · webhook
    drainer.ts          transactional outbox → network, with backoff
  sync/
    configListener.ts   Firebase → worker (listener + periodic reconcile)
    mirror.ts           worker → Firebase, aggregated per org
  api/
    monitors.ts         CRUD + /v1/monitors/:id/history (ranged)
    contacts.ts         alert-contact verification (send + confirm)
    status.ts           public status page feed — unauthenticated, see above
    misc.ts             healthz, version, heartbeat, bootstrap
  lib/
    targetGuard.ts      SSRF defence — read before touching a probe
    ranges.ts           the four chart windows and which table serves each
    readiness.ts        reports missing critical config at boot and on /healthz
    plans.ts            plan limits — free is 10 monitors at 60s, paid 5s
  db/                   connection, pragmas, repo, numbered SQL migrations
server/test/            emulator-backed integration tests (Firestore needed)

deploy/                 systemd units, Caddyfile, provision.sh, deploy scripts
web/                    Next.js dashboard (static export on Spark)
  src/app/dashboard/    monitor list, create/edit form, history detail panel
  src/app/status/       public status page — client-rendered, see below
  src/components/       RangeTabs (shared by both charts), Landing, logo
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

- Telegram has no bot token, so Telegram contacts cannot deliver. Email
  (Mailgun), Slack, Discord and webhook all work.
- **No dead-man's switch** (`UPTIMEMONK_HEARTBEAT_URL` empty). One worker means
  nothing notices if the box dies — and it dies silently. Use a *different*
  provider; a monitor that monitors itself proves nothing.
- **Rebalancing does not transfer state.** A worker inheriting an org has no
  SQLite history, so its monitors restart at `pending` and incidents open on the
  previous owner are orphaned. Fix is to seed from the `orgStatus` mirror on
  adoption. Not built.
- **Cross-region confirmation is inactive.** `verifyWithPeer` needs
  `VERIFY_PEER_URL` and `VERIFY_SECRET`; with one worker there is no peer, so
  it returns `unavailable` and only `confirmationThreshold` guards against
  false alarms. It begins working when a second worker is provisioned.
- **`day_rollups` is never pruned.** `RETENTION_DAYS` prunes `hour_buckets`
  and `INCIDENT_RETENTION_DAYS` prunes incidents, but daily rollups are only
  deleted with their monitor. Small — one row per monitor per day — but it
  grows without bound.
- **Credit can be oversold within a day.** The burn is nightly and coarse, so
  a workspace can spend past its balance between rollups. Worst case is a few
  hours of unpaid capacity, which is fine at this scale; the established fix
  is a reserve-then-settle split, and that is what to build if donations grow.
- Litestream off-box backup not wired into provisioning.
- **The public status page has no server-rendered content.** Static export on
  Spark has no Node runtime, so one shell is prerendered and a hosting rewrite
  points `/status/**` at it; the slug is read from the URL at runtime. The page
  is marked `noindex` to match. Moving to App Hosting (Blaze) would restore
  SSR; nothing else about the page would change.
- **A status page cannot be titled or given a custom slug from the UI.** The
  worker resolves a `statusPages` document if one exists and otherwise falls
  back to the org id, so `/status/<orgId>` works with no setup — but the title
  stays "Service status" until someone writes that document by hand. The
  fallback deliberately does *not* borrow the org's name: bootstrap derives it
  from the local-part of the owner's email address.

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
