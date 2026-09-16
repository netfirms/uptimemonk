import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BlockedTargetError,
  assertPublicHost,
  assertSafeUrl,
  hostFromTarget,
  isBlockedAddress,
  sanitizeHeaders,
} from "./targetGuard.js";

describe("isBlockedAddress", () => {
  test("blocks the cloud metadata address", () => {
    // The one that matters: this endpoint hands out service-account tokens.
    assert.equal(isBlockedAddress("169.254.169.254"), true);
  });

  test("blocks loopback, RFC1918 and CGNAT ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1",
    ]) {
      assert.equal(isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });

  test("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "93.184.216.34"]) {
      assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`);
    }
  });

  test("blocks IPv6 loopback, link-local and unique-local", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1"]) {
      assert.equal(isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });

  test("sees through IPv4-mapped IPv6, which is the usual bypass", () => {
    assert.equal(isBlockedAddress("::ffff:169.254.169.254"), true);
    assert.equal(isBlockedAddress("::ffff:127.0.0.1"), true);
    assert.equal(isBlockedAddress("::ffff:8.8.8.8"), false);
  });

  test("blocks NAT64 and 6to4, which reach IPv4 space", () => {
    assert.equal(isBlockedAddress("64:ff9b::a9fe:a9fe"), true);
    assert.equal(isBlockedAddress("2002:a9fe:a9fe::1"), true);
  });

  test("allows public IPv6", () => {
    assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
  });
});

describe("assertPublicHost", () => {
  const blocked = (host: string) =>
    assert.rejects(() => assertPublicHost(host), BlockedTargetError, host);

  test("rejects internal hostnames by name", async () => {
    await blocked("localhost");
    await blocked("metadata.google.internal");
    await blocked("metadata");
    await blocked("db.internal");
    await blocked("printer.local");
  });

  test("rejects literal private addresses", async () => {
    await blocked("169.254.169.254");
    await blocked("127.0.0.1");
    await blocked("[::1]");
  });

  test("accepts a public literal address", async () => {
    await assertPublicHost("8.8.8.8");
  });
});

describe("assertSafeUrl", () => {
  test("rejects non-http schemes", async () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://example.com/",
      "ftp://example.com/",
    ]) {
      await assert.rejects(() => assertSafeUrl(url), BlockedTargetError, url);
    }
  });

  test("rejects the metadata server however it is spelled", async () => {
    await assert.rejects(
      () => assertSafeUrl("http://169.254.169.254/computeMetadata/v1/"),
      BlockedTargetError
    );
    await assert.rejects(
      () => assertSafeUrl("http://metadata.google.internal/"),
      BlockedTargetError
    );
    await assert.rejects(
      () => assertSafeUrl("http://[::ffff:169.254.169.254]/"),
      BlockedTargetError
    );
  });

  test("rejects credentials embedded in the URL", async () => {
    await assert.rejects(
      () => assertSafeUrl("http://user:pass@8.8.8.8/"),
      BlockedTargetError
    );
  });

  test("rejects garbage", async () => {
    await assert.rejects(() => assertSafeUrl("not a url"), BlockedTargetError);
  });

  test("accepts a normal https target", async () => {
    const url = await assertSafeUrl("https://example.com/health?x=1");
    assert.equal(url.hostname, "example.com");
  });
});

describe("sanitizeHeaders", () => {
  test("strips the header that makes the metadata server answer", () => {
    const safe = sanitizeHeaders({
      "Metadata-Flavor": "Google",
      "X-Forwarded-For": "10.0.0.1",
      Authorization: "Bearer customer-own-token",
      "X-Custom": "keep me",
    });
    assert.deepEqual(safe, {
      Authorization: "Bearer customer-own-token",
      "X-Custom": "keep me",
    });
  });

  test("matches case-insensitively", () => {
    assert.deepEqual(sanitizeHeaders({ "mEtAdAtA-fLaVoR": "Google" }), {});
  });

  test("handles undefined", () => {
    assert.deepEqual(sanitizeHeaders(undefined), {});
  });
});

describe("hostFromTarget", () => {
  test("pulls the host out of the forms monitors actually use", () => {
    assert.equal(hostFromTarget("https://example.com/path"), "example.com");
    assert.equal(hostFromTarget("example.com:8443"), "example.com");
    assert.equal(hostFromTarget("example.com"), "example.com");
    assert.equal(hostFromTarget("  https://example.com  "), "example.com");
  });

  test("keeps bracketed IPv6 intact rather than splitting on its colons", () => {
    assert.equal(hostFromTarget("[2606:4700::1111]:443"), "2606:4700::1111");
  });
});
