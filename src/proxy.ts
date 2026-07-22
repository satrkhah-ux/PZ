import { NextResponse, type NextRequest } from "next/server";
import { AUTH_STORAGE_KEY, parseSessionCookie } from "@/lib/supabase/constants";

/**
 * Auth gate (Next 16 `proxy` convention — successor to `middleware`).
 *
 * Public surfaces the customer reaches without a login:
 *   /menu   — QR self-order menu
 *   /kiosk  — tablet self-order menu
 *   /card   — a customer's loyalty card (by unguessable serial)
 * Staff surfaces (/dashboard, /cashier, admin) require a session.
 *
 * Presence of a valid session cookie is the signal — token *validation* happens
 * server-side (getServerUser) and in the browser client, so we never bounce a
 * user whose short-lived access token expired but who still holds a refresh token.
 */

const PUBLIC_PREFIXES = ["/sign-in", "/menu", "/kiosk", "/card"];
const LOGIN_PATHS = new Set(["/", "/sign-in"]);

function isPublic(pathname: string): boolean {
  if (LOGIN_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  // FAIL-SAFE: runs on every page view. If anything throws, fail OPEN and serve
  // the request — that only skips the redirect convenience; every page/action
  // still verifies the session server-side, so content stays protected.
  try {
    const { pathname } = request.nextUrl;

    // DEMO trial (local dev only, no Supabase configured): don't force login, so
    // staff screens are browsable. Gated to development so a production deploy
    // whose public env is injected at runtime can NEVER bypass the gate here.
    if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.next();
    }

    const session = parseSessionCookie(request.cookies.get(AUTH_STORAGE_KEY)?.value);
    const isAuthed = session !== null;

    if (isAuthed && LOGIN_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isAuthed && !isPublic(pathname)) {
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  // Run on all routes except Next internals and static assets. The PWA manifest
  // must stay public — the browser fetches it credential-less to install the app.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|pdf)$).*)"],
};
