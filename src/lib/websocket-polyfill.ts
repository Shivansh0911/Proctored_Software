// @supabase/supabase-js always constructs a Realtime client internally, even
// though this app never calls .channel()/.send() — we only use Auth,
// Postgrest, and Storage. As of a recent @supabase/realtime-js version, that
// construction throws immediately if no global `WebSocket` constructor
// exists, which is true on Node.js < 22 *and* in Next.js Edge Middleware
// (where a real WebSocket is deliberately unsupported). A no-op stub is
// enough: it's only ever constructed, never connected.
if (typeof globalThis.WebSocket === "undefined") {
  class NoopWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly readyState = NoopWebSocket.CLOSED;
    readonly url = "";
    readonly protocol = "";
    onopen = null;
    onmessage = null;
    onclose = null;
    onerror = null;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }
  // @ts-expect-error — intentionally not a spec-complete WebSocket, just enough to pass construction-time detection
  globalThis.WebSocket = NoopWebSocket;
}

export {};
