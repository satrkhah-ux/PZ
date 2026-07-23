"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/cafe/auth";
import { listPendingOrders } from "@/lib/cafe/cashier-actions";
import { savePushSubscription, removePushSubscription } from "@/lib/cafe/push-actions";
import { PizzaraMark } from "./Logo";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** two-tone chime for a new incoming order (WebAudio — no asset needed) */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    /* audio blocked before first interaction — fine */
  }
}

const NAV: { href: string; label: string; adminOnly: boolean }[] = [
  { href: "/dashboard", label: "لوحة التحكم", adminOnly: true },
  { href: "/cashier", label: "الكاشير", adminOnly: false },
  { href: "/orders", label: "الطلبات الواردة", adminOnly: false },
  { href: "/tables", label: "الطاولات", adminOnly: false },
  { href: "/menu-admin", label: "المنيو", adminOnly: true },
  { href: "/loyalty", label: "الولاء", adminOnly: false },
  { href: "/expenses", label: "المصروفات", adminOnly: true },
  { href: "/employees", label: "الموظفون", adminOnly: true },
  { href: "/qr", label: "رموز QR", adminOnly: true },
];

export function StaffShell({
  role,
  name,
  pushKey = null,
  children,
}: {
  role: StaffRole | null;
  name: string;
  pushKey?: string | null;
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

  // new-order alert on EVERY staff screen: poll pending self-orders, badge the
  // cashier nav item, and chime + toast when a fresh table order lands.
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState<{ seq: number; table: string | null } | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    let stopped = false;
    async function tick() {
      try {
        const orders = await listPendingOrders();
        if (stopped) return;
        setPendingCount(orders.length);
        if (knownIds.current) {
          const fresh = orders.find((o) => !knownIds.current!.has(o.id));
          if (fresh) {
            setToast({ seq: fresh.order_seq, table: fresh.table_no });
            chime();
            setTimeout(() => setToast(null), 9000);
          }
        }
        knownIds.current = new Set(orders.map((o) => o.id));
      } catch {
        /* demo mode or transient error */
      }
    }
    tick();
    const t = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  // Web Push: notifications that reach the device even with the app closed.
  const [pushState, setPushState] = useState<"unsupported" | "off" | "on" | "denied">("unsupported");
  useEffect(() => {
    if (!pushKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : Notification.permission === "denied" ? "denied" : "off");
      })
      .catch(() => {});
  }, [pushKey]);
  async function togglePush() {
    if (!pushKey) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await removePushSubscription(existing.endpoint);
        setPushState("off");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState(perm === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushKey) });
      const j = sub.toJSON();
      if (!j.keys?.p256dh || !j.keys?.auth) return;
      await savePushSubscription({ endpoint: sub.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
      setPushState("on");
    } catch {
      /* unsupported browser / user dismissed */
    }
  }

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
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-extrabold text-primary">
              <PizzaraMark className="size-9" />
              بيزارا كافيه
            </Link>
            <nav className="flex gap-1 overflow-x-auto">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    pathname.startsWith(l.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-secondary"
                  }`}
                >
                  {l.label}
                  {l.href === "/orders" && pendingCount > 0 && (
                    <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            {pushState !== "unsupported" && (
              <button
                onClick={togglePush}
                aria-label="إشعارات الطلبات"
                title={
                  pushState === "on"
                    ? "الإشعارات مفعّلة — تصل حتى والتطبيق مغلق"
                    : pushState === "denied"
                      ? "الإشعارات محظورة — فعّلها من إعدادات الموقع في المتصفح"
                      : "تفعيل إشعارات الطلبات (تصل حتى والتطبيق مغلق)"
                }
                className={`rounded-lg border p-2 transition ${
                  pushState === "on" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {pushState === "on" ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              </button>
            )}
            <button onClick={signOut} aria-label="تسجيل الخروج" className="rounded-lg border border-border p-2 hover:bg-secondary">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>

      {/* new-order toast */}
      {toast && (
        <Link
          href="/orders"
          onClick={() => setToast(null)}
          className="fixed inset-x-4 top-16 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-xl print:hidden"
        >
          <BellRing className="size-6 shrink-0 animate-bounce" />
          <span className="font-bold">
            طلب جديد #{String(toast.seq).padStart(3, "0")}
            {toast.table ? ` — طاولة ${toast.table}` : ""}
          </span>
          <span className="mr-auto text-xs opacity-80">اضغط للفتح</span>
        </Link>
      )}
    </div>
  );
}
