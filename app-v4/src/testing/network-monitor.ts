/**
 * Recording network monitor for the clinical runtime no-network invariant
 * (SPEC_V4_QUALITY_SECURITY_DEPLOY.md §2 "Network privacy invariant",
 * CURRENT_DECISIONS.md D-014, CONTEXT.md §6).
 *
 * install(window) replaces the outbound-capable browser APIs of the given
 * jsdom window with recorders that NEVER perform network I/O:
 *   - window.fetch: records the attempt and throws NetworkInvariantError.
 *   - XMLHttpRequest.prototype.open: records the request URL; send is
 *     blocked by throwing before the request is issued.
 *   - navigator.sendBeacon: records the attempt and returns false
 *     (defined if the runtime lacks it).
 *   - WebSocket: records the connection attempt and throws before any
 *     connection is opened (defined if the runtime lacks it).
 *
 * This is the in-process (jsdom) network hook; real browser network
 * interception arrives with the E2E ticket. Tests must always reference
 * `window.*` (not bare globals) so the replaced bindings are exercised.
 */
export type NetworkAttemptKind = "fetch" | "xhr" | "sendBeacon" | "websocket";

export type NetworkAttempt = {
  readonly kind: NetworkAttemptKind;
  readonly url: string;
};

/** Dedicated error thrown when an outbound request attempt is blocked. */
export class NetworkInvariantError extends Error {
  readonly kind: NetworkAttemptKind;
  readonly url: string;

  constructor(kind: NetworkAttemptKind, url: string, message: string) {
    super(message);
    this.name = "NetworkInvariantError";
    this.kind = kind;
    this.url = url;
  }
}

export type NetworkMonitor = {
  /** Attempts recorded so far, oldest first (copy; caller cannot mutate). */
  attempts: () => NetworkAttempt[];
  /** Restores the original window bindings. */
  uninstall: () => void;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type XhrProtoLike = {
  open: (...args: unknown[]) => void;
  send: (...args: unknown[]) => void;
};
type SendBeaconLike = (url: string | URL, data?: BodyInit | null) => boolean;
type WindowNetworkApi = {
  fetch?: FetchLike;
  XMLHttpRequest: typeof XMLHttpRequest;
  WebSocket?: typeof WebSocket;
};

function describeUrl(url: unknown): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.href;
  return String(url);
}

export function install(target: Window): NetworkMonitor {
  const attempts: NetworkAttempt[] = [];
  const record = (kind: NetworkAttemptKind, url: string): void => {
    attempts.push({ kind, url });
  };
  const win = target as unknown as WindowNetworkApi;

  // --- fetch: record and block -------------------------------------------
  const hadFetch = typeof win.fetch === "function";
  const originalFetch = win.fetch;
  win.fetch = ((input: RequestInfo | URL): Promise<Response> => {
    const url = describeUrl(input);
    record("fetch", url);
    throw new NetworkInvariantError(
      "fetch",
      url,
      `Unexpected outbound fetch attempt blocked: ${url}`
    );
  }) as FetchLike;

  // --- XMLHttpRequest: record at open, block before send ------------------
  const xhrProto = win.XMLHttpRequest.prototype as unknown as XhrProtoLike;
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;
  xhrProto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    record("xhr", describeUrl(args[1]));
    return originalOpen.apply(this, args);
  };
  xhrProto.send = function (): void {
    throw new NetworkInvariantError(
      "xhr",
      "blocked-before-send",
      "Unexpected XMLHttpRequest send blocked; request URL was recorded at open()."
    );
  };

  // --- navigator.sendBeacon: record and refuse (define if missing) --------
  const navigatorRef = target.navigator as unknown as { sendBeacon?: SendBeaconLike };
  const hadOwnSendBeacon = Object.prototype.hasOwnProperty.call(navigatorRef, "sendBeacon");
  const originalSendBeacon = navigatorRef.sendBeacon;
  const beaconRecorder: SendBeaconLike = (url) => {
    record("sendBeacon", describeUrl(url));
    return false;
  };
  Object.defineProperty(navigatorRef, "sendBeacon", {
    value: beaconRecorder,
    configurable: true,
    writable: true
  });

  // --- WebSocket: record and block before any connection ------------------
  const hadWebSocket = typeof win.WebSocket === "function";
  const originalWebSocket = win.WebSocket;
  const RecordingWebSocket = function (this: unknown, url: string | URL): void {
    const href = describeUrl(url);
    record("websocket", href);
    throw new NetworkInvariantError(
      "websocket",
      href,
      `Unexpected WebSocket connection attempt blocked: ${href}`
    );
  } as unknown as typeof WebSocket;
  win.WebSocket = RecordingWebSocket;

  return {
    attempts: (): NetworkAttempt[] => [...attempts],
    uninstall: (): void => {
      if (hadFetch && originalFetch) win.fetch = originalFetch;
      else delete win.fetch;
      xhrProto.open = originalOpen;
      xhrProto.send = originalSend;
      if (hadOwnSendBeacon && originalSendBeacon) {
        Object.defineProperty(navigatorRef, "sendBeacon", {
          value: originalSendBeacon,
          configurable: true,
          writable: true
        });
      } else {
        delete navigatorRef.sendBeacon;
      }
      if (hadWebSocket && originalWebSocket) win.WebSocket = originalWebSocket;
      else delete win.WebSocket;
    }
  };
}
