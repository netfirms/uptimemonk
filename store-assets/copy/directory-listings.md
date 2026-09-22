# Directory & launch listings — UptimeMonke

Paste-ready copy for AlternativeTo, GetApp, Stacklist and Product Hunt.

Everything here is checked against the product as it actually ships. Where a
claim would be flattering but untrue it is left out, and the reason is noted —
directories are read by people evaluating tools against a shortlist, and a
single overstatement that surfaces in a trial costs more than the listing wins.

---

## ⚠️ Read before submitting anywhere

**1. There is still no privacy policy page.** `/privacy` returns 404 on the
Firebase domain and no route exists in `web/src`. GetApp requires one to verify
a vendor profile; Product Hunt does not require it but commenters ask, and an
app that handles email addresses and device tokens without one reads badly.
This blocks GetApp outright and weakens the rest. Same blocker already recorded
in `store-assets/README.md` for the app stores.

**2. iOS is TestFlight only.** There is no public App Store listing. Every
platform field below says "Web, Android, iOS (TestFlight)" — do not tick a
plain "iOS" box, because a reviewer who taps through and finds nothing will
mark the listing inaccurate, and on AlternativeTo that is a community edit
anyone can make.

**3. Telegram is listed as a channel in the product but cannot deliver** — no
bot token is configured. It is omitted from every channel list below. If you
configure one before launching, add it back in all four places.

**4. Decide the launch order.** Product Hunt is a one-shot event: you get one
launch per product and the first six hours decide it. AlternativeTo and
Stacklist are evergreen and can go up today. The sensible order is
AlternativeTo + Stacklist now, GetApp once a privacy policy exists, Product
Hunt last and deliberately.

---

## Facts every listing draws from

Keep this block accurate; the copy below is derived from it.

| | |
|---|---|
| Name | UptimeMonke |
| Site | https://uptimemonke.com |
| Tagline | Uptime monitoring that stays free |
| Free tier | 14,400 checks/day, forever. No credit card, no trial. |
| What that buys | Ten monitors at 1 minute, or fifty at 5 minutes — spend it as you like |
| Intervals | 60s on free, down to 5s for supporters |
| Monitors | 50 free, 200 for supporters |
| Check types | HTTP(S), keyword, SSL expiry, TCP port, DNS record, ICMP ping, cron heartbeat |
| Alerts | Email, Slack, Discord, webhook, mobile push |
| Status pages | Public, per-workspace, with incident feed |
| Platforms | Web, Android (Google Play), iOS (TestFlight) |
| Pricing model | Free. Optional one-off donation buys capacity. No subscription. |
| Play listing | https://play.google.com/store/apps/details?id=com.mfx.uptimemonke |

**The positioning, in one sentence:** the free tier is the product, not a trial
of it — and capacity is measured in checks rather than monitors, because a
5-second check is twelve times the work of a 1-minute one and pricing them the
same is how everyone else ends up rationing intervals.

---

# 1. AlternativeTo

Community-edited, so accuracy matters more than polish — anything overstated
gets corrected by someone else, publicly. The audience arrives having already
decided to leave a competitor.

### Name
```
UptimeMonke
```

### Tagline (short, shown under the name)
```
Uptime and SSL monitoring with a free tier that is the product, not a trial.
```

### Description
```
UptimeMonke watches websites, APIs, certificates and cron jobs, and tells you
the moment one stops answering.

Every account gets 14,400 checks a day, forever — no credit card, no trial
countdown, no feature held back for a paid tier. That is ten monitors at
one-minute intervals, or fifty at five minutes; you decide how to spend it.

Capacity is counted in checks rather than monitors on purpose. A five-second
check is twelve times the work of a one-minute one, and platforms that price
them identically end up rationing intervals instead. Counting checks is what
lets sub-minute monitoring exist on a free account at all.

Check types: HTTP(S) with status-code and keyword assertions, SSL certificate
expiry, TCP port, DNS record, ICMP ping, and cron heartbeats for scheduled jobs
that should have called home.

Alerts go to email, Slack, Discord, custom webhooks, and push notifications on
the mobile app. Alert contacts are verified before they can receive anything,
so a channel cannot be pointed at someone who never agreed to be paged.

Public status pages are included. They open on the last 24 hours, because a
status page answers "is it working right now" — over a ninety-day window an
active outage averages down to a rounding error and the page reads green while
the service is down. Longer windows are one tap away.

There is no paid plan. An optional one-off donation raises your check ceiling
and unlocks five-second intervals. Running out of capacity never stops your
monitoring — it falls back to the free allowance.
```

### Listed as an alternative to
```
UptimeRobot, Pingdom, StatusCake, Better Stack (Better Uptime), Uptime Kuma,
Healthchecks.io, Freshping, HetrixTools
```
*Uptime Kuma and Healthchecks.io are self-hosted — list them, because people
searching for those want the "no server to run" option.*

### Categories / tags
```
Network & Admin, Monitoring, Developer Tools, Website Monitoring,
SSL Monitoring, Status Page, Cron Monitoring
```

### Platforms
```
Web, Android, iOS (TestFlight), Self-Hosted: No
```

### Licence / pricing
```
Free • Optional one-off donation (no subscription)
```

### Links
```
Website:     https://uptimemonke.com
Android:     https://play.google.com/store/apps/details?id=com.mfx.uptimemonke
```

---

# 2. GetApp

**Blocked until a privacy policy exists.** GetApp (Gartner Digital Markets)
verifies vendors and syndicates to Capterra and Software Advice, so the profile
is B2B-formal and reviewed by a human. Write for a buyer comparing three tools
in a spreadsheet, not a developer browsing.

### Product name
```
UptimeMonke
```

### Tagline (limit ~80)
```
Uptime, SSL and cron monitoring with a permanently free tier
```
60 characters.

### Product description (long)
```
UptimeMonke is website, API and infrastructure monitoring for teams that need
to know about an outage before their customers report it.

It runs continuous checks against HTTP and HTTPS endpoints, SSL certificates,
TCP ports, DNS records, ICMP targets and scheduled jobs. When a check fails,
alerts reach the team immediately through email, Slack, Discord, custom
webhooks or mobile push notifications.

KEY CAPABILITIES

• Seven monitor types covering web, API, network and scheduled-job monitoring
• Sub-minute check intervals, down to five seconds
• SSL certificate expiry warnings at 30, 14, 7 and 1 day
• Cron heartbeat monitoring — alerts when a scheduled job stops reporting
• Keyword and status-code assertions for endpoints that return 200 while broken
• Public status pages with a live incident feed and uptime history
• Response-time and uptime charts across 24-hour, 7-day, 30-day and 90-day
  windows
• Full incident log with causes and resolution times
• Cross-region confirmation before an alert fires, which suppresses false
  alarms caused by a single probe's network path
• Verified alert contacts, so a channel cannot be pointed at an unwilling
  recipient
• Mobile apps for Android and iOS

PRICING

There is no paid plan and no trial. Every account receives 14,400 checks per
day permanently, with access to every feature — all monitor types, public
status pages and every alert channel. An optional one-off donation raises the
daily check ceiling and enables five-second intervals. If that capacity is
exhausted, monitoring continues on the free allowance rather than stopping.

SECURITY

Probes are hardened against server-side request forgery: RFC1918 link-local
defence, AWS IMDSv2 protection and DNS rebinding guards, so internal targets
can be monitored without turning the prober into an attack surface. Public
status pages expose names and health only — never the probe target, assertion
keyword, alert contacts or error text.
```

### Pricing fields
```
Starting price:      Free
Free trial:          No — there is no paid tier to trial
Free version:        Yes
Pricing model:       Free, with optional one-off donation
```
*Answer "Free trial: No" deliberately. A trial implies an ending, and the free
tier does not end — saying "yes" invites a buyer to ask when it expires.*

### Typical customers
```
Freelancers, Small businesses, Mid-size businesses, Startups,
Individual developers and SRE/DevOps teams
```

### Deployment / support
```
Deployment:  Cloud, SaaS, Web-based; Android (native); iPhone/iPad (TestFlight)
Support:     Email/Help Desk
Training:    Documentation
```

### Categories
```
Website Monitoring, Network Monitoring, IT Management, Server Monitoring,
Application Performance Management (APM)
```

---

# 3. Stacklist

Short and personal. This is "what we use and why", not a product page — a
paragraph of honest reasoning outperforms a feature list here.

### Tool name
```
UptimeMonke
```

### One-liner
```
Uptime, SSL and cron monitoring — free tier that does not expire.
```

### Category
```
Monitoring / Observability
```

### Why it's in the stack
```
We wanted uptime monitoring that would not quietly become a bill, and that we
would not have to run ourselves.

UptimeMonke gives every account 14,400 checks a day permanently — ten monitors
at one minute, or fifty at five. Capacity is counted in checks rather than
monitors, which is the part that actually matters: a five-second check is
twelve times the work of a one-minute one, so anything that prices them the
same has to ration intervals. Counting checks is why sub-minute monitoring is
available without paying.

It covers the things that break without returning a 500 — certificate expiry,
DNS records, a cron job that stopped running, an endpoint that returns 200 with
an error page. Alerts reach Slack, Discord, webhooks, email and mobile push.

Status pages are included and open on the last 24 hours rather than a
ninety-day average, which is the difference between a page that shows an
outage and one that shows a rounding error.
```

### Link
```
https://uptimemonke.com
```

---

# 4. Product Hunt

One shot. Do not launch until the privacy policy exists, the gallery is ready
and you can be present in the comments for the first six hours.

### Name
```
UptimeMonke
```

### Tagline (limit 60)
```
Uptime monitoring with a free tier that isn't a trial
```
53 characters.

### Description (limit 260)
```
Monitor websites, APIs, SSL certificates, DNS and cron jobs. 14,400 checks a
day free, forever — no card, no trial. Alerts to Slack, Discord, webhooks and
mobile push. Public status pages included. One-off donation for 5-second
checks, never a subscription.
```
257 characters.

### Topics
```
Developer Tools, SaaS, Monitoring, Web App, Open Source Alternatives,
Productivity, Tech
```

### First comment (from the maker)

*This is the post that actually converts. Lead with the decision, not the
feature list — PH readers have seen a hundred monitoring tools.*

```
Hi Product Hunt 👋

I built UptimeMonke because every monitoring free tier I tried was a trial
wearing a different hat — five monitors, five-minute intervals, and the
interesting features behind a plan.

The thing I kept running into is that these products count monitors. That
sounds fair until you notice a 5-second check is twelve times the work of a
1-minute one, and charging the same for both means the only way to stay
solvent is to ration intervals. So UptimeMonke counts checks instead: every
account gets 14,400 a day, forever, and you spend them however you like — ten
monitors at one minute, fifty at five, or one critical endpoint hammered every
five seconds.

Every feature is on the free tier. All seven monitor types (HTTP, keyword,
SSL, TCP, DNS, ping, cron heartbeat), public status pages, every alert
channel. There is no paid plan at all — an optional one-off donation raises
your ceiling, and if you run out you fall back to the free allowance rather
than going dark.

A couple of decisions I'd genuinely like feedback on:

• Status pages open on the last 24 hours, not 90 days. A status page answers
  "is it working right now", and over 90 days an active outage averages down
  to a rounding error — the page reads green while the service is down. Some
  people will find that surprising.

• Keep-alive is deliberately off on probes. A reused socket skips DNS, TCP and
  TLS, so response times read artificially fast and an expiring certificate
  stays invisible. It costs us on the benchmarks and I think it's the right
  call.

Web app plus an Android app; iOS is in TestFlight while the App Store review
gets sorted.

Happy to answer anything — especially if you've been burned by a monitoring
bill.
```

### Gallery
Reuse `store-assets/` screenshots. Order them:
1. Dashboard with monitors up — the product working
2. A public status page — the thing others will see
3. Alert arriving on mobile — the moment of value
4. Monitor detail with latency chart — depth for technical readers
5. Monitor types — breadth

### Launch-day checklist
- [ ] Privacy policy page live at `https://uptimemonke.com/privacy`
- [ ] Play listing link works from a logged-out browser
- [ ] Free signup works end to end from a clean browser session
- [ ] Status page demo URL ready to paste into comments
- [ ] Someone watching alerts — a launch is a traffic spike against your own
      signup path

---

## Claims deliberately not made

Kept here so nobody "improves" the copy by adding them back:

- **No App Store link or plain "iOS" platform tick.** TestFlight only.
- **No Telegram in any channel list.** No bot token; contacts on it cannot
  deliver, and the UI marks them undeliverable.
- **No uptime SLA and no "99.9%" figure.** Single worker, no dead-man's switch
  configured yet — see Known gaps in the README. Claiming availability we do
  not measure is the one mistake a monitoring product cannot survive.
- **No "trusted by N teams" or customer logos.** None to cite.
- **No SOC 2, GDPR or compliance badges.** Nothing has been audited.
- **Status pages are not described as SEO-friendly.** They are client-rendered
  and `noindex` on the current hosting plan.
- **No custom status page titles or slugs advertised.** The worker supports a
  `statusPages` document but there is no UI to write one, so `/status/<orgId>`
  with the heading "Service status" is what a new user actually gets.
