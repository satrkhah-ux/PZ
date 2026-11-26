/** Bulk cost entry: turning 53 typed boxes into the few rows worth sending.
 *
 *  Kept pure and separate from the screen because the dangerous case here is not
 *  a layout bug, it is a blank box being read as a zero. `cost = 0` is what the
 *  menu already holds for 38 of 39 items, and it is exactly what makes today's
 *  profit figure a fiction — so a save that writes 0 over a cost somebody had
 *  already entered correctly would be a silent regression, not a visible one.
 *  Blank therefore means "leave it alone", and only a real, changed number is
 *  ever sent. */

/** One typed field → the integer to store, or null for "do not touch".
 *
 *  Dinars are whole numbers, and the project writes western digits, so anything
 *  that is not a run of ASCII digits (a decimal point, Arabic-Indic digits, a
 *  stray letter, a pasted "3,000") is rejected rather than coerced. Rejecting
 *  reads as "unchanged", which is the safe direction. */
export function parseCost(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** An item's cost lives on `menu_items.cost`; a size's on
 *  `item_variants.cost_override`. The kind travels WITH the row rather than
 *  being looked up again at save time: a variant id sent to menu_items matches
 *  no row, and PostgREST reports that as a success, so a misfiled row would
 *  silently not save at all. */
export type CostKind = "item" | "variant";
export type CostTarget = { id: string; current: number | null; kind: CostKind };
export type CostEdit = { id: string; cost: number; kind: CostKind };

/** The rows whose typed value is both valid and genuinely different.
 *
 *  Re-saving a value that is already stored costs a round trip per row and, on
 *  `menu_items`, bumps `updated_at` for nothing — so an untouched screen sends
 *  an empty list and the action can refuse it outright. */
export function costDiff(targets: CostTarget[], typed: Record<string, string>): CostEdit[] {
  const out: CostEdit[] = [];
  for (const t of targets) {
    const next = parseCost(typed[t.id] ?? "");
    if (next === null) continue;
    if (next === t.current) continue;
    out.push({ id: t.id, cost: next, kind: t.kind });
  }
  return out;
}

/** Split the edits the way the two tables need them. */
export function byKind(edits: CostEdit[]): { items: CostEdit[]; variants: CostEdit[] } {
  return {
    items: edits.filter((e) => e.kind === "item"),
    variants: edits.filter((e) => e.kind === "variant"),
  };
}

/** Margin on one line, as a whole percent, or null when it cannot be stated.
 *
 *  A zero cost is not a 100% margin, it is an unanswered question: 38 items sit
 *  at 0 today. Returning null keeps the screen from printing a confident
 *  "100%" next to every blank row. */
export function margin(price: number, cost: number | null): number | null {
  if (!price || price <= 0) return null;
  if (cost === null || cost <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}
