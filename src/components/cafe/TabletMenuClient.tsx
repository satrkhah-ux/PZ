"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Check, LogIn, Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { MenuCategoryView, MenuItemView } from "@/lib/cafe/menu-data";
import { formatIqdLabel } from "@/lib/cafe/money";
import { submitOrder, type OrderLineInput } from "@/lib/cafe/order-actions";
import { useCart } from "./use-cart";
import { MenuIcon } from "./MenuIcon";
import { PizzaraMark } from "./Logo";

/** Primary customer menu — full-screen: category rail on the RIGHT, product grid
 *  on the LEFT, cart + checkout, table number, size picker + hot-drink pastry
 *  cross-sell. Coffee palette. */

// coffee palette (adopted as the standard look)
const VARS: Record<string, string> = {
  "--accent": "#d18b4a", "--accent2": "#e6a862", "--panel": "#2a1a10", "--panelsoft": "#241610",
  "--text": "#f3e3cf", "--muted": "#c9b299", "--line": "rgba(209,139,74,0.16)", "--active": "#f3e3cf", "--activeink": "#2b1a10",
};
const GRAD = "radial-gradient(1100px 700px at 88% -8%, rgba(209,139,74,0.14), transparent 55%), linear-gradient(160deg, #1d120b, #120a05)";

/** menu image → CDN path; returns both the light -sm variant and the full one
 *  (admin-uploaded images have no -sm, so we fall back to full then to an icon). */
function imgSrcs(url: string | null): { sm: string; full: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/menu\/(.+)$/);
  const full = m ? `/img/${m[1]}` : url;
  return { sm: full.replace(/\.webp(\?|$)/, "-sm.webp$1"), full };
}
function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const full = img.dataset.full;
  if (full && img.src !== full) img.src = full; // -sm missing → try full
  else img.style.display = "none"; // full missing too → show the icon behind
}

type Effect = "hot" | "cold" | "pastry";
function effectFor(cat: string): Effect {
  if (cat.includes("الساخنة")) return "hot";
  if (cat.includes("معجنات")) return "pastry";
  return "cold";
}
const DROPS = [
  { left: "24%", top: "16%", size: 5, dur: "2.4s", delay: "0s" },
  { left: "62%", top: "12%", size: 4, dur: "3s", delay: "0.6s" },
  { left: "78%", top: "30%", size: 6, dur: "2.6s", delay: "1.1s" },
  { left: "40%", top: "26%", size: 4, dur: "3.2s", delay: "0.3s" },
  { left: "54%", top: "42%", size: 5, dur: "2.8s", delay: "1.5s" },
];

export function TabletMenuClient({
  menu,
  table = null,
  channel = "qr",
  offers = {},
}: {
  menu: MenuCategoryView[];
  table?: string | null;
  channel?: "qr" | "kiosk";
  /** item_id → today's offer price (0 = مجاناً) set by management */
  offers?: Record<string, number>;
}) {
  const [activeCat, setActiveCat] = useState(menu[0]?.name_ar ?? "");
  const mainRef = useRef<HTMLElement>(null);
  const { lines, total, count, dispatch } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // product modal (size + cross-sell)
  const [modalItem, setModalItem] = useState<MenuItemView | null>(null);
  const [modalVariant, setModalVariant] = useState<string | null>(null);
  const [crossSel, setCrossSel] = useState<Set<string>>(new Set()); // selected cross-sell pastries

  const cat = menu.find((c) => c.name_ar === activeCat) ?? menu[0];
  const effect = effectFor(cat?.name_ar ?? "");
  const pastries = menu.find((c) => c.name_ar.includes("معجنات"))?.items ?? [];

  function selectCat(name: string) {
    setActiveCat(name);
    mainRef.current?.scrollTo({ top: 0 });
  }
  function add(it: MenuItemView, variantId: string | null, unitPrice: number) {
    const v = it.variants.find((x) => x.id === variantId);
    const key = `${it.id}|${variantId ?? ""}`;
    const name = it.name_ar + (v ? ` — ${v.name_ar}` : "");
    dispatch({ type: "add", line: { key, itemId: it.id, name, variantId, flavor: null, unitPrice } });
  }
  const priceOf = (it: MenuItemView) => offers[it.id] ?? it.price; // apply today's offer if any
  function toggleCross(id: string) {
    setCrossSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function onPlus(it: MenuItemView) {
    // size choice OR hot-drink cross-sell → open the modal; otherwise add straight
    if (it.variants.length > 0 || effect === "hot") {
      setModalItem(it);
      setModalVariant(it.variants[0]?.id ?? null);
      setCrossSel(new Set());
    } else {
      add(it, null, it.price);
    }
  }
  const modalPrice = modalItem ? (modalItem.variants.find((v) => v.id === modalVariant)?.price ?? modalItem.price) : 0;
  const crossTotal = [...crossSel].reduce((s, id) => {
    const p = pastries.find((x) => x.id === id);
    return s + (p ? priceOf(p) : 0);
  }, 0);
  const grandTotal = modalPrice + crossTotal;

  async function checkout() {
    if (!lines.length || busy) return;
    setBusy(true);
    setErr(null);
    const payload: OrderLineInput[] = lines.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, flavor: l.flavor, qty: l.qty }));
    const res = await submitOrder({ channel, table: table ?? null, lines: payload, name: null, phone: phone.trim() || null, note: note.trim() || null });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    dispatch({ type: "clear" });
    setNote("");
    setPhone("");
    setCartOpen(false);
    setConfirmed(res.orderNumber);
  }

  return (
    <div dir="rtl" style={{ ...(VARS as CSSProperties), background: GRAD }} className="flex h-dvh flex-col text-[var(--text)]">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <PizzaraMark className="size-9 shrink-0" />
          <span className="text-lg font-extrabold text-[var(--accent)]">بيزارا كافيه</span>
        </div>
        {table ? (
          <span className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-1.5 text-sm font-extrabold text-[var(--accent)]">
            🍽️ طاولة {table}
          </span>
        ) : (
          <h1 className="text-base font-bold text-[var(--muted)]">المنيو</h1>
        )}
        <Link
          href="/sign-in"
          aria-label="دخول الموظفين"
          title="دخول الموظفين"
          className="flex size-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--accent)] transition hover:bg-[var(--panel)]"
        >
          <LogIn className="size-5" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-row-reverse">
        {/* product grid — LEFT */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4 pb-24">
          <h2 className="mb-3 px-1 text-xl font-extrabold text-[var(--accent)]">{cat?.name_ar}</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {(cat?.items ?? []).map((it) => {
              const s = imgSrcs(it.image_url);
              return (
                <article key={it.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panelsoft)]">
                  <div className="relative aspect-[4/5] bg-[var(--panel)]" style={effect === "pastry" ? { animation: "pz-float 4s ease-in-out infinite" } : undefined}>
                    <MenuIcon name={it.name_ar} category={cat?.name_ar} className="absolute inset-0 m-auto size-16 text-[var(--accent)] opacity-45" />
                    {s && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.sm} data-full={s.full} alt={it.name_ar} loading="lazy" onError={onImgError} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {effect === "hot" && (
                      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[20%] -translate-x-1/2">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="absolute block h-14 w-2 rounded-full bg-white/55 blur-[5px]" style={{ left: `${(i - 1) * 12}px`, animation: `pz-steam 2.8s ease-out ${i * 0.9}s infinite` }} />
                        ))}
                      </div>
                    )}
                    {effect === "cold" && (
                      <>
                        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 60% at 50% 35%, rgba(170,215,255,0.38), transparent 60%)", animation: "pz-frost 5s ease-in-out infinite" }} />
                        {DROPS.map((d, i) => (
                          <span key={i} aria-hidden className="pointer-events-none absolute rounded-full bg-sky-100/90" style={{ left: d.left, top: d.top, width: d.size, height: d.size * 1.4, filter: "blur(0.5px)", animation: `pz-drip ${d.dur} linear ${d.delay} infinite` }} />
                        ))}
                      </>
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-right">
                    <p className="line-clamp-2 min-h-[2.5em] text-[15px] font-bold leading-tight">{it.name_ar}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <button onClick={() => onPlus(it)} aria-label="أضف للسلة" className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--activeink)] transition active:scale-90">
                        <Plus className="size-5" />
                      </button>
                      <p className="text-base font-extrabold tabular-nums text-[var(--accent)]">{formatIqdLabel(it.price)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </main>

        {/* category rail — RIGHT */}
        <aside className="w-[132px] shrink-0 overflow-y-auto border-l border-[var(--line)] bg-[var(--panelsoft)]/60 py-2 sm:w-[184px]">
          {menu.map((c) => {
            const on = c.name_ar === activeCat;
            return (
              <button key={c.name_ar} onClick={() => selectCat(c.name_ar)} className={`flex w-full flex-col items-center gap-1.5 px-2 py-3.5 text-center transition ${on ? "bg-[var(--active)] text-[var(--activeink)]" : "text-[var(--muted)] hover:bg-[var(--panel)]"}`}>
                <MenuIcon name={c.name_ar} category={c.name_ar} className={`size-8 ${on ? "text-[var(--activeink)]" : "text-[var(--accent)]"}`} />
                <span className="text-[13px] font-bold leading-tight">
                  {c.name_ar.split(" ").map((w, i) => (
                    <span key={i} className="block">{w}</span>
                  ))}
                </span>
              </button>
            );
          })}
        </aside>
      </div>

      {/* cart bar */}
      {count > 0 && !cartOpen && !confirmed && !modalItem && (
        <button onClick={() => setCartOpen(true)} className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-5xl items-center justify-between gap-3 bg-[var(--accent)] px-5 py-4 font-extrabold text-[var(--activeink)] shadow-lg">
          <span className="flex items-center gap-2"><ShoppingCart className="size-5" /> عرض السلة ({count})</span>
          <span className="tabular-nums">{formatIqdLabel(total)}</span>
        </button>
      )}

      {/* product modal — size + cross-sell */}
      {modalItem && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setModalItem(null)}>
          <div style={{ ...(VARS as CSSProperties) }} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--panelsoft)] p-5 text-[var(--text)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{modalItem.name_ar}</h2>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-sm font-bold text-[var(--accent)]">
                    <ShoppingCart className="size-4" /> {count}
                  </span>
                )}
                <button onClick={() => setModalItem(null)} aria-label="إغلاق" className="rounded-full border border-[var(--line)] p-1.5"><X className="size-5" /></button>
              </div>
            </div>

            {modalItem.variants.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-bold text-[var(--muted)]">اختر الحجم</h3>
                <div className="flex flex-wrap gap-2">
                  {modalItem.variants.map((v) => (
                    <button key={v.id} onClick={() => setModalVariant(v.id)} className={`rounded-xl border px-4 py-2.5 font-bold transition ${modalVariant === v.id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--activeink)]" : "border-[var(--line)]"}`}>
                      {v.name_ar} · <span className="tabular-nums">{formatIqdLabel(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {effect === "hot" && pastries.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-bold text-[var(--accent)]">🥐 يناسبها مع… (اختياري)</h3>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pastries.map((p) => {
                    const ps = imgSrcs(p.image_url);
                    return (
                      <div key={p.id} className="w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                        <div className="relative aspect-square">
                          <MenuIcon name={p.name_ar} className="absolute inset-0 m-auto size-9 text-[var(--accent)] opacity-45" />
                          {ps && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ps.sm} data-full={ps.full} alt={p.name_ar} loading="lazy" onError={onImgError} className="absolute inset-0 h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="p-1.5 text-right">
                          <p className="truncate text-[11px] font-bold">{p.name_ar}</p>
                          <div className="mt-0.5 flex items-center justify-between">
                            <button onClick={() => toggleCross(p.id)} aria-label="أضف" className={`flex size-7 items-center justify-center rounded-full transition active:scale-90 ${crossSel.has(p.id) ? "bg-emerald-500 text-white" : "bg-[var(--accent)] text-[var(--activeink)]"}`}>
                              {crossSel.has(p.id) ? <Check className="size-4" /> : <Plus className="size-4" />}
                            </button>
                            {offers[p.id] !== undefined ? (
                              <span className="text-[11px] font-bold tabular-nums">
                                <s className="text-[var(--muted)]">{formatIqdLabel(p.price)}</s>{" "}
                                <b className="text-emerald-400">{offers[p.id] === 0 ? "مجاناً" : formatIqdLabel(offers[p.id])}</b>
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold tabular-nums text-[var(--accent)]">{formatIqdLabel(p.price)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  الإضافات المختارة: <b className="tabular-nums text-[var(--accent)]">{formatIqdLabel(crossTotal)}</b>
                </p>
              </div>
            )}

            <button
              onClick={() => {
                add(modalItem, modalVariant, modalPrice);
                crossSel.forEach((id) => {
                  const p = pastries.find((x) => x.id === id);
                  if (p) add(p, null, priceOf(p));
                });
                setModalItem(null);
                setCrossSel(new Set());
              }}
              className="w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-extrabold text-[var(--activeink)] transition active:scale-[0.99]"
            >
              أضف للسلة · {formatIqdLabel(grandTotal)}
            </button>
          </div>
        </div>
      )}

      {/* cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <div style={{ ...(VARS as CSSProperties) }} className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-[var(--panelsoft)] p-5 text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[var(--accent)]">سلة الطلب {table ? `· طاولة ${table}` : ""}</h2>
              <button onClick={() => setCartOpen(false)} aria-label="إغلاق" className="rounded-full border border-[var(--line)] p-1.5"><X className="size-5" /></button>
            </div>
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{l.name}</p>
                    <p className="text-sm tabular-nums text-[var(--accent)]">{formatIqdLabel(l.unitPrice * l.qty)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => dispatch({ type: "dec", key: l.key })} aria-label="إنقاص" className="rounded-full border border-[var(--line)] p-1.5"><Minus className="size-4" /></button>
                    <span className="w-6 text-center font-bold tabular-nums">{l.qty}</span>
                    <button onClick={() => dispatch({ type: "inc", key: l.key })} aria-label="زيادة" className="rounded-full border border-[var(--line)] p-1.5"><Plus className="size-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="رقم الهاتف (اختياري — لجمع نقاط الولاء)" dir="ltr" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm outline-none" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (سكر قليل، بدون ثلج…)" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm outline-none" />
            </div>
            {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
              <span className="text-[var(--muted)]">الإجمالي</span>
              <span className="text-xl font-extrabold tabular-nums text-[var(--accent)]">{formatIqdLabel(total)}</span>
            </div>
            <button onClick={checkout} disabled={busy} className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-extrabold text-[var(--activeink)] transition active:scale-[0.99] disabled:opacity-60">
              {busy ? "جارٍ الإرسال…" : "إتمام الطلب"}
            </button>
          </div>
        </div>
      )}

      {/* confirmation */}
      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setConfirmed(null)}>
          <div style={{ ...(VARS as CSSProperties) }} className="w-full max-w-sm rounded-3xl bg-[var(--panelsoft)] p-8 text-center text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--accent)]"><Check className="size-10 text-[var(--activeink)]" /></div>
            <h2 className="mt-4 text-2xl font-extrabold">تم إرسال طلبك ✓</h2>
            <p className="mt-2 text-[var(--muted)]">رقم الطلب</p>
            <p className="text-4xl font-extrabold text-[var(--accent)]">{confirmed}</p>
            {table && <p className="mt-2 text-sm text-[var(--muted)]">طاولة {table} — سيصلك طلبك قريباً</p>}
            <button onClick={() => setConfirmed(null)} className="mt-5 w-full rounded-2xl border border-[var(--accent)] py-3 font-bold text-[var(--accent)]">طلب آخر</button>
          </div>
        </div>
      )}
    </div>
  );
}
