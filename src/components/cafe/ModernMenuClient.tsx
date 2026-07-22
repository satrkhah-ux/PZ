"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { MenuCategoryView, MenuItemView } from "@/lib/cafe/menu-data";
import { formatIqdLabel } from "@/lib/cafe/money";
import { submitOrder, type OrderLineInput } from "@/lib/cafe/order-actions";
import { useCart, type CartLine } from "./use-cart";
import { PizzaraMark } from "./Logo";

/** المنيو التفاعلي — image-led immersive menu: steam over hot drinks, frost and
 *  falling droplets over iced ones, floating pastries. Prices live from the DB. */

type EffectKind = "hot" | "cold" | "pastry";
function effectFor(categoryName: string): EffectKind {
  if (categoryName.includes("الساخنة")) return "hot";
  if (categoryName.includes("معجنات")) return "pastry";
  return "cold";
}

const DROPS = [
  { left: "20%", top: "42%", delay: "0s", size: 5, dur: "4.2s" },
  { left: "30%", top: "55%", delay: "1.4s", size: 4, dur: "5.1s" },
  { left: "44%", top: "48%", delay: "2.6s", size: 6, dur: "4.6s" },
  { left: "58%", top: "60%", delay: "0.8s", size: 4, dur: "5.6s" },
  { left: "70%", top: "45%", delay: "1.9s", size: 5, dur: "4.4s" },
  { left: "78%", top: "56%", delay: "3.1s", size: 4, dur: "5s" },
];

export function ModernMenuClient({
  menu,
  table,
  demo,
  preview = false,
}: {
  menu: MenuCategoryView[];
  table?: string | null;
  demo: boolean;
  preview?: boolean;
}) {
  const [activeCat, setActiveCat] = useState(menu[0]?.name_ar ?? "");
  const { lines, total, count, dispatch } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cat = menu.find((c) => c.name_ar === activeCat) ?? menu[0];
  const effect = cat ? effectFor(cat.name_ar) : "hot";

  async function onSubmit() {
    if (!lines.length || busy) return;
    setBusy(true);
    setErr(null);
    const payload: OrderLineInput[] = lines.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, flavor: l.flavor, qty: l.qty }));
    const res = await submitOrder({ channel: "qr", table: table ?? null, lines: payload });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    dispatch({ type: "clear" });
    setCartOpen(false);
    setConfirmed(res.orderNumber);
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-[#180f09] text-[#f3e3cf]">
      <div className="mx-auto max-w-5xl">
        {/* header */}
        <header className="sticky top-0 z-20 border-b border-[#d18b4a]/20 bg-[#180f09]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PizzaraMark className="size-11 shrink-0" />
              <div>
                <h1 className="text-xl font-extrabold text-[#d18b4a]">بيزارا كافيه</h1>
                <p className="text-xs text-[#f3e3cf]/60">
                  المنيو التفاعلي{table ? ` · طاولة ${table}` : ""}
                  {demo ? " · تجريبي" : ""}
                  {preview ? " · 🧪 معاينة الصور الجديدة" : ""}
                </p>
              </div>
            </div>
            <Link
              href={`/menu${table ? `?t=${table}` : ""}`}
              className="rounded-full border border-[#d18b4a]/40 px-3 py-1.5 text-xs font-semibold text-[#d18b4a] transition hover:bg-[#d18b4a]/10"
            >
              المنيو الكلاسيكي
            </Link>
          </div>
          {/* categories */}
          <nav className="mt-3 -mb-1 flex gap-2 overflow-x-auto pb-1">
            {menu.map((c) => (
              <button
                key={c.name_ar}
                onClick={() => setActiveCat(c.name_ar)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  c.name_ar === cat?.name_ar
                    ? "bg-[#d18b4a] text-[#2b1a10]"
                    : "border border-[#d18b4a]/30 text-[#f3e3cf]/80 hover:bg-[#d18b4a]/10"
                }`}
              >
                {c.name_ar}
              </button>
            ))}
          </nav>
        </header>

        {/* cards */}
        <main key={cat?.name_ar} className="grid grid-cols-2 gap-4 px-4 py-5 pb-32 lg:grid-cols-3">
          {cat?.items.map((it, i) => (
            <ModernCard key={it.id} item={it} effect={effect} index={i} onAdd={(line) => dispatch({ type: "add", line })} />
          ))}
        </main>
      </div>

      {/* cart bar */}
      {count > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-5xl items-center justify-between gap-3 bg-[#d18b4a] px-5 py-4 font-bold text-[#2b1a10] shadow-lg"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            {count} صنف
          </span>
          <span>عرض السلة · {formatIqdLabel(total)}</span>
        </button>
      )}

      {/* cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <div
            className="mx-auto max-h-[85dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border-t border-[#d18b4a]/30 bg-[#221409] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#d18b4a]">سلة الطلب</h3>
              <button onClick={() => setCartOpen(false)} aria-label="إغلاق" className="rounded-full p-1 text-[#f3e3cf]/70 hover:bg-white/5">
                <X className="size-5" />
              </button>
            </div>
            <ul className="divide-y divide-[#d18b4a]/15">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    {l.flavor && <p className="text-xs text-[#f3e3cf]/60">{l.flavor}</p>}
                    <p className="text-sm text-[#d18b4a]">{formatIqdLabel(l.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => dispatch({ type: "dec", key: l.key })} aria-label="إنقاص" className="rounded-full border border-[#d18b4a]/40 p-1.5 hover:bg-white/5">
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center font-semibold">{l.qty}</span>
                    <button onClick={() => dispatch({ type: "inc", key: l.key })} aria-label="زيادة" className="rounded-full border border-[#d18b4a]/40 p-1.5 hover:bg-white/5">
                      <Plus className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
            <div className="mt-4 flex items-center justify-between border-t border-[#d18b4a]/20 pt-4">
              <span className="text-[#f3e3cf]/70">الإجمالي</span>
              <span className="text-lg font-bold text-[#d18b4a]">{formatIqdLabel(total)}</span>
            </div>
            <button
              onClick={onSubmit}
              disabled={busy || count === 0}
              className="mt-4 w-full rounded-xl bg-[#d18b4a] px-4 py-3 font-bold text-[#2b1a10] transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "جارٍ الإرسال…" : "إرسال الطلب"}
            </button>
          </div>
        </div>
      )}

      {/* confirmation */}
      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setConfirmed(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#d18b4a]/30 bg-[#221409] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[#d18b4a]/15 text-[#d18b4a]">
              <Check className="size-8" />
            </div>
            <h3 className="text-xl font-bold">تم استلام طلبك</h3>
            <p className="mt-1 text-[#f3e3cf]/60">رقم الطلب</p>
            <p className="my-2 text-4xl font-extrabold text-[#d18b4a]">{confirmed}</p>
            <p className="text-sm text-[#f3e3cf]/60">اذكر الرقم عند الكاشير للدفع والاستلام.</p>
            <button onClick={() => setConfirmed(null)} className="mt-5 w-full rounded-xl border border-[#d18b4a]/40 px-4 py-2.5 font-semibold text-[#d18b4a] hover:bg-[#d18b4a]/10">
              طلب جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModernCard({
  item,
  effect,
  index,
  onAdd,
}: {
  item: MenuItemView;
  effect: EffectKind;
  index: number;
  onAdd: (line: Omit<CartLine, "qty">) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(item.variants[0]?.id ?? null);
  const [flavor, setFlavor] = useState<string | null>(item.flavors[0] ?? null);
  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = variant?.price ?? item.price;

  function add() {
    onAdd({
      key: `${item.id}|${variantId ?? ""}|${flavor ?? ""}`,
      itemId: item.id,
      name: variant ? `${item.name_ar} - ${variant.name_ar}` : item.name_ar,
      variantId,
      flavor,
      unitPrice,
    });
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-[#221409] ring-1 ring-[#d18b4a]/20"
      style={{ animation: "pz-card-in .5s both", animationDelay: `${index * 70}ms` }}
    >
      {/* image */}
      <div className="relative aspect-[4/5]" style={effect === "pastry" ? { animation: "pz-float 4s ease-in-out infinite" } : undefined}>
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name_ar} className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#2b1a10] to-[#180f09]" />
        )}

        {/* steam (hot) */}
        {effect === "hot" && (
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute block h-16 w-2.5 rounded-full bg-white/60 blur-[6px]"
                style={{
                  left: `${(i - 1) * 14}px`,
                  animation: `pz-steam 2.8s ease-out ${i * 0.9}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* frost + droplets (cold) */}
        {effect === "cold" && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(120% 60% at 50% 35%, rgba(180,220,255,0.35), transparent 60%)",
                animation: "pz-frost 5s ease-in-out infinite",
              }}
            />
            {DROPS.map((d, i) => (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute rounded-full bg-sky-100/80"
                style={{
                  left: d.left,
                  top: d.top,
                  width: d.size,
                  height: d.size * 1.4,
                  filter: "blur(0.5px)",
                  animation: `pz-drip ${d.dur} linear ${d.delay} infinite`,
                }}
              />
            ))}
          </>
        )}

        {/* soft bottom fade into the card body */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#221409] to-transparent" />
      </div>

      {/* info — fully BELOW the image so nothing covers the product */}
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold leading-tight">{item.name_ar}</p>
          <p className="whitespace-nowrap text-sm font-extrabold text-[#d18b4a]">{formatIqdLabel(unitPrice)}</p>
        </div>
        {(item.variants.length > 0 || item.flavors.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {item.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                  v.id === variantId ? "bg-[#d18b4a] text-[#2b1a10]" : "bg-white/10 text-[#f3e3cf]/80"
                }`}
              >
                {v.name_ar}
              </button>
            ))}
            {item.flavors.map((f) => (
              <button
                key={f}
                onClick={() => setFlavor(f)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                  f === flavor ? "bg-[#d18b4a] text-[#2b1a10]" : "bg-white/10 text-[#f3e3cf]/80"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={add}
          className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#d18b4a] py-2 text-sm font-bold text-[#2b1a10] transition active:scale-95"
        >
          <Plus className="size-4" />
          أضف للطلب
        </button>
      </div>
    </div>
  );
}
