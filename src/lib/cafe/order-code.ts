/**
 * Customer-facing order code.
 *
 * The printed number used to be the raw daily sequence (001, 002, 003…), which
 * told every customer exactly how many orders the cafe had taken that day. This
 * maps the sequence onto a 3-digit code that reveals nothing on its own.
 *
 * The map is a modular multiplication, so it is a BIJECTION over the 900 codes:
 * two different orders on the same day can never collide (up to 900 orders/day,
 * far beyond the cafe's volume). The multiplier and offset both derive from the
 * business day, so the same sequence prints a different code each day.
 */

/** Multipliers coprime with 900 (none divisible by 2, 3 or 5) — keeps it bijective. */
const MULTIPLIERS = [173, 227, 281, 331, 383, 437, 491, 529];

function daySalt(businessDay: string): number {
  let h = 7;
  for (const ch of businessDay) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 3-digit code (100–999) for a daily sequence number. Pure + deterministic. */
export function orderCode(seq: number, businessDay: string): string {
  if (!Number.isFinite(seq) || seq < 0) return "000";
  const salt = daySalt(businessDay);
  const k = MULTIPLIERS[salt % MULTIPLIERS.length];
  return String(((seq * k + salt) % 900) + 100);
}
