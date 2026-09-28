/** Inclusive Baghdad-date ranges for the sales report screen.
 *
 *  Pure and unit-tested, and deliberately NOT in a `"use server"` file — those
 *  may only export async functions, so `export const MAX_RANGE_DAYS` there
 *  would break the build (tsc passes, `next build` fails).
 *
 *  Dates are `yyyy-MM-dd` Baghdad calendar days, the same string `business_day`
 *  stores, so plain string comparison orders them correctly. */

/** A quarter — long enough for «الشهر الماضي» and a 3-month review, short
 *  enough that the query and the rendered table stay bounded. */
export const MAX_RANGE_DAYS = 92;

/** Cap on the report's detail log. The per-day summary above it is always
 *  complete — only this list is trimmed, and the UI says so when it is.
 *  Lives here, not in dashboard-actions: a `"use server"` file may only export
 *  async functions, and an `export const` there fails `next build`. */
export const RANGE_ORDERS_LIMIT = 500;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** UTC midnight of a `yyyy-MM-dd` day, or NaN if it isn't a real calendar date.
 *
 *  The regex alone is not enough and neither is Date.parse: V8 SILENTLY ROLLS
 *  OVER an out-of-range day — `2026-02-30` parses as 2 March and `2026-04-31`
 *  as 1 May (only month > 12 yields NaN). Comparing the round-trip back to the
 *  input is what actually rejects them. */
function dayStart(day: string): number {
  if (!ISO.test(day)) return NaN;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t)) return NaN;
  return new Date(t).toISOString().slice(0, 10) === day ? t : NaN;
}

/** Inclusive day count, or NaN when either side isn't a real calendar date. */
export function rangeDays(from: string, to: string): number {
  const a = dayStart(from);
  const b = dayStart(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  // Both are UTC midnight, so the division is exact — no DST anywhere near it.
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Throws an Arabic message the report screen shows as-is. */
export function assertDayRange(from: string, to: string): void {
  const days = rangeDays(from, to);
  if (!Number.isFinite(days)) throw new Error("تاريخ غير صالح");
  if (days < 1) throw new Error("تاريخ البداية بعد تاريخ النهاية");
  if (days > MAX_RANGE_DAYS) throw new Error(`أقصى مدة للبحث ${MAX_RANGE_DAYS} يوماً — قسّمها إلى فترتين`);
}

/** True when both dates are usable together — for callers that want to fall
 *  back to a default instead of surfacing an error (e.g. a junk query string). */
export function isValidRange(from: string, to: string): boolean {
  const days = rangeDays(from, to);
  return Number.isFinite(days) && days >= 1 && days <= MAX_RANGE_DAYS;
}

export type Preset = { key: string; label: string; from: string; to: string };

/** The quick ranges offered above the date inputs. `today` is a business day
 *  string so this stays pure (no clock read) and testable.
 *  All arithmetic is on UTC midnights, which is safe for Baghdad (UTC+3, no DST). */
export function presets(today: string): Preset[] {
  const shift = (days: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  // last day of the previous month = the day before this month started
  const prevEnd = new Date(Date.parse(`${monthStart}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  return [
    { key: "today", label: "اليوم", from: today, to: today },
    { key: "yesterday", label: "أمس", from: shift(-1), to: shift(-1) },
    { key: "d7", label: "آخر ٧ أيام", from: shift(-6), to: today },
    { key: "d30", label: "آخر ٣٠ يوماً", from: shift(-29), to: today },
    { key: "month", label: "هذا الشهر", from: monthStart, to: today },
    { key: "prevMonth", label: "الشهر الماضي", from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd },
  ];
}
