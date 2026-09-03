"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChefHat, HandPlatter, Loader2 } from "lucide-react";
import { listPrepBoard, setPrepStatus, type PrepOrder } from "@/lib/cafe/queue-actions";
import { usePoll } from "@/lib/cafe/use-poll";

const AGE_WARN_MIN = 8;

function ageMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/**
 * The board that actually drives the pickup TV. Without it every order would sit
 * on «new» forever and the screen would show the whole day as "preparing".
 */
export function PrepBoardClient() {
  const [orders, setOrders] = useState<PrepOrder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOrders(await listPrepBoard());
      setErr(null);
    } catch {
      setErr("تعذّر تحديث اللوحة — تحقّق من الاتصال.");
    } finally {
      setLoaded(true);
    }
  }, []);

  usePoll(refresh, 15_000);

  // re-render so the ageing minutes stay honest without hitting the server
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  async function move(id: string, prep: "preparing" | "ready" | "handed") {
    if (busy) return;
    setBusy(id);
    setErr(null);
    // optimistic: the counter must feel instant, the poll reconciles anyway
    setOrders((prev) => (prep === "handed" ? prev.filter((o) => o.id !== id) : prev.map((o) => (o.id === id ? { ...o, prep } : o))));
    try {
      const res = await setPrepStatus(id, prep);
      if (!res.ok) {
        setErr(res.error);
        await refresh();
      }
    } catch {
      setErr("تعذّر تحديث الطلب — أعد المحاولة.");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const waiting = orders.filter((o) => o.prep !== "ready");
  const ready = orders.filter((o) => o.prep === "ready");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">لوحة التحضير</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ما تضغطه هنا يظهر فوراً على شاشة الاستلام في الصالة.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-4 py-2 text-sm font-bold">
          {waiting.length} تحت التحضير · {ready.length} جاهز
        </span>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {loaded && orders.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          لا توجد طلبات قيد التحضير الآن.
        </div>
      )}
      {!loaded && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => {
          const age = ageMinutes(o.created_at);
          const late = age >= AGE_WARN_MIN && o.prep !== "ready";
          return (
            <div
              key={o.id}
              className="flex flex-col rounded-2xl border bg-card p-4"
              style={o.prep === "ready" ? { borderColor: "#2ecc71" } : late ? { borderColor: "#e08a3c" } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-3xl font-black tabular-nums" style={{ color: o.prep === "ready" ? "#2ecc71" : undefined }}>
                    {o.code}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">تسلسل {String(o.seq).padStart(3, "0")}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {o.table_no && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">طاولة {o.table_no}</span>}
                  <span className="text-xs tabular-nums" style={{ color: late ? "#e08a3c" : undefined }}>
                    {age} د
                  </span>
                </div>
              </div>

              {o.items && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.items}</p>}

              <div className="mt-4 grid grid-cols-2 gap-2">
                {o.prep === "ready" ? (
                  <button
                    onClick={() => move(o.id, "handed")}
                    disabled={busy === o.id}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-60"
                  >
                    <HandPlatter className="size-4" /> سُلّم للزبون
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => move(o.id, "preparing")}
                      disabled={busy === o.id || o.prep === "preparing"}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-bold disabled:opacity-45"
                    >
                      <ChefHat className="size-4" /> بدأ التحضير
                    </button>
                    <button
                      onClick={() => move(o.id, "ready")}
                      disabled={busy === o.id}
                      className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                      style={{ background: "#2ecc71" }}
                    >
                      <Check className="size-4" /> جاهز
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
