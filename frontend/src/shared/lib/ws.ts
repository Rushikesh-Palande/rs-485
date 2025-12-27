import { CONFIG } from "./config";
import type { TelemetryEvent } from "../types/telemetry";

type Status = { connected: boolean };

function wsUrl(path: string): string {
  return `${CONFIG.WS_BASE}${path}`;
}

/**
 * Enterprise realtime ingestion client:
 * - Single WS connection
 * - Batches incoming messages per animation frame (minimizes React work)
 * - Automatic reconnect with backoff + jitter
 * - Accepts either a single event or an array of events
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private stopped = false;

  private backoffMs = 250;
  private buffer: TelemetryEvent[] = [];
  private raf = 0;

  constructor(
    private readonly path: string,
    private readonly onBatch: (events: TelemetryEvent[]) => void | Promise<void>,
    private readonly onStatus?: (s: Status) => void
  ) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.ws) this.ws.close();
    this.ws = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.buffer = [];
  }

  private connect(): void {
    const url = wsUrl(this.path);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoffMs = 250;
      this.onStatus?.({ connected: true });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const events: TelemetryEvent[] = Array.isArray(msg) ? msg : [msg];
        this.buffer.push(...events);
        this.flushRaf();
      } catch {
        // Intentionally ignore malformed payloads. Server logs should show why.
      }
    };

    ws.onerror = () => {
      // errors are followed by close in most browsers
    };

    ws.onclose = () => {
      this.onStatus?.({ connected: false });
      if (this.stopped) return;

      // Exponential backoff + jitter
      const jitter = Math.floor(Math.random() * 150);
      const wait = Math.min(5000, this.backoffMs + jitter);
      this.backoffMs = Math.min(5000, this.backoffMs * 2);

      setTimeout(() => this.connect(), wait);
    };
  }

  private flushRaf(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(async () => {
      this.raf = 0;
      if (this.buffer.length === 0) return;

      const batch = this.buffer;
      this.buffer = [];

      await this.onBatch(batch);
    });
  }
}
