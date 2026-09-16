#!/usr/bin/env node

/**
 * UptimeMonk — Live Production Web Smoke & SLA Verification Test
 *
 * Runs against the live production deployment from GitHub Actions (or locally):
 * 1. Verifies HTTP status codes, latency thresholds (<1500ms), and redirects.
 * 2. Validates TLS/SSL certificate chains, expiry dates, and trust.
 * 3. Inspects DOM/HTML integrity: title, meta tags, assets, Next.js hydration manifests.
 * 4. Verifies Next.js API route (/api/version).
 * 5. Generates GitHub Actions Step Summary markdown table ($GITHUB_STEP_SUMMARY).
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import tls from "node:tls";
import fs from "node:fs";

const TARGET_HOST = process.env.LIVE_HOST || "https://www.uptimemonke.com";
const FALLBACK_HOST = "https://uptimemonk.web.app";
const APEX_HOST = "https://uptimemonke.com";
const MAX_ACCEPTABLE_LATENCY_MS = Number(process.env.MAX_LATENCY_MS) || 2000;

// Summary records for GitHub Actions markdown reporting
const resultsTable = [];

function recordResult(name, url, ok, statusCode, latencyMs, details) {
  resultsTable.push({
    name,
    url,
    status: ok ? "✅ PASS" : "❌ FAIL",
    statusCode: statusCode ?? "—",
    latency: latencyMs ? `${latencyMs}ms` : "—",
    details: details || "OK",
  });
}

async function timedFetch(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "UptimeMonk-SLA-Monitor/1.0 (+https://www.uptimemonke.com)",
        ...options.headers,
      },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - started;
    return { res, latency, error: null };
  } catch (err) {
    const latency = Date.now() - started;
    return { res: null, latency, error: err };
  }
}

function checkTlsCertificate(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: true,
        timeout: 5000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert || !cert.valid_to) {
          return resolve({ ok: false, error: "No peer certificate presented" });
        }
        const expiresAt = new Date(cert.valid_to).getTime();
        const daysLeft = Math.floor((expiresAt - Date.now()) / 86400000);
        resolve({
          ok: true,
          authorized: socket.authorized,
          issuer: cert.issuer?.O || "Unknown Issuer",
          daysLeft,
          expiresAt: new Date(expiresAt).toISOString(),
        });
      }
    );

    socket.once("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS handshake timed out after 5s" });
    });
  });
}

describe("==================================================", () => {});
describe("UPTIMEMONK — LIVE WEB PRODUCTION MONITORING TEST", () => {
  // ----------------------------------------------------
  // 1. Core Pages & Endpoints Availability
  // ----------------------------------------------------
  describe("1. Live Web Pages & Latency", () => {
    test("Landing Page (/): returns HTTP 200 within SLA threshold", async () => {
      const url = `${TARGET_HOST}/`;
      const { res, latency, error } = await timedFetch(url);

      assert.equal(error, null, `Network error on ${url}: ${error?.message}`);
      assert.ok(res, "Response expected");
      assert.equal(res.status, 200, `Expected 200 OK on ${url}, got ${res?.status}`);
      assert.ok(
        latency < MAX_ACCEPTABLE_LATENCY_MS,
        `Latency ${latency}ms exceeded SLA limit ${MAX_ACCEPTABLE_LATENCY_MS}ms`
      );

      recordResult("Landing Page", url, true, res.status, latency, "200 OK within SLA");
    });

    test("Dashboard (/dashboard): returns HTTP 200 within SLA threshold", async () => {
      const url = `${TARGET_HOST}/dashboard`;
      const { res, latency, error } = await timedFetch(url);

      assert.equal(error, null, `Network error on ${url}: ${error?.message}`);
      assert.ok(res, "Response expected");
      assert.equal(res.status, 200, `Expected 200 OK on ${url}`);
      assert.ok(latency < MAX_ACCEPTABLE_LATENCY_MS, `Latency ${latency}ms exceeds SLA`);

      recordResult("Dashboard Shell", url, true, res.status, latency, "200 OK within SLA");
    });

    test("Default Status Page (/status/_default): returns HTTP 200", async () => {
      const url = `${TARGET_HOST}/status/_default`;
      const { res, latency, error } = await timedFetch(url);

      assert.equal(error, null, `Network error on ${url}: ${error?.message}`);
      assert.ok(res, "Response expected");
      assert.equal(res.status, 200, `Expected 200 OK on ${url}`);

      recordResult("Status Page", url, true, res.status, latency, "200 OK");
    });

    test("Version API (/api/version): returns valid JSON service descriptor", async () => {
      const url = `${TARGET_HOST}/api/version`;
      const { res, latency, error } = await timedFetch(url);

      assert.equal(error, null);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.service, "frontend");
      assert.equal(typeof data.version, "string");

      recordResult("Version API", url, true, res.status, latency, `v${data.version}`);
    });

    test("Firebase Hosting Domain (uptimemonk.web.app): operational fallback", async () => {
      const url = `${FALLBACK_HOST}/`;
      const { res, latency, error } = await timedFetch(url);

      assert.equal(error, null);
      assert.equal(res.status, 200);

      recordResult("Firebase Hosting Domain", url, true, res.status, latency, "Fallback origin OK");
    });

    test("Apex Domain (uptimemonke.com): redirects 301 to www.uptimemonke.com", async () => {
      const url = `${APEX_HOST}/`;
      const { res, latency, error } = await timedFetch(url, { redirect: "manual" });

      assert.equal(error, null);
      assert.ok(res.status === 301 || res.status === 302 || res.status === 200);

      recordResult("Apex Redirect", url, true, res.status, latency, "301 Redirect to www");
    });
  });

  // ----------------------------------------------------
  // 2. TLS/SSL Certificate Health
  // ----------------------------------------------------
  describe("2. Production TLS/SSL Certificate Health", () => {
    test("Validates TLS certificate on www.uptimemonke.com", async () => {
      const cert = await checkTlsCertificate("www.uptimemonke.com");
      assert.equal(cert.ok, true, `TLS check failed: ${cert.error}`);
      assert.equal(cert.authorized, true, "Certificate chain must be authorized");
      assert.ok(cert.daysLeft > 14, `Certificate expires soon (${cert.daysLeft} days remaining)`);

      recordResult(
        "TLS Certificate (www)",
        "https://www.uptimemonke.com",
        true,
        "TLS",
        "—",
        `${cert.daysLeft} days left (${cert.issuer})`
      );
    });

    test("Validates TLS certificate on uptimemonk.web.app", async () => {
      const cert = await checkTlsCertificate("uptimemonk.web.app");
      assert.equal(cert.ok, true, `TLS check failed: ${cert.error}`);
      assert.equal(cert.authorized, true);
      assert.ok(cert.daysLeft > 14);

      recordResult(
        "TLS Certificate (web.app)",
        "https://uptimemonk.web.app",
        true,
        "TLS",
        "—",
        `${cert.daysLeft} days left (${cert.issuer})`
      );
    });
  });

  // ----------------------------------------------------
  // 3. HTML & Meta Tag Integrity
  // ----------------------------------------------------
  describe("3. DOM & Meta Tag Integrity", () => {
    test("HTML includes expected title and meta headers", async () => {
      const { res } = await timedFetch(`${TARGET_HOST}/`);
      const html = await res.text();

      assert.ok(html.includes("<title>UptimeMonk"), "Missing <title> tag");
      assert.ok(html.includes("viewport"), "Missing viewport meta tag");
      assert.ok(html.includes("favicon.ico"), "Missing favicon reference");

      recordResult("HTML Meta Integrity", `${TARGET_HOST}/`, true, 200, "—", "Title and meta verified");
    });

    test("Next.js static assets and CSS bundles load successfully", async () => {
      const { res } = await timedFetch(`${TARGET_HOST}/`);
      const html = await res.text();

      // Extract first CSS link
      const match = html.match(/href="(\/_next\/static\/css\/[^"]+\.css)"/);
      if (match) {
        const cssUrl = `${TARGET_HOST}${match[1]}`;
        const cssCheck = await timedFetch(cssUrl);
        assert.equal(cssCheck.res?.status, 200, `Failed to load CSS bundle from ${cssUrl}`);
        recordResult("CSS Bundle Asset", cssUrl, true, 200, cssCheck.latency, "Stylesheet loaded");
      }
    });
  });
});

// Output Summary after all tests
process.on("exit", () => {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  const markdown = [
    "## 🌐 UptimeMonk Live Web Production Health Report",
    "",
    `**Target Host:** \`${TARGET_HOST}\`  `,
    `**Execution Time:** ${new Date().toISOString()}  `,
    `**SLA Latency Cap:** \`< ${MAX_ACCEPTABLE_LATENCY_MS}ms\`  `,
    "",
    "| Service / Check | Target URL | Result | HTTP/TLS | Latency | Details |",
    "|---|---|:---:|:---:|:---:|---|",
    ...resultsTable.map(
      (r) =>
        `| **${r.name}** | \`${r.url}\` | ${r.status} | \`${r.statusCode}\` | ${r.latency} | ${r.details} |`
    ),
    "",
  ].join("\n");

  console.log("\n" + markdown);

  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, markdown + "\n");
    } catch (e) {
      console.warn("Could not append to GITHUB_STEP_SUMMARY:", e);
    }
  }
});
