/**
 * «ما الجديد» — the one notice staff get when the system changes under them.
 *
 * Shown twice on the release day and never again: once in the morning shift and
 * once from 3pm, because the cafe runs two shifts and the person who opens is
 * usually not the person who closes. Showing it on every load instead would
 * train everyone to dismiss it unread, which is the same as not shipping it.
 *
 * Pure: the clock and the "already seen" store are passed in, so the awkward
 * part — which slot is due — is unit tested rather than hoped about.
 */

export type Slot = "morning" | "afternoon";

export type Release = {
  /** stable id; bump it for the next release so the notice shows again */
  id: string;
  /** the Baghdad day it goes out, yyyy-MM-dd */
  day: string;
  title: string;
  items: string[];
};

/** The afternoon shift starts here. */
export const AFTERNOON_HOUR = 15;

/** Baghdad is UTC+3 all year — Iraq keeps no daylight saving. */
function baghdad(now: Date): { day: string; hour: number } {
  const shifted = new Date(now.getTime() + 3 * 3600_000);
  return { day: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/** Which slot is due right now, or null when nothing should be shown.
 *  `seen` answers "has this slot already been shown on this device". */
export function dueSlot(release: Release, now: Date, seen: (key: string) => boolean): Slot | null {
  const { day, hour } = baghdad(now);
  if (day !== release.day) return null;
  const slot: Slot = hour >= AFTERNOON_HOUR ? "afternoon" : "morning";
  return seen(slotKey(release, slot)) ? null : slot;
}

export function slotKey(release: Release, slot: Slot): string {
  return `pz-whatsnew:${release.id}:${slot}`;
}

/** What this release tells the staff. Replace wholesale next time — and change
 *  `id` and `day`, or nobody will see it. */
export const CURRENT_RELEASE: Release = {
  id: "2026-11-25-offline",
  day: "2026-11-25",
  title: "جديد: الكاشير يعمل بدون إنترنت",
  items: [
    "إذا انقطع النت، تبيع وتطبع الإيصال كالمعتاد — لا يتوقف شيء.",
    "الطلب يُحفظ في الجهاز ويُرفع وحده فور عودة الاتصال، ولا يضيع ولا يتكرّر.",
    "الإيصال وقتها يحمل رمزاً مثل «م-١» ليعرف الطاقم أنه لم يدخل النظام بعد.",
    "شريط أعلى الشاشة يخبرك كم طلباً محفوظاً في انتظار الرفع.",
    "مهم: افتح الكاشير مرة والنت موجود بعد كل تحديث، لتُحفظ الشاشة للطوارئ.",
  ],
};
