"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, ChefHat, HandPlatter, Loader2 } from "lucide-react";
import { getPrepDaySummary, listPrepBoard, setPrepStatus, type PrepDaySummary, type PrepOrder } from "@/lib/cafe/queue-actions";
import { usePoll } from "@/lib/cafe/use-poll";

const AGE_WARN_MIN = 8;

function Tally({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="rounded-xl bg-secondary px-3 py-1.5 text-sm">
      {label} <b className="tabular-nums" style={tone ? { color: tone } : undefined}>{value}</b>
    </span>
  );
}

function ageMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/**
 * The board that actually drives the pickup TV. Without it every order would sit
 * on «new» forever and the screen would show the whole day as "preparing".
 */
export function PrepBoardClient() {
  const [orders, setOrders] = useState<PrepOrder[]>([]);
  const [day, setDay] = useState<PrepDaySummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // one poll for both: the board shows only open orders, the tally covers the whole day
      const [board, summary] = await Promise.all([listPrepBoard(), getPrepDaySummary()]);
      setOrders(board);
      setDay(summary);
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

  /** «جهّز الكل» / «سلّم الكل» — one tap at the end of a rush instead of a dozen.
   *  Confirmed first: both change the hall screen for every waiting customer at
   *  once, and «سلّم» clears the board with no undo. */
  async function moveAll(targets: PrepOrder[], prep: "ready" | "handed", question: string) {
    if (busy || !targets.length) return;
    if (!window.confirm(question)) return;
    const ids = targets.map((o) => o.id);
    setBusy("__all__");
    setErr(null);
    setOrders((prev) =>
      prep === "handed"
        ? prev.filter((o) => !ids.includes(o.id))
        : prev.map((o) => (ids.includes(o.id) ? { ...o, prep } : o)),
    );
    try {
      const res = await setPrepStatus(ids, prep);
      if (!res.ok) setErr(res.error);
    } catch {
      setErr("تعذّر تحديث الطلبات — أعد المحاولة.");
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const readyAll = () =>
    moveAll(waiting, "ready", `تجهيز ${waiting.length} طلباً؟ ستظهر كلها «جاهزة» على شاشة الاستلام.`);

  const handAll = () => {
    const notReady = orders.length - ready.length;
    const warn = notReady > 0 ? `\n\nتنبيه: ${notReady} منها لم تُعلَّم جاهزة بعد.` : "";
    moveAll(orders, "handed", `تسليم ${orders.length} طلباً وإخلاء اللوحة؟${warn}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">لوحة التحضير</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ما تضغطه هنا يظهر فوراً على شاشة الاستلام في الصالة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {waiting.length > 0 && (
            <button
              onClick={readyAll}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#2ecc71" }}
            >
              {busy === "__all__" ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              تجهيز الكل ({waiting.length})
            </button>
          )}
          {orders.length > 0 && (
            <button
              onClick={handAll}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy === "__all__" ? <Loader2 className="size-4 animate-spin" /> : <HandPlatter className="size-4" />}
              تسليم الكل ({orders.length})
            </button>
          )}
          <span className="rounded-full bg-secondary px-4 py-2 text-sm font-bold">
            {waiting.length} تحت التحضير · {ready.length} جاهز
          </span>
        </div>
      </div>

      {/* ملخص اليوم — the board hides handed orders, so without this the station
          has no idea how much it has made today. Counts only, no money. */}
      {day && day.total > 0 && (
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="me-1 text-sm font-bold text-muted-foreground">ملخص اليوم</h2>
            <Tally label="طلبات اليوم" value={day.total} />
            <Tally label="أصناف محضّرة" value={day.units} />
            <Tally label="جاهزة" value={day.ready} tone="#2ecc71" />
            <Tally label="سُلّمت" value={day.handed} />
            <Tally label="على اللوحة" value={day.open} tone={day.open > 0 ? "#e08a3c" : undefined} />
          </div>
          {day.topItems.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold">الأكثر تحضيراً:</span>
              {day.topItems.map((it) => (
                <span key={it.name}>
                  {it.name} <b className="tabular-nums text-foreground">×{it.qty}</b>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

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
