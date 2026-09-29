/**
 * Browser network privacy invariant recorder (Work Order T21 #25; SPEC_V4_
 * QUALITY_SECURITY_DEPLOY.md §2 "Network privacy invariant", D-014, CONTEXT.md
 * §6).
 *
 * The clinical runtime must be self-contained: CI/E2E must FAIL on unexpected
 * outbound runtime requests. This recorder is the E2E counterpart of the
 * in-process jsdom monitor (app-v4/src/testing/network-monitor.ts): it
 * intercepts every request the page issues, classifies it against the app
 * origin, RECORDS every external request as a violation and — in the default
 * enforcing mode — aborts it so no bytes can ever leave towards an
 * unexpected destination, even when a regression plants one.
 *
 * Classification is fail-closed for the invariant:
 *   - http/https/ws/wss to the app origin → internal (allowed);
 *   - http/https/ws/wss anywhere else      → external VIOLATION;
 *   - blob:/data:/about:/other schemes      → non-network (no wire request;
 *     they never appear as outbound requests anyway).
 *
 * An oracle that only "checks today's traffic" proves nothing, so the
 * adversarial spec (e2e/network-invariant.spec.ts) PLANTS a representative
 * external request and asserts this recorder detects it: the detector must
 * be able to disagree with the application.
 */
import type { Page, Request, Route } from "@playwright/test";

export type ExternalRequest = {
  readonly url: string;
  readonly resourceType: string;
};

export type NetworkMode =
  /** Default: record external requests, abort them, and fail the test. */
  | "forbid-external"
  /** Adversarial-oracle mode: record only (the spec asserts detection). */
  | "record-only";

const NETWORK_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

export type OutboundClass = "internal" | "external" | "non-network";

/** Pure classifier so the adversarial oracle can test it directly. */
export function classifyOutboundUrl(url: string, baseOrigin: string): OutboundClass {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "non-network";
  }
  if (!NETWORK_PROTOCOLS.has(parsed.protocol)) return "non-network";
  return parsed.origin === baseOrigin ? "internal" : "external";
}

export class NetworkRecorder {
  readonly violations: ExternalRequest[] = [];

  private constructor(
    private readonly baseOrigin: string,
    private readonly blockExternal: boolean
  ) {}

  /**
   * Attach the recorder to a page. Every request is routed through
   * {@link handleRoute}, so classification and blocking happen in ONE
   * authoritative place. The recorder never performs network I/O itself.
   */
  static install(page: Page, baseOrigin: string, blockExternal: boolean): NetworkRecorder {
    const recorder = new NetworkRecorder(baseOrigin, blockExternal);
    void page.route("**/*", (route) => recorder.handleRoute(route));
    return recorder;
  }

  private handleRoute(route: Route): void {
    const request: Request = route.request();
    const classification = classifyOutboundUrl(request.url(), this.baseOrigin);
    if (classification === "external") {
      this.violations.push({
        url: request.url(),
        resourceType: request.resourceType(),
      });
      if (this.blockExternal) {
        void route.abort();
        return;
      }
    }
    // No later handler exists in this suite; the request proceeds unmodified.
    void route.fallback();
  }
}
