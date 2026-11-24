import { NextResponse, type NextRequest } from "next/server";
import { AUTH_STORAGE_KEY, parseSessionCookie } from "@/lib/supabase/constants";

/**
 * Auth gate (Next 16 `proxy` convention — successor to `middleware`).
 *
 * Public surfaces the customer reaches without a login:
 *   /menu   — QR self-order menu
 *   /kiosk  — tablet self-order menu
 *   /card   — a customer's loyalty card (by unguessable serial)
 *   /tv     — the pickup screen (guarded by its own display key, never a session:
 *             a TV on the ceiling has no keyboard to re-login with every week)
 * Staff surfaces (/dashboard, /cashier, admin) require a session.
 *
 * Presence of a valid session cookie is the signal — token *validation* happens
 * server-side (getServerUser) and in the browser client, so we never bounce a
 * user whose short-lived access token expired but who still holds a refresh token.
 */

const PUBLIC_PREFIXES = ["/sign-in", "/menu", "/kiosk", "/card", "/tv"];
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

    // The pickup screen is a TV nobody touches, and TV browsers suspend JS timers
    // on an untouched page. A REAL HTTP Refresh header keeps it alive even when
    // every JS timer is frozen (a <meta http-equiv> would be stripped by Next).
    // 60s, not the 10s of the original design: every rebuild is a serverless
    // invocation, and this account was already paused once for burning credits.
    if (request.nextUrl.pathname.startsWith("/tv/")) {
      const res = NextResponse.next();
      res.headers.set("Refresh", "60");
      return res;
    }

    const session = parseSessionCookie(request.cookies.get(AUTH_STORAGE_KEY)?.value);
    const isAuthed = session !== null;
    // A cookie proves nothing on its own: the token behind it may be expired,
    // revoked, or from another project. An expiry we cannot read counts as
    // expired — never claim a session is fresh without evidence.
    const expired = session?.expiresAt == null || session.expiresAt * 1000 < Date.now();

    // /sign-in is NEVER redirected away from. It is the recovery surface: the
    // staff layout sends a rejected session here, so bouncing it back to
    // /dashboard closes a cycle the browser can never escape — which is exactly
    // how the counter hit ERR_TOO_MANY_REDIRECTS. Checking the expiry first is
    // not enough; a cookie can look fresh and still be refused server-side.
    // Only the bare root forwards a signed-in user onward.
    if (isAuthed && !expired && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Root routing lives HERE (not in next.config) so it can see the session:
    // fresh staff session → /dashboard (handled above). An EXPIRED staff cookie →
    // re-login then land on the dashboard (so the installed admin app recovers
    // without dumping them on the customer menu). No session at all (a customer)
    // → the menu. In next.config this ran BEFORE the proxy and always sent even
    // logged-in staff to /menu.
    if (pathname === "/" && process.env.MODERN_ONLY === "1") {
      if (isAuthed && expired) {
        const u = new URL("/sign-in", request.url);
        u.searchParams.set("redirect", "/dashboard");
        return NextResponse.redirect(u);
      }
      return NextResponse.redirect(new URL("/menu", request.url));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|admin-manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|pdf)$).*)"],
};
