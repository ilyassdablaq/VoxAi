/**
 * SSRF guards for the website crawler.
 *
 * Two layers of defense:
 *  1. `assertPublicUrl` — protocol check + literal private-host check + DNS
 *     resolution, rejecting any host that resolves to a private/loopback/
 *     link-local address. This closes the DNS-rebinding hole where a public
 *     hostname points at internal infrastructure.
 *  2. `safeFetch` — follows redirects manually and re-validates every hop, so a
 *     public URL cannot 30x-redirect us into the private network.
 *
 * Residual risk: a small TOCTOU window remains between DNS validation and the
 * actual TCP connect (the OS may re-resolve). For our crawl use case this is an
 * acceptable trade-off versus pinning the connection to a validated IP (which
 * would break TLS SNI/cert validation for https).
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { AppError } from "../../common/errors/app-error.js";

const MAX_REDIRECTS = 5;

export function isPrivateIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) {
    if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) {
      return true;
    }
    const octets = ip.split(".").map((part) => Number(part));
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return true;
    }
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) {
      return true; // 100.64.0.0/10 (CGNAT)
    }
    return octets[0] === 0;
  }

  if (ipVersion === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:") // IPv4-mapped — validate the embedded v4 separately
    );
  }

  return false;
}

export function isPrivateHostnameLiteral(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (["localhost", "0.0.0.0", "::1", "::"].includes(host)) {
    return true;
  }
  if (host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host) && isPrivateIp(host)) {
    return true;
  }
  return false;
}

/**
 * Throw if `url` is not a public HTTP(S) target. Resolves DNS and rejects when
 * any resolved address is private/loopback/link-local.
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(400, "INVALID_URL_PROTOCOL", "Only HTTP/HTTPS URLs are supported");
  }

  const hostname = url.hostname.toLowerCase();
  if (isPrivateHostnameLiteral(hostname)) {
    throw new AppError(400, "INVALID_CRAWL_TARGET", "Private or local crawl targets are not allowed");
  }

  // Literal IPs are already covered above; only resolve real hostnames.
  if (isIP(hostname)) {
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new AppError(400, "INVALID_CRAWL_TARGET", "Could not resolve the host for the provided URL");
  }

  if (addresses.length === 0) {
    throw new AppError(400, "INVALID_CRAWL_TARGET", "The provided URL did not resolve to any address");
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new AppError(400, "INVALID_CRAWL_TARGET", "The provided URL resolves to a private network address");
    }
  }
}

/**
 * `fetch` that validates the target before each hop and follows redirects
 * manually, re-validating every `Location`. Never auto-follows into a private
 * address.
 */
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
  maxRedirects: number = MAX_REDIRECTS,
): Promise<Response> {
  let currentUrl = typeof input === "string" ? new URL(input) : input;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicUrl(currentUrl);

    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");
    if (!isRedirect || !location) {
      return response;
    }

    // Resolve relative redirects against the current URL, then re-validate.
    currentUrl = new URL(location, currentUrl);
  }

  throw new AppError(400, "URL_TOO_MANY_REDIRECTS", "The provided URL redirected too many times");
}
