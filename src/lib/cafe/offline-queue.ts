"use client";

/**
 * Sales taken while the cafe's internet is down.
 *
 * The till keeps selling and printing; each sale waits here until it can be
 * sent. Two rules decide the whole design:
 *
 *  1. A sale is NEVER removed because sending "probably worked". It leaves this
 *     queue only on a confirmed answer from the server. Losing a sale is worse
 *     than sending it twice — and sending it twice is already impossible,
 *     because every sale carries a `uid` generated BEFORE the first attempt and
 *     the server rejects a uid it has already recorded (place_order_idem).
 *
 *  2. Nothing here throws into the caller. A till that crashes because storage
 *     is full is worse than a till that keeps selling on paper.
 *
 * localStorage, not IndexedDB: a sale is well under a kilobyte, the busiest day
 * on record is 37 orders, and synchronous writes mean a sale is on disk before
 * the receipt prints rather than one tick later.
 */

const KEY = "pz-offline-sales";
/** Far above any real outage (a record day is 37 orders); a guard, not a budget. */
const MAX = 500;

export type OfflineLine = { itemId: string; variantId: string | null; flavor: string | null; qty: number };

export type OfflineSale = {
  /** identity of the SALE, not of the attempt — the server dedupes on this */
  uid: string;
  /** local receipt number shown to the customer while offline: «م-3» */
  localNo: number;
  /** ms epoch, from the till's clock */
  at: number;
  lines: OfflineLine[];
  discount: number;
  extra: number;
  extraNote: string | null;
  table: string | null;
  note: string | null;
  /** what the printed receipt said, so a later audit can compare */
  total: number;
  /** attempts so far — surfaced to staff, never used to drop a sale */
  tries: number;
  lastError: string | null;
};

function read(): OfflineSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OfflineSale[]) : [];
  } catch {
    return [];
  }
}

function write(sales: OfflineSale[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sales));
    return true;
  } catch {
    return false;
  }
}

export function pendingSales(): OfflineSale[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

/** The next «م-N» for today. Counts every sale ever queued today, including the
 *  ones already sent, so two offline sales never print the same number. */
export function nextLocalNo(): number {
  const today = new Date().toDateString();
  let high = 0;
  try {
    high = Number(window.localStorage.getItem(`pz-offline-no:${today}`) || 0);
  } catch {
    /* storage unavailable — fall back to the queue itself */
    high = read().reduce((m, s) => Math.max(m, s.localNo), 0);
  }
  const next = high + 1;
  try {
    window.localStorage.setItem(`pz-offline-no:${today}`, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Store a sale. Returns false ONLY if it could not be stored at all, which the
 *  caller must show loudly — that sale exists on paper and nowhere else. */
export function queueSale(sale: OfflineSale): boolean {
  const all = read();
  if (all.some((s) => s.uid === sale.uid)) return true; // already held
  if (all.length >= MAX) return false;
  all.push(sale);
  return write(all);
}

/** Remove a sale — only ever called after the server confirmed it. */
export function dropSale(uid: string): void {
  write(read().filter((s) => s.uid !== uid));
}

/** Record a failed attempt without dropping the sale. */
export function noteFailure(uid: string, error: string): void {
  write(read().map((s) => (s.uid === uid ? { ...s, tries: s.tries + 1, lastError: error } : s)));
}

export function newUid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // older WebViews: a timestamp plus entropy is unique enough for one till
    return `pz-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}
