import { formatInTimeZone } from "date-fns-tz";

/** The cafe operates on Baghdad calendar days — used everywhere "today" appears. */
export const CAFE_TZ = "Asia/Baghdad";

/** Business day (yyyy-MM-dd) for an instant, in Baghdad time. */
export function businessDay(date: Date = new Date(), tz: string = CAFE_TZ): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** N-day range ending today (inclusive), as [fromDay, toDay] Baghdad dates. */
export function lastNDays(n: number, now: Date = new Date(), tz: string = CAFE_TZ): [string, string] {
  const to = businessDay(now, tz);
  const from = businessDay(new Date(now.getTime() - (n - 1) * 24 * 60 * 60 * 1000), tz);
  return [from, to];
}

/** Receipt stamp in Baghdad time, 12-hour with Arabic صباحاً/مساءً.
 *  The cafe runs past midnight, so 24h times (23:40 / 00:20) were misread by the
 *  counter — this is the single source of truth for what a printout shows. */
export function receiptStamp(date: Date = new Date(), tz: string = CAFE_TZ): { time: string; date: string } {
  const hour24 = Number(formatInTimeZone(date, tz, "H"));
  const period = hour24 < 12 ? "صباحاً" : "مساءً";
  return {
    time: `${formatInTimeZone(date, tz, "h:mm")} ${period}`,
    date: formatInTimeZone(date, tz, "dd/MM/yyyy"),
  };
}
