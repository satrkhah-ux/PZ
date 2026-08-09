"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { MenuCategoryView } from "@/lib/cafe/menu-data";
import { formatIqdLabel } from "@/lib/cafe/money";
import { MenuIcon } from "./MenuIcon";
import { PizzaraMark } from "./Logo";

/** Full-screen tablet menu: scrollable category rail on the right, a 2-column
 *  photo grid on the left. Category switching is instant (all items loaded once,
 *  filtered client-side). One-tap palette switch: coffee ⇄ turquoise. */

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

export function TabletMenuClient({ menu }: { menu: MenuCategoryView[] }) {
  const [theme, setTheme] = useState<ThemeKey>("coffee");
  const [activeCat, setActiveCat] = useState(menu[0]?.name_ar ?? "");
  const t = THEMES[theme];
  const cat = menu.find((c) => c.name_ar === activeCat) ?? menu[0];

  return (
    <div
      dir="rtl"
      style={{ ...(t.vars as CSSProperties), background: t.grad }}
      className="flex h-dvh flex-col text-[var(--text)]"
    >
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <PizzaraMark className="size-9 shrink-0" />
          <span className="text-lg font-extrabold text-[var(--accent)]">بيزارا كافيه</span>
        </div>
        <h1 className="text-base font-bold text-[var(--muted)]">المنيو</h1>
        {/* palette switch */}
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

      <div className="flex min-h-0 flex-1">
        {/* product grid */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 px-1 text-xl font-extrabold text-[var(--accent)]">{cat?.name_ar}</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {(cat?.items ?? []).map((it) => {
              const src = imgSrc(it.image_url);
              return (
                <article key={it.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panelsoft)]">
                  <div className="relative aspect-[4/3] bg-[var(--panel)]">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={it.name_ar} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <MenuIcon name={it.name_ar} category={cat?.name_ar} className="absolute inset-0 m-auto size-20 text-[var(--accent)] opacity-70" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="text-base font-extrabold tabular-nums text-[var(--accent)]">{formatIqdLabel(it.price)}</span>
                    <span className="truncate text-right text-[15px] font-bold">{it.name_ar}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </main>

        {/* category rail (right) */}
        <aside className="w-[168px] shrink-0 overflow-y-auto border-r border-[var(--line)] bg-[var(--panelsoft)]/60 py-2 sm:w-[196px]">
          {menu.map((c) => {
            const on = c.name_ar === activeCat;
            return (
              <button
                key={c.name_ar}
                onClick={() => setActiveCat(c.name_ar)}
                className={`flex w-full flex-col items-center gap-1.5 px-2 py-3.5 text-center transition ${on ? "bg-[var(--active)] text-[var(--activeink)]" : "text-[var(--muted)] hover:bg-[var(--panel)]"}`}
              >
                <MenuIcon name={c.name_ar} category={c.name_ar} className={`size-8 ${on ? "text-[var(--activeink)]" : "text-[var(--accent)]"}`} />
                <span className="text-[13px] font-bold leading-tight">{c.name_ar}</span>
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
