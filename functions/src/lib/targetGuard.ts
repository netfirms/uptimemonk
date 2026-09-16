import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Probe targets are attacker-controlled by design: anyone with an account can
 * point one at any URL, and the request leaves from inside Google's network.
 * Without a guard that is a server-side request forgery primitive — the GCP
 * metadata server at 169.254.169.254 hands out service-account tokens to
 * anything that asks with the right header, and a keyword monitor turns
 * "did the body contain X" into a boolean oracle for reading the response.
 *
 * So: every target is validated before a socket is opened, every redirect hop
 * is validated again, and the headers that make the metadata server answer are
 * stripped. Blocking by hostname alone is not enough — the name has to be
 * resolved and the resulting addresses checked, because "evil.com" can have an
 * A record of 169.254.169.254.
 */
export class BlockedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedTargetError";
  }
}

/** Headers a customer may never set: these are what internal services trust. */
const FORBIDDEN_HEADERS = new Set([
  "metadata-flavor",
  "x-google-metadata-request",
  "x-goog-authenticated-user-email",
  "x-goog-iap-jwt-assertion",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-real-ip",
  "host",
  "content-length",
  "connection",
]);

const ipv4ToInt = (ip: string): number => {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
};

/** CIDR blocks that must never be reachable from a probe. */
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // RFC1918 private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local — GCP/AWS metadata lives here
  ["172.16.0.0", 12], // RFC1918 private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // RFC1918 private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];

function isBlockedV4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (ipv4ToInt(base) & mask);
  });
}

/**
 * Expand an IPv6 address to its 16 bytes.
 *
 * Matching IPv6 as a string does not work: `new URL()` rewrites
 * `::ffff:169.254.169.254` as `::ffff:a9fe:a9fe`, so a dotted-quad pattern
 * lets the metadata server straight through. Parse it properly instead.
 */
function parseV6(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0]; // strip any zone index

  // A trailing dotted quad (::ffff:1.2.3.4) becomes two hex groups.
  const dotted = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const q = dotted[1].split(".").map(Number);
    if (q.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hex =
      ((q[0] << 8) | q[1]).toString(16) + ":" + ((q[2] << 8) | q[3]).toString(16);
    addr = addr.slice(0, -dotted[1].length) + hex;
  }

  const [head, tail, ...rest] = addr.split("::");
  if (rest.length) return null; // more than one "::" is not a valid address

  const toGroups = (part: string) =>
    part ? part.split(":").filter((g) => g !== "") : [];
  const left = toGroups(head);
  const right = tail === undefined ? [] : toGroups(tail);
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];

  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    const v = parseInt(g, 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) return null;
    bytes.push(v >> 8, v & 0xff);
  }
  return bytes;
}

function isBlockedV6(ip: string): boolean {
  const b = parseV6(ip);
  if (!b) return true; // unparseable: refuse rather than guess

  const zerosUpTo = (n: number) => b.slice(0, n).every((x) => x === 0);
  const asV4 = () => b.slice(12).join(".");

  // ::ffff:0:0/96 (IPv4-mapped) and ::/96 (IPv4-compatible) reach IPv4 space,
  // so they are judged by the IPv4 rules.
  if (zerosUpTo(10) && b[10] === 0xff && b[11] === 0xff) return isBlockedV4(asV4());
  if (zerosUpTo(12)) {
    if (b[12] === 0 && b[13] === 0 && b[14] === 0 && b[15] <= 1) return true; // ::, ::1
    return isBlockedV4(asV4());
  }

  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7  unique-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0xff) return true; // ff00::/8  multicast
  // 64:ff9b::/96 (NAT64) and 2002::/16 (6to4) both tunnel to IPv4.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return true;
  if (b[0] === 0x20 && b[1] === 0x02) return isBlockedV4(b.slice(2, 6).join("."));
  return false;
}

/** True when this literal address is one a probe must never reach. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedV4(ip);
  if (net.isIPv6(ip)) return isBlockedV6(ip);
  return false;
}

/**
 * Resolve `host` and assert every address it points at is publicly routable.
 * Every address, not just the first: a hostname with two A records, one public
 * and one link-local, would otherwise pass validation and then connect to the
 * private one on a later attempt.
 */
export async function assertPublicHost(host: string): Promise<void> {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!bare) throw new BlockedTargetError("Target has no hostname");

  // Names that resolve inside the cluster rather than on the internet.
  if (
    bare === "localhost" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".internal") ||
    bare.endsWith(".local") ||
    bare === "metadata" ||
    bare === "metadata.google.internal"
  ) {
    throw new BlockedTargetError(`Target "${host}" is an internal hostname`);
  }

  if (net.isIP(bare)) {
    if (isBlockedAddress(bare)) {
      throw new BlockedTargetError(
        `Target ${host} is a private or link-local address`
      );
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(bare, { all: true });
  } catch {
    // A name that does not resolve is the probe's problem to report, not a
    // security failure — let the check itself produce the DNS error.
    return;
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new BlockedTargetError(
        `Target "${host}" resolves to ${address}, a private or link-local address`
      );
    }
  }
}

/**
 * Validate a URL a probe is about to request. Used for the monitor's own
 * target and again for every redirect it is asked to follow.
 */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedTargetError(`"${raw}" is not a valid URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedTargetError(
      `Only http and https targets are supported (got ${url.protocol})`
    );
  }
  // Credentials in the URL are a classic way to confuse a parser into sending
  // the request somewhere other than the host an operator sees.
  if (url.username || url.password) {
    throw new BlockedTargetError("Credentials in the URL are not allowed");
  }

  await assertPublicHost(url.hostname);
  return url;
}

/** Host[:port] for tcp/dns/ssl monitors, which are not URLs. */
export function hostFromTarget(target: string): string {
  const stripped = target.trim().replace(/^\w+:\/\//, "").split("/")[0];
  const v6 = stripped.match(/^\[([^\]]+)\]/);
  if (v6) return v6[1];
  // Only treat a trailing :NNNN as a port, so bare IPv6 survives.
  return stripped.includes(":") && !net.isIPv6(stripped)
    ? stripped.split(":")[0]
    : stripped;
}

/** Drop headers that would let a caller impersonate an internal client. */
export function sanitizeHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (FORBIDDEN_HEADERS.has(key.trim().toLowerCase())) continue;
    safe[key] = value;
  }
  return safe;
}
