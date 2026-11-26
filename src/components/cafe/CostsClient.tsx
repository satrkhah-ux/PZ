"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Save } from "lucide-react";
import type { AdminCategory } from "@/lib/cafe/menu-admin-actions";
import { saveItemCosts } from "@/lib/cafe/menu-admin-actions";
import { byKind, costDiff, margin, parseCost, type CostTarget } from "@/lib/cafe/cost-entry";
import { formatIqdLabel } from "@/lib/cafe/money";

/** «كلف الأصناف» — one screen to cost the whole menu in a single sitting.
 *
 *  It exists because `profit` on the dashboard is currently a fiction: 38 of 39
 *  items hold cost 0, so "profit" is really just sales. The menu editor can
 *  already set a cost, but only one item at a time behind a dialog — which is 39
 *  dialogs, and nobody finishes that.
 *
 *  Sizes get their own box. place_order stores
 *  `coalesce(variant.cost_override, item.cost)`, and all 14 sizes are currently
 *  null, so a 6000 size would be booked at its 3500 base's cost and read as the
 *  most profitable thing on the menu. */
export function CostsClient({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  /** Every costable row, flattened in the order it is rendered — the same order
   *  Enter walks, and the list the diff is taken against. */
  const rows = useMemo(() => {
    const out: {
      id: string;
      label: string;
      sub: string | null;
      price: number;
      current: number | null;
      /** what this row falls back to when left blank (a size inherits its item) */
      inherits: number | null;
      isVariant: boolean;
      cat: string;
    }[] = [];
    for (const c of categories) {
      for (const it of c.items) {
        out.push({
          id: it.id,
          label: it.name_ar,
          sub: null,
          price: it.price,
          current: it.cost ?? 0,
          inherits: null,
          isVariant: false,
          cat: c.name_ar,
        });
        for (const v of [...it.variants].sort((a, b) => a.sort - b.sort)) {
          out.push({
            id: v.id,
            label: it.name_ar,
            sub: v.name_ar,
            price: v.price_override ?? it.price,
            current: v.cost_override,
            inherits: it.cost ?? 0,
            isVariant: true,
            cat: c.name_ar,
          });
        }
      }
    }
    return out;
  }, [categories]);

  const targets: CostTarget[] = useMemo(
    () => rows.map((r) => ({ id: r.id, current: r.current, kind: r.isVariant ? "variant" : "item" })),
    [rows],
  );
  const edits = useMemo(() => costDiff(targets, typed), [targets, typed]);
  const editIds = useMemo(() => new Set(edits.map((e) => e.id)), [edits]);

  // "Missing" counts a size as covered when it inherits a real cost from its item.
  const missing = rows.filter((r) => {
    const live = parseCost(typed[r.id] ?? "") ?? r.current ?? r.inherits;
    return !live;
  }).length;

  /** The number this row will be costed at once saved — typed, else stored, else
   *  inherited. Everything on screen reads from this so the margins update as
   *  the owner types rather than only after a save. */
  const effective = (r: (typeof rows)[number]) => parseCost(typed[r.id] ?? "") ?? r.current ?? r.inherits;

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await saveItemCosts(byKind(edits));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    // Clear the boxes only on success: a failed save must leave the typing on
    // screen, or the owner re-enters the whole sitting from memory.
    setTyped({});
    setMsg({ ok: true, text: `حُفِظت كلفة ${res.saved} صنف.` });
    router.refresh();
  }

  let idx = -1;

  return (
    <div className="mx-auto max-w-4xl px-3 pb-32 pt-4">
      <header className="mb-4">
        <h1 className="text-xl font-extrabold text-primary">كلف الأصناف</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          أدخل كلفة كل صنف ليصبح الربح في لوحة التحكم رقماً حقيقياً. اتركِ الخانة فارغة ولن يتغيّر
          شيء. الأحجام لها خانة خاصة — إن تركتها فارغة فستأخذ كلفة الصنف نفسه.
        </p>
        {missing > 0 && (
          <p className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            {missing} من {rows.length} سطراً بلا كلفة — الربح المعروض لها الآن يساوي سعر البيع.
          </p>
        )}
      </header>

      {categories.map((c) => {
        const mine = rows.filter((r) => r.cat === c.name_ar);
        if (!mine.length) return null;
        return (
          <section key={c.id} className="mb-5">
            <h2 className="mb-2 text-sm font-extrabold text-muted-foreground">{c.name_ar}</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-bold">الصنف</th>
                    <th className="px-2 py-2 text-end font-bold">السعر</th>
                    <th className="px-2 py-2 text-center font-bold">الكلفة</th>
                    <th className="px-2 py-2 text-end font-bold">الربح</th>
                    <th className="px-3 py-2 text-end font-bold">الهامش</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((r) => {
                    const live = effective(r);
                    const m = margin(r.price, live);
                    const loss = live !== null && live > 0 && live >= r.price;
                    idx += 1;
                    const here = idx;
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-border ${r.isVariant ? "bg-secondary/30" : ""} ${
                          editIds.has(r.id) ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-3 py-1.5">
                          {r.isVariant ? (
                            <span className="text-muted-foreground">
                              <span className="opacity-50">↳ </span>
                              {r.label} — <span className="font-bold">{r.sub}</span>
                            </span>
                          ) : (
                            <span className="font-bold">{r.label}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-end text-muted-foreground" dir="ltr">
                          {formatIqdLabel(r.price)}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            ref={(el) => {
                              boxes.current[here] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            value={typed[r.id] ?? ""}
                            placeholder={r.current !== null ? String(r.current) : r.inherits ? `${r.inherits}` : "0"}
                            onChange={(e) => setTyped((t) => ({ ...t, [r.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              // One sitting of 53 numbers: Enter should walk down
                              // the column, not submit and lose the lot.
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              boxes.current[here + 1]?.focus();
                              boxes.current[here + 1]?.select();
                            }}
                            className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-center outline-none focus:ring-2 focus:ring-ring"
                            aria-label={`كلفة ${r.label}${r.sub ? ` ${r.sub}` : ""}`}
                          />
                        </td>
                        <td
                          className={`whitespace-nowrap px-2 py-1.5 text-end ${loss ? "font-bold text-destructive" : ""}`}
                          dir="ltr"
                        >
                          {live === null || live === 0 ? "—" : formatIqdLabel(r.price - live)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-end" dir="ltr">
                          {m === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={m < 0 ? "font-bold text-destructive" : m < 40 ? "text-amber-600" : ""}>
                              {m}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* Sticky because the menu is longer than a screen and the owner should be
          able to save from wherever they stopped typing. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            onClick={save}
            disabled={busy || edits.length === 0}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-40"
          >
            <Save className="size-4" />
            {busy ? "…" : edits.length ? `حفظ ${edits.length} تغييراً` : "لا تغييرات"}
          </button>
          {msg && (
            <p
              className={`flex items-center gap-1.5 text-sm font-bold ${
                msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {msg.ok && <Check className="size-4" />}
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
