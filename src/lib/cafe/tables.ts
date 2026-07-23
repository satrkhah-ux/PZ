/** Physical tables in the cafe (matches the printed QR stickers):
 *  12 indoor + 2 outdoor. table_no is free text, so named tables just work. */
export const TABLES: string[] = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), "خارجي 1", "خارجي 2"];
/** Minutes a table stays «مشغولة» after payment before auto-freeing. */
export const SEATED_MINUTES = 30;

/** «طاولة 5» for numeric tables, the name itself for named ones (خارجي 1). */
export function tableLabel(t: string): string {
  return /^\d+$/.test(t) ? `طاولة ${t}` : t;
}

export type TableOrderRow = {
  order_seq: number;
  status: string;
  table_no: string | null;
  paid_at: string | null;
  created_at: string;
  subtotal: number;
};

export type TableStatus = {
  table: string;
  state: "pending" | "seated" | "free";
  seq: number | null;
  /** pending: minutes since the order arrived · seated: minutes since payment */
  sinceMin: number | null;
  /** seated only: minutes until the table auto-frees */
  freeInMin: number | null;
  subtotal: number | null;
};

/** Derive per-table occupancy from recent orders (rows newest-first).
 *  Pending order → مشغولة (unpaid). Paid within SEATED_MINUTES → مشغولة
 *  (customer having their drink), then auto-free. Pure — unit-tested. */
export function deriveTableStatuses(rows: TableOrderRow[], now: number, tables: string[] = TABLES): TableStatus[] {
  const map = new Map<string, TableStatus>();
  for (const o of rows) {
    const t = o.table_no?.trim();
    if (!t) continue;
    const cur = map.get(t);
    if (o.status === "pending") {
      // a pending order always marks the table busy (newest pending wins)
      if (cur?.state !== "pending") {
        map.set(t, {
          table: t,
          state: "pending",
          seq: o.order_seq,
          sinceMin: Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000)),
          freeInMin: null,
          subtotal: o.subtotal,
        });
      }
    } else if (o.status === "paid" && o.paid_at && !cur) {
      const agoMin = Math.floor((now - new Date(o.paid_at).getTime()) / 60000);
      if (agoMin >= 0 && agoMin < SEATED_MINUTES) {
        map.set(t, { table: t, state: "seated", seq: o.order_seq, sinceMin: agoMin, freeInMin: SEATED_MINUTES - agoMin, subtotal: o.subtotal });
      }
    }
  }
  // the fixed table list in its defined order, then any extra numbers seen in orders
  const known = new Set(tables);
  const extras = [...map.keys()]
    .filter((t) => !known.has(t))
    .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "ar");
    });
  return [...tables, ...extras].map(
    (t) => map.get(t) ?? { table: t, state: "free" as const, seq: null, sinceMin: null, freeInMin: null, subtotal: null },
  );
}
