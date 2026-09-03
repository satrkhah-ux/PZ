/**
 * Pure layout/timing math for the pickup screen. NO state, NO browser, NO clock
 * of its own — every time-varying answer is a function of `now`.
 *
 * Why: the TV rebuilds the page from scratch every 10s (Refresh header) and TV
 * browsers suspend JS timers on a page nobody touches. A counter held in a
 * variable is lost on every rebuild; the clock never is. Everything here is
 * therefore testable with fake times, with no browser and no database.
 */

export type QueueRow = {
  id: string;
  code: string; // the SAME code printed on the customer's receipt
  prep_status: "preparing" | "ready";
  table_no: string | null;
};

/** Size tiers, largest first. `floor` is the smallest still readable across a hall. */
export type Tier = { font: number; label: number; cols: number; cardH: number };
export const TIERS: Tier[] = [
  { font: 96, label: 30, cols: 1, cardH: 176 },
  { font: 80, label: 26, cols: 2, cardH: 152 },
  { font: 64, label: 22, cols: 2, cardH: 128 },
  { font: 52, label: 20, cols: 3, cardH: 112 },
  { font: 44, label: 18, cols: 3, cardH: 98 }, // ≈5.5cm — readable from ~11m
];

export const GAP = 12;

/**
 * Pick the LARGEST tier in which every current card fits at once. If even the
 * smallest cannot hold them, stop shrinking (below the floor nobody can read it
 * anyway) and let the caller paginate instead.
 *
 * `extraCols` gives the «جاهز» column one more column before it starts paging —
 * a ready number is an instruction to walk to the counter, and an instruction
 * shown half the time is a bad instruction.
 */
export function fitColumn(
  count: number,
  availH: number,
  extraCols = 0,
): { tier: Tier; perPage: number; pages: number } {
  const usable = TIERS.filter((t) => t.cardH <= availH);
  const tiers = usable.length > 0 ? usable : [TIERS[TIERS.length - 1]];

  let chosen = tiers[tiers.length - 1];
  let perPage = 1;

  for (const t of tiers) {
    const rows = Math.max(1, Math.floor((availH + GAP) / (t.cardH + GAP)));
    const cols = Math.max(1, t.cols + extraCols);
    const fit = rows * cols;
    chosen = t;
    perPage = fit;
    if (fit >= count) break; // first tier that holds everything — not the smallest
  }

  const pages = Math.max(1, Math.ceil(Math.max(count, 1) / perPage));
  return { tier: chosen, perPage, pages };
}

/**
 * Which page a rotating column shows right now — derived from the clock, never
 * from a counter. Same answer on the server at first paint and in the browser
 * after a full rebuild.
 */
export function pageNow(count: number, perPage: number, seconds: number, now: number): number {
  if (perPage <= 0 || seconds <= 0) return 0;
  const pages = Math.ceil(count / perPage);
  if (pages < 2) return 0;
  return Math.floor(now / (seconds * 1000)) % pages;
}

/** The slice of rows visible on the current page. */
export function pageSlice<T>(rows: T[], perPage: number, page: number): T[] {
  if (perPage <= 0) return rows;
  const start = page * perPage;
  return rows.slice(start, start + perPage);
}

/**
 * EDGE, not level: true only when an id became ready that was not ready before.
 * `hasReady` (a level) would be true on every render — the bell would either
 * never stop or never ring.
 */
export function justWentReady(prevReadyIds: readonly string[], currReadyIds: readonly string[]): boolean {
  if (currReadyIds.length === 0) return false;
  const before = new Set(prevReadyIds);
  return currReadyIds.some((id) => !before.has(id));
}

/** Which idle slide to show — same clock-derived trick as pageNow. */
export function slideNow(count: number, seconds: number, now: number): number {
  if (count <= 1 || seconds <= 0) return 0;
  return Math.floor(now / (seconds * 1000)) % count;
}

/** Split the board into the two columns the screen renders. */
export function splitColumns(rows: readonly QueueRow[]): { preparing: QueueRow[]; ready: QueueRow[] } {
  const preparing: QueueRow[] = [];
  const ready: QueueRow[] = [];
  for (const r of rows) (r.prep_status === "ready" ? ready : preparing).push(r);
  return { preparing, ready };
}
