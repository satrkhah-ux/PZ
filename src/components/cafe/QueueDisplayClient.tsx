"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listQueue } from "@/lib/cafe/queue-actions";
import { fitColumn, justWentReady, pageNow, pageSlice, splitColumns, type QueueRow } from "@/lib/cafe/queue-display";

const POLL_MS = 15_000; // backup for a dead realtime socket
const ROTATE_S = 8; // seconds a column page stays before rotating
const IDLE_ROTATE_S = 10;

const IDLE_SLIDES = [
  { big: "بيزارا كافيه", small: "الرمادي — شارع المستودع" },
  { big: "اطلب من طاولتك", small: "امسح رمز QR الموجود على الطاولة" },
  { big: "أهلاً بكم", small: "نتمنى لكم وقتاً طيباً" },
];

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = (freq: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.5);
    };
    play(880, 0);
    play(1174, 0.18);
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // a TV may block audio until an interaction — the screen still works silently
  }
}

function Column({
  title,
  rows,
  accent,
  availH,
  extraCols,
  now,
}: {
  title: string;
  rows: QueueRow[];
  accent: string;
  availH: number;
  extraCols: number;
  now: number;
}) {
  const { tier, perPage, pages } = fitColumn(rows.length, availH, extraCols);
  const page = pageNow(rows.length, perPage, ROTATE_S, now);
  const visible = pageSlice(rows, perPage, page);
  const cols = Math.max(1, tier.cols + extraCols);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-3 flex items-center justify-between px-1" style={{ fontSize: tier.label + 6 }}>
        <span className="font-black" style={{ color: accent }}>
          {title}
        </span>
        <span className="flex items-center gap-3">
          {pages > 1 && (
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: pages }).map((_, i) => (
                <span key={i} className="block rounded-full" style={{ width: 10, height: 10, background: i === page ? accent : "rgba(255,255,255,.22)" }} />
              ))}
            </span>
          )}
          <span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,.45)", fontSize: Math.max(12, tier.label - 4) }}>
            {rows.length}
          </span>
        </span>
      </h2>

      <div className="grid min-h-0 flex-1 content-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>
        {visible.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-center rounded-2xl"
            style={{
              height: tier.cardH,
              background: accent,
              color: "#0b0b0d",
              fontSize: tier.font,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 1,
              animation: "qIn .35s cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <span className="tabular-nums">{r.code}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div
            className="flex items-center justify-center rounded-2xl border-2 border-dashed"
            style={{ height: tier.cardH, borderColor: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.3)", fontSize: tier.label }}
          >
            —
          </div>
        )}
      </div>
    </section>
  );
}

export function QueueDisplayClient({ initialRows }: { initialRows: QueueRow[] }) {
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [now, setNow] = useState<number>(() => Date.now());
  const [availH, setAvailH] = useState(420);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const prevReady = useRef<string[]>(initialRows.filter((r) => r.prep_status === "ready").map((r) => r.id));

  const refresh = useCallback(async () => {
    try {
      const next = await listQueue();
      setRows(next);
      const readyIds = next.filter((r) => r.prep_status === "ready").map((r) => r.id);
      if (justWentReady(prevReady.current, readyIds)) chime();
      prevReady.current = readyIds;
    } catch {
      // keep the last good board rather than an error page nobody is there to dismiss
    }
  }, []);

  // 1) instant: realtime push
  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null;
    try {
      const supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel("queue-tv")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
        .subscribe();
    } catch {
      // demo mode / no env — the poll below still covers it
    }
    return () => {
      try {
        channel?.unsubscribe();
      } catch {
        // noop
      }
    };
  }, [refresh]);

  // 2) backup: polling, covers a dropped socket
  useEffect(() => {
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  // 3) the clock that drives rotation — local only, never a server call
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // measure the REAL space; arithmetic on paper said 390 where a real TV reports 220
  useLayoutEffect(() => {
    const el = gaugeRef.current;
    if (!el) return;
    const measure = () => setAvailH(Math.max(90, Math.floor(el.getBoundingClientRect().height)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { preparing, ready } = splitColumns(rows);
  const idle = rows.length === 0;
  const slide = IDLE_SLIDES[Math.floor(now / (IDLE_ROTATE_S * 1000)) % IDLE_SLIDES.length];

  return (
    <main dir="rtl" className="relative flex h-dvh flex-col overflow-hidden" style={{ background: "#0b0b0d", color: "#f4f1ea" }}>
      <style>{`
        @keyframes qIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      <header className="flex flex-none items-center justify-between px-8 pb-3 pt-6">
        <div className="text-3xl font-black tracking-[3px]" dir="ltr">
          PIZZARA CAFE
        </div>
        <div className="text-xl font-bold tabular-nums" style={{ color: "rgba(244,241,234,.55)" }}>
          {new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
      </header>

      {idle ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="text-[clamp(3rem,9vw,7rem)] font-black leading-tight">{slide.big}</div>
          <div className="mt-4 text-[clamp(1.1rem,2.4vw,2rem)]" style={{ color: "rgba(244,241,234,.55)" }}>
            {slide.small}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6 px-8 pb-8">
          {/* RTL: «تحت التحضير» is read first (right); «جاهز» sits left */}
          <Column title="تحت التحضير" rows={preparing} accent="#c9a24b" availH={availH} extraCols={0} now={now} />
          <div className="w-px flex-none self-stretch" style={{ background: "rgba(255,255,255,.1)" }} />
          <Column title="جاهز للاستلام" rows={ready} accent="#2ecc71" availH={availH} extraCols={1} now={now} />
        </div>
      )}

      {/* EMPTY on purpose: what is measured must not depend on what goes inside it,
          or measuring would change the very layout being measured. */}
      <div ref={gaugeRef} aria-hidden className="pointer-events-none absolute inset-x-8" style={{ top: 92, bottom: 32, visibility: "hidden" }} />
    </main>
  );
}
