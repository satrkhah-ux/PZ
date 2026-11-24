import { SignInForm } from "@/components/auth/SignInForm";

/** Only same-origin paths. `startsWith("/")` is not enough: «//host/x» and
 *  «/\host» both resolve off-origin, and the form navigates here on mount with
 *  no click at all. Parse it and insist the origin did not change. */
function safeRedirect(raw: string | undefined): string {
  if (typeof raw !== "string" || raw === "") return "/dashboard";
  try {
    const base = "http://pizzara.invalid";
    const u = new URL(raw, base);
    return u.origin === base ? `${u.pathname}${u.search}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; rejected?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignInForm redirectTo={safeRedirect(sp.redirect)} rejected={sp.rejected === "1"} />
    </main>
  );
}
