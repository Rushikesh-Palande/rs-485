/**
 * Small helper so the same UI works in:
 * - Browser (web)
 * - Tauri desktop
 *
 * We avoid importing Tauri plugins at module-load time because that breaks the web build.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}
