"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listQueue, type ShowcaseItem } from "@/lib/cafe/queue-actions";
import { fitColumn, justWentReady, pageNow, pageSlice, slideNow, splitColumns, type QueueRow } from "@/lib/cafe/queue-display";

const POLL_MS = 15_000; // backup for a dead realtime socket
const ROTATE_S = 8; // a column page holds this long before rotating
const SLIDE_S = 7; // an idle slide holds this long

/* ————— café identity (the coffee palette used across the app) ————— */
const INK = "#f6ead9"; // cream
const ESPRESSO = "#1b1009";
const ESPRESSO_2 = "#120a05";
const CARAMEL = "#d18b4a";
const GOLD = "#e6a862";

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

function Logo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- signage screen; the menu uses plain <img> too
  return <img src="/logo.png" alt="بيزارا كافيه" width={size} height={size} style={{ height: size, width: "auto", objectFit: "contain" }} />;
}

/** One order card. «جاهز» is the loud one — it is an instruction to walk over. */
function Card({ row, font, label, ready }: { row: QueueRow; font: number; label: number; ready: boolean }) {
  return (
    <div
      className="relative flex h-full min-h-0 flex-col items-center justify-center rounded-3xl"
      style={{
        background: ready ? `linear-gradient(150deg, ${GOLD}, ${CARAMEL})` : "rgba(255,255,255,.045)",
        border: ready ? "none" : `2px solid ${CARAMEL}55`,
        color: ready ? ESPRESSO_2 : GOLD,
        boxShadow: ready ? `0 0 0 4px ${CARAMEL}33, 0 18px 40px -16px ${CARAMEL}aa` : "none",
        animation: ready ? "qIn .4s cubic-bezier(.22,1,.36,1) both, qPulse 2.6s ease-in-out infinite .4s" : "qIn .4s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      <span className="tabular-nums" style={{ fontSize: font, fontWeight: 900, lineHeight: 1, letterSpacing: 2 }}>
        {row.code}
      </span>
      {row.table_no && (
        <span
          className="absolute rounded-full px-2.5 py-0.5 font-bold"
          style={{
            top: 10,
            insetInlineEnd: 10,
            fontSize: Math.max(12, label - 6),
            background: ready ? "rgba(0,0,0,.18)" : `${CARAMEL}22`,
            color: ready ? ESPRESSO_2 : GOLD,
          }}
        >
          طاولة {row.table_no}
        </span>
      )}
    </div>
  );
}

function Column({
  title,
  rows,
  ready,
  availH,
  availW,
  now,
}: {
  title: string;
  rows: QueueRow[];
  ready: boolean;
  availH: number;
  availW: number;
  now: number;
}) {
  const extraCols = ready ? 1 : 0;
  const { tier, perPage, pages } = fitColumn(rows.length, availH, extraCols);
  const page = pageNow(rows.length, perPage, ROTATE_S, now);
  const visible = pageSlice(rows, perPage, page);
  const cols = Math.max(1, tier.cols + extraCols);
  const accent = ready ? GOLD : `${INK}99`;

  // The tier decides how many fit; the rows then SHARE the whole column height so
  // a near-empty board still fills the wall. Grow the digits with the real row
  // height (capped) — on a TV across a hall, bigger is the whole point.
  const rowsUsed = Math.max(1, Math.ceil(Math.max(visible.length, 1) / cols));
  const rowH = Math.max(1, (availH - 14 * (rowsUsed - 1)) / rowsUsed);
  const cardW = Math.max(1, (availW - 14 * (cols - 1)) / cols);
  // Cap by BOTH axes: sized on height alone, a 3-digit code overflowed its card
  // sideways and the two ready numbers ran into each other. ~2.1em holds 3 digits
  // plus the letter-spacing.
  const byHeight = rowH * 0.52;
  const byWidth = (cardW * 0.88) / 2.1;
  const font = Math.round(Math.max(28, Math.min(tier.font * 1.9, byHeight, byWidth)));

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-4 flex items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-3">
          <span
            className="block rounded-full"
            style={{ width: "clamp(9px,1vw,14px)", height: "clamp(9px,1vw,14px)", background: ready ? GOLD : `${CARAMEL}66`, boxShadow: ready ? `0 0 14px ${GOLD}` : "none" }}
          />
          <span style={{ color: accent, fontSize: "clamp(18px, 2.4vw, 34px)", fontWeight: 900 }}>{title}</span>
        </span>
        <span className="flex items-center gap-3">
          {pages > 1 && (
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: pages }).map((_, i) => (
                <span key={i} className="block rounded-full" style={{ width: 10, height: 10, background: i === page ? GOLD : `${INK}30` }} />
              ))}
            </span>
          )}
          <span className="tabular-nums" style={{ color: `${INK}55`, fontSize: "clamp(15px, 1.8vw, 26px)", fontWeight: 800 }}>
            {rows.length}
          </span>
        </span>
      </h2>

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
          gridTemplateRows: `repeat(${rowsUsed}, minmax(0,1fr))`,
          gap: 14,
        }}
      >
        {visible.map((r) => (
          <Card key={r.id} row={r} font={font} label={tier.label} ready={ready} />
        ))}
        {rows.length === 0 && (
          <div className="flex items-center justify-center rounded-3xl" style={{ border: `2px dashed ${INK}18`, color: `${INK}30`, fontSize: 28 }}>
            —
          </div>
        )}
      </div>
    </section>
  );
}

/** Welcome cards, shown AFTER the products — each over one of the café's photos. */
const MESSAGES: { big: string; small: string }[] = [
  { big: "أهلاً بكم", small: "نتمنى لكم وقتاً طيباً في بيزارا كافيه" },
  { big: "اطلب من طاولتك", small: "قرّب هاتفك من الشعار الموجود على طاولتك" },
  { big: "بيزارا كافيه", small: "الرمادي — شارع المستودع" },
];

type Slide =
  | { kind: "product"; item: ShowcaseItem }
  | { kind: "message"; big: string; small: string; image: string };

function buildSlides(items: ShowcaseItem[]): Slide[] {
  const products: Slide[] = items.map((item) => ({ kind: "product", item }));
  // Messages come after the products and borrow a photo each, spread across the
  // catalogue so the same picture is not reused back to back.
  const messages: Slide[] = MESSAGES.map((m, i) => ({
    kind: "message",
    ...m,
    image: items.length ? items[Math.floor((i * items.length) / MESSAGES.length)].image : "",
  }));
  return [...products, ...messages];
}

/** Idle: the café's own products one at a time, then the welcome cards. */
function Idle({ items, now }: { items: ShowcaseItem[]; now: number }) {
  const slides = buildSlides(items);
  const idx = slideNow(Math.max(slides.length, 1), SLIDE_S, now);
  const slide = slides[idx];

  // Preload ONLY the next picture. Rendering them all at opacity 0 would pull
  // megabytes over shop wifi on a page that rebuilds itself, and then nothing
  // finishes loading at all.
  useEffect(() => {
    const next = slides[(idx + 1) % Math.max(slides.length, 1)];
    const src = next ? (next.kind === "product" ? next.item.image : next.image) : "";
    if (!src) return;
    const img = new Image();
    img.src = src;
  }, [idx, slides]);

  if (!slide) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Logo size={230} />
        <div className="mt-8 font-black leading-tight" style={{ fontSize: "clamp(3rem,8vw,6rem)", color: INK }}>
          أهلاً بكم
        </div>
      </div>
    );
  }

  const src = slide.kind === "product" ? slide.item.image : slide.image;
  const message = slide.kind === "message";

  return (
    <div key={`${idx}-${src}`} className="relative flex-1 overflow-hidden" style={{ animation: "slideIn .9s ease both" }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- signage screen
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          // The café's product photos are shot dark on dark; straight out of the
          // bucket they read as a muddy brown wall from across the room.
          style={{
            animation: "kenBurns 8s ease-out both",
            filter: "brightness(1.85) contrast(1.06) saturate(1.12)",
            // The café's photos put the product LOW in the frame, so a centred
            // cover crop shows empty background and cuts the drink off.
            objectPosition: "50% 72%",
          }}
        />
      )}

      {message ? (
        <>
          {/* a message must stay readable, so its photo sits further back */}
          <div className="absolute inset-0" style={{ background: `${ESPRESSO_2}a6` }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center" style={{ animation: "riseIn .9s .2s ease both" }}>
            <Logo size={180} />
            <div className="mt-7 font-black leading-tight" style={{ fontSize: "clamp(3rem,8vw,6rem)", color: INK, textShadow: "0 4px 30px rgba(0,0,0,.6)" }}>
              {slide.big}
            </div>
            <div className="mt-3" style={{ fontSize: "clamp(1.2rem,2.4vw,2rem)", color: `${INK}cc`, textShadow: "0 2px 18px rgba(0,0,0,.6)" }}>
              {slide.small}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* A lower-third bar instead of a full-frame scrim: the photo stays bright
              all the way up, and the caption is legible over a white cup or a dark
              one alike — a gradient tuned for one product fails on the next. */}
          <div
            className="absolute inset-x-0 bottom-0 px-10 pb-9 pt-24 text-center"
            style={{
              background: `linear-gradient(to top, ${ESPRESSO_2} 0%, ${ESPRESSO_2}f2 42%, ${ESPRESSO_2}c0 68%, transparent 100%)`,
              animation: "riseIn .9s .25s ease both",
            }}
          >
            <div style={{ color: GOLD, fontSize: "clamp(1rem,1.8vw,1.5rem)", fontWeight: 800, letterSpacing: 2, textShadow: "0 2px 10px rgba(0,0,0,.95), 0 0 26px rgba(0,0,0,.8)" }}>
              {slide.item.category}
            </div>
            <div className="mt-2 font-black leading-tight" style={{ fontSize: "clamp(2.6rem,6.5vw,5rem)", color: INK, textShadow: "0 3px 12px rgba(0,0,0,.95), 0 0 40px rgba(0,0,0,.75)" }}>
              {slide.item.name}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function QueueDisplayClient({ initialRows, showcase }: { initialRows: QueueRow[]; showcase: ShowcaseItem[] }) {
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [now, setNow] = useState<number>(() => Date.now());
  const [availH, setAvailH] = useState(420);
  const [availW, setAvailW] = useState(900);
  const [stacked, setStacked] = useState(false);
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

  // 3) the clock that drives every rotation — local only, never a server call
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // measure the REAL space; arithmetic on paper said 390 where a real TV reports 220
  useLayoutEffect(() => {
    const el = gaugeRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // A portrait or narrow screen (a vertical signage panel, a tablet, a phone)
      // cannot hold two columns side by side — stack them instead of squeezing.
      const stack = r.width < 820 || r.width / Math.max(r.height, 1) < 1.15;
      setStacked(stack);
      setAvailH(Math.max(90, Math.floor(stack ? (r.height - 56) / 2 : r.height)));
      setAvailW(Math.max(120, Math.floor(stack ? r.width : (r.width - 32 - 1) / 2)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const logoSize = stacked ? 44 : 64;
  const { preparing, ready } = splitColumns(rows);
  const idle = rows.length === 0;

  return (
    <main
      dir="rtl"
      className="relative flex h-dvh flex-col overflow-hidden"
      style={{ background: `radial-gradient(120% 90% at 50% -10%, ${ESPRESSO}, ${ESPRESSO_2} 70%)`, color: INK }}
    >
      <style>{`
        @keyframes qIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes qPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.022); } }
        @keyframes slideIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes riseIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes kenBurns { from { transform: scale(1.03); } to { transform: scale(1.12); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      <header className="flex flex-none items-center justify-between px-6 pb-2 pt-4 sm:px-10 sm:pb-3 sm:pt-6">
        <div className="tabular-nums" style={{ color: `${INK}55`, fontSize: "clamp(15px,1.8vw,26px)", fontWeight: 800 }}>
          {new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        <Logo size={logoSize} />
      </header>

      {idle ? (
        <Idle items={showcase} now={now} />
      ) : (
        <div className={`flex min-h-0 flex-1 px-6 pb-6 sm:px-10 sm:pb-10 ${stacked ? "flex-col gap-5" : "gap-8"}`}>
          {/* RTL: «تحت التحضير» is read first (right); «جاهز» sits left and shouts.
              Stacked, «جاهز» goes on TOP for the same reason. */}
          {stacked ? (
            <>
              <Column title="جاهز للاستلام" rows={ready} ready availH={availH} availW={availW} now={now} />
              <div className="h-px flex-none" style={{ background: `${CARAMEL}33` }} />
              <Column title="تحت التحضير" rows={preparing} ready={false} availH={availH} availW={availW} now={now} />
            </>
          ) : (
            <>
              <Column title="تحت التحضير" rows={preparing} ready={false} availH={availH} availW={availW} now={now} />
              <div className="w-px flex-none self-stretch" style={{ background: `${CARAMEL}33` }} />
              <Column title="جاهز للاستلام" rows={ready} ready availH={availH} availW={availW} now={now} />
            </>
          )}
        </div>
      )}

      {/* EMPTY on purpose: what is measured must not depend on what goes inside it,
          or measuring would change the very layout being measured. */}
      <div ref={gaugeRef} aria-hidden className="pointer-events-none absolute inset-x-6 sm:inset-x-10" style={{ top: 96, bottom: 28, visibility: "hidden" }} />
    </main>
  );
}
