"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { MenuCategoryView } from "@/lib/cafe/menu-data";
import { formatIqdLabel } from "@/lib/cafe/money";
import { MenuIcon } from "./MenuIcon";
import { PizzaraMark } from "./Logo";

/** Full-screen tablet menu: category rail on the RIGHT, product photo grid on
 *  the LEFT. Instant client-side category switching. One-tap palette switch:
 *  coffee ⇄ turquoise. */

type ThemeKey = "coffee" | "teal";
const THEMES: Record<ThemeKey, { label: string; dot: string; vars: Record<string, string>; grad: string }> = {
  coffee: {
    label: "قهوائي",
    dot: "#d18b4a",
    vars: { "--accent": "#d18b4a", "--accent2": "#e6a862", "--panel": "#2a1a10", "--panelsoft": "#241610", "--text": "#f3e3cf", "--muted": "#c9b299", "--line": "rgba(209,139,74,0.16)", "--active": "#f3e3cf", "--activeink": "#2b1a10" },
    grad: "radial-gradient(1100px 700px at 88% -8%, rgba(209,139,74,0.14), transparent 55%), linear-gradient(160deg, #1d120b, #120a05)",
  },
  teal: {
    label: "فيروزي",
    dot: "#3fd0c7",
    vars: { "--accent": "#3fd0c7", "--accent2": "#63e2da", "--panel": "#0f3b39", "--panelsoft": "#0c332f", "--text": "#e9fffb", "--muted": "#a9d9d4", "--line": "rgba(63,208,199,0.18)", "--active": "#e9fffb", "--activeink": "#08312e" },
    grad: "radial-gradient(1100px 700px at 88% -8%, rgba(63,208,199,0.16), transparent 55%), linear-gradient(160deg, #0f4a46, #062422)",
  },
};

function imgSrc(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/menu\/(.+)$/);
  const rel = m ? `/img/${m[1]}` : url;
  return rel.replace(/\.webp(\?|$)/, "-sm.webp$1");
}

// ambient motion per category — steam over hot, frost + drips over cold, float on pastries
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

export function TabletMenuClient({ menu }: { menu: MenuCategoryView[] }) {
  const [theme, setTheme] = useState<ThemeKey>("coffee");
  const [activeCat, setActiveCat] = useState(menu[0]?.name_ar ?? "");
  const mainRef = useRef<HTMLElement>(null);
  const t = THEMES[theme];
  const cat = menu.find((c) => c.name_ar === activeCat) ?? menu[0];
  const effect = effectFor(cat?.name_ar ?? "");

  function selectCat(name: string) {
    setActiveCat(name);
    mainRef.current?.scrollTo({ top: 0 }); // start each category from the top
  }

  return (
    <div dir="rtl" style={{ ...(t.vars as CSSProperties), background: t.grad }} className="flex h-dvh flex-col text-[var(--text)]">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <PizzaraMark className="size-9 shrink-0" />
          <span className="text-lg font-extrabold text-[var(--accent)]">بيزارا كافيه</span>
        </div>
        <h1 className="text-base font-bold text-[var(--muted)]">المنيو</h1>
        <div className="flex rounded-full border border-[var(--line)] p-1 text-sm font-bold">
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTheme(k)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${theme === k ? "bg-[var(--accent)] text-[var(--activeink)]" : "text-[var(--muted)]"}`}
            >
              <span className="size-3 rounded-full" style={{ background: THEMES[k].dot }} />
              {THEMES[k].label}
            </button>
          ))}
        </div>
      </header>

      {/* row-reverse in RTL puts the products (first) on the LEFT and the rail (second) on the RIGHT */}
      <div className="flex min-h-0 flex-1 flex-row-reverse">
        {/* product grid — LEFT */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 px-1 text-xl font-extrabold text-[var(--accent)]">{cat?.name_ar}</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {(cat?.items ?? []).map((it) => {
              const src = imgSrc(it.image_url);
              return (
                <article key={it.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panelsoft)]">
                  <div
                    className="relative aspect-[4/5] bg-[var(--panel)]"
                    style={effect === "pastry" ? { animation: "pz-float 4s ease-in-out infinite" } : undefined}
                  >
                    {/* icon fallback always behind — shows if there's no photo or it fails to load (e.g. مياه) */}
                    <MenuIcon name={it.name_ar} category={cat?.name_ar} className="absolute inset-0 m-auto size-16 text-[var(--accent)] opacity-45" />
                    {src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={it.name_ar}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    {effect === "hot" && (
                      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[20%] -translate-x-1/2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="absolute block h-14 w-2 rounded-full bg-white/55 blur-[5px]"
                            style={{ left: `${(i - 1) * 12}px`, animation: `pz-steam 2.8s ease-out ${i * 0.9}s infinite` }}
                          />
                        ))}
                      </div>
                    )}
                    {effect === "cold" && (
                      <>
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={{ background: "radial-gradient(120% 60% at 50% 35%, rgba(170,215,255,0.38), transparent 60%)", animation: "pz-frost 5s ease-in-out infinite" }}
                        />
                        {DROPS.map((d, i) => (
                          <span
                            key={i}
                            aria-hidden
                            className="pointer-events-none absolute rounded-full bg-sky-100/90"
                            style={{ left: d.left, top: d.top, width: d.size, height: d.size * 1.4, filter: "blur(0.5px)", animation: `pz-drip ${d.dur} linear ${d.delay} infinite` }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-right">
                    <p className="line-clamp-2 min-h-[2.5em] text-[15px] font-bold leading-tight">{it.name_ar}</p>
                    <p className="mt-1 text-base font-extrabold tabular-nums text-[var(--accent)]">{formatIqdLabel(it.price)}</p>
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
              <button
                key={c.name_ar}
                onClick={() => selectCat(c.name_ar)}
                className={`flex w-full flex-col items-center gap-1.5 px-2 py-3.5 text-center transition ${on ? "bg-[var(--active)] text-[var(--activeink)]" : "text-[var(--muted)] hover:bg-[var(--panel)]"}`}
              >
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
    </div>
  );
}
