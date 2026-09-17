# Scaling

Measured on the live worker on 2026-09-17, at version 0.5.0. Every number
below came from the running system; the method is recorded so it can be
re-derived rather than trusted.

## The headline

**The current system maxes out at about 64 users, and at that point the $5
worker is 9% used.**

The limit is not the hardware. It is Firestore's free-tier write quota. The
architecture was built to make the box cheap and succeeded so thoroughly that
the box is now roughly 11x over-provisioned for what Firestore permits.

## What actually binds

| Constraint | Ceiling | Binding? |
|---|---|---|
| CPU | 11.9M checks/day | No |
| Disk | 4.0M checks/day | Binds the box |
| **Firestore writes** | **~64 orgs** | **Binds everything** |

### CPU — 14.5 ms per check

Sampled over a 120-second window on the live box, reading the worker's
`utime + stime` from `/proc` against the change in `sum(up + down)` across
`hour_buckets`:

```bash
ssh uptimemonk-worker-1 'cd /opt/uptimemonk/server
read_state() {
  CPU=$(cat /proc/$(systemctl show uptimemonk-worker -p MainPID --value)/stat | awk "{print \$14+\$15}")
  CHECKS=$(sudo -u uptimemonk node -e "const d=require(\"better-sqlite3\")(\"/var/lib/uptimemonk/uptimemonk.db\",{readonly:true});console.log(d.prepare(\"select coalesce(sum(up+down),0) n from hour_buckets\").get().n)")
  echo "$CPU $CHECKS"
}
A=$(read_state); sleep 120; B=$(read_state); echo "$A $B"'
```

14.5 ms covers the whole path: scheduler, DNS, TCP, TLS, the HTTP request and
the SQLite buffering behind it. Two vCPU is 172.8M ms/day, so the CPU ceiling
is ~11.9M checks/day. The sample is small — eleven checks — so treat it as an
order of magnitude, not a precise figure. It does not need to be precise,
because CPU is nowhere near binding.

### Disk — ~42 bytes per check

```sql
SELECT sum(up+down) checks, sum(length(samples)) bytes FROM hour_buckets;
```

Sampled twice a few hours apart: 41.5 and 42.5 bytes. With SQLite row and
index overhead call it ~70 bytes on disk. At
`RETENTION_DAYS = 35` and a 10 GB database budget (of 15 GB free), that is
~4.0M checks/day sustained. Half of it, 2M/day, is the safe committed figure
used for pricing in `lib/credits.ts`.

### Firestore — 308 writes per org per day

This is the one that matters. `sync/mirror.ts` writes one `orgStatus`
document per org per `MIRROR_FLUSH_MS` (5 minutes, so 288/day), plus state
changes and incidents — call it ~20/day at ten monitors. Spark allows 20,000
writes/day:

    20,000 / 308 = 64 orgs

Writes are billed per *document*, so monitor count does not affect this at
all. An org with 200 monitors costs exactly what an org with one costs. That
is the whole point of the per-org mirror, and it is why the ceiling is on
users rather than on monitors.

### Users a worker could hold, if Firestore allowed it

At the safe 2M checks/day:

| Profile | Per day | Box holds |
|---|---|---|
| Free (10 monitors @ 5 min) | 2,880 | 703 |
| Light donor (20 @ 1 min) | 28,800 | 70 |
| Heavy donor (200 @ 1 min) | 288,000 | 7 |

## Stage 1 — remove the Firestore ceiling

64 → ~700 users on the hardware already paid for. Three options, and they are
not equally good.

**Widen the flush interval.** `MIRROR_FLUSH_MS` from 5 to 15 minutes cuts
288 writes/org/day to 96, tripling the ceiling to ~190 orgs. One environment
variable, no code. It costs dashboard freshness, and it raises the limit
rather than removing it.

**Serve status from the worker API instead of mirroring it.** *This is the
real answer.* The mirror exists for exactly one reason: so the dashboard can
use a realtime Firestore listener. Every other read the dashboard makes —
history, incidents, contacts, billing — already goes to the worker API.
Replacing the listener with polling or SSE against the worker drops Firestore
writes to near zero and leaves it as what it should be: auth and monitor
configuration. The ceiling does not move, it disappears.

The work: a `GET /v1/status` endpoint returning what `orgStatus` holds today,
a polling hook in the dashboard replacing `onSnapshot`, and deleting
`sync/mirror.ts` along with the `orgStatus` collection and its rules. The
public status page already works this way, so the pattern exists.

**Upgrade to Blaze.** Cents a day at this volume. But it converts a hard
limit into a bill, which is a worse failure mode for a donation-funded
product: running out of quota stops writes, running out of budget stops
everything.

## Stage 2 — box capacity

~700 → several thousand. Disk binds, and it is dominated by 35 days of
per-check sample JSON. The 90-day status bars read `day_rollups`, not
samples; samples exist for the response-time chart, which only ever shows
24h and 7d. Cutting `RETENTION_DAYS` to 7 gives 5x headroom and loses
nothing any UI currently reads.

Watch `day_rollups` while doing this — it is never pruned (see Known gaps in
AGENTS.md) and will eventually want its own retention.

## Stage 3 — horizontal, and a flaw to fix first

Ownership is `hash(orgId) % WORKER_COUNT == WORKER_INDEX`. Modulo sharding
means **adding a worker remaps most orgs**, and rebalancing currently loses
local state: monitors restart at `pending` and open incidents are orphaned.
Raising `WORKER_COUNT` is also not a rolling operation — while workers
disagree about the count, some orgs are probed twice and others by nobody.

Two changes make adding a worker routine:

- **Consistent or rendezvous hashing**, so adding the Nth worker moves ~1/N
  of orgs instead of most of them. This is the standard fix and is what
  cluster time-series systems use to place series across storage nodes.
- **Seed state on adoption**, reading last-known status from the `orgStatus`
  mirror when a worker inherits an org — already listed as a known gap. Note
  the interaction: Stage 1 removes that mirror, so the seed source becomes
  the previous owner's API or a small shared snapshot instead.

## Recommendation

Do Stage 1's second option and stop.

It costs nothing, removes the only limit that currently matters, and takes
the system from 64 to roughly 700 users on hardware already paid for. Stage 2
is a one-line change when disk starts to matter. Stage 3 is real work that
buys nothing until there is more than one box, and on these numbers that is
a long way off.

The thing to watch is not user count but **checks per day**, which is already
tracked per org for billing. When it approaches 2M, Stage 2. When Stage 2 is
exhausted, Stage 3.
