"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/cafe/auth";

const NAV: { href: string; label: string; adminOnly: boolean }[] = [
  { href: "/dashboard", label: "لوحة التحكم", adminOnly: true },
  { href: "/cashier", label: "الكاشير", adminOnly: false },
  { href: "/menu-admin", label: "المنيو", adminOnly: true },
  { href: "/loyalty", label: "الولاء", adminOnly: false },
  { href: "/expenses", label: "المصروفات", adminOnly: true },
  { href: "/qr", label: "رموز QR", adminOnly: true },
];

export function StaffShell({
  role,
  name,
  children,
}: {
  role: StaffRole | null;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = NAV.filter((n) => !n.adminOnly || role === "admin");

  // Keep the session alive on staff screens: instantiating the browser client
  // starts supabase-js's auto-refresh loop, which renews the access token and
  // writes it back to the cookie the server reads. Without this, server reads
  // silently degrade to anon an hour after login.
  useEffect(() => {
    try {
      createSupabaseBrowserClient();
    } catch {
      /* demo mode: no supabase env */
    }
  }, []);

  async function signOut() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="whitespace-nowrap text-lg font-extrabold text-primary">
              بيزارا كافيه
            </Link>
            <nav className="flex gap-1 overflow-x-auto">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    pathname.startsWith(l.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-secondary"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            <button onClick={signOut} aria-label="تسجيل الخروج" className="rounded-lg border border-border p-2 hover:bg-secondary">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
