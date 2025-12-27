/**
 * Central config. Works for:
 * - Web (Vite dev server)
 * - Tauri (desktop) where backend is local sidecar
 *
 * `VITE_API_BASE` should be http://127.0.0.1:8000
 * `VITE_WS_BASE` should be ws://127.0.0.1:8000
 */
export const CONFIG = {
  API_BASE: import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000",
  WS_BASE:
    import.meta.env.VITE_WS_BASE ??
    ((import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000").replace(/^http/i, "ws")),
} as const;
