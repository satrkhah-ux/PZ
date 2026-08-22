"use client";

import { createSupabaseBrowserClient } from "./client";

/** Refresh this many ms before the access token actually expires. The server
 *  refuses an expired token outright (see createSupabaseServerClient), so the
 *  margin has to cover a slow request too. */
const REFRESH_MARGIN_MS = 120_000;

/**
 * Guarantees the session cookie carries a VALID access token before a server
 * action runs. The POS screen sits open for hours and the PC sleeps, which
 * silently kills supabase-js's refresh timer — the next action then failed with
 * "غير مصرّح" and the cashier saw a misleading "check your internet" message.
 */
export async function ensureFreshSession(): Promise<boolean> {
  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return true; // demo mode: no Supabase configured, nothing to keep alive
  }
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;

    const expiresInMs = session.expires_at ? session.expires_at * 1000 - Date.now() : Infinity;
    if (expiresInMs > REFRESH_MARGIN_MS) return true;

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    return !error && !!refreshed.session;
  } catch {
    return false;
  }
}

/** True when a thrown server-action error is really "your session died". */
export function isAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /غير مصرّح|سجّل الدخول|Unauthorized|JWT|401/i.test(msg);
}

/**
 * Keeps the staff session alive while a screen is open: refreshes on tab focus
 * and every few minutes. Returns a cleanup function.
 */
export function startSessionKeeper(): () => void {
  const onWake = () => {
    if (document.visibilityState === "visible") void ensureFreshSession();
  };
  const timer = window.setInterval(() => void ensureFreshSession(), 10 * 60 * 1000);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  void ensureFreshSession();
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  };
}
