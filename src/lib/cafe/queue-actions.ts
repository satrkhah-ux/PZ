"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { businessDay } from "./time";
import { orderCode } from "./order-code";
import type { QueueRow } from "./queue-display";

/**
 * Constant-time key comparison. `a === b` stops at the first differing byte, so
 * a nearly-correct guess takes measurably longer than a wrong one — a signal you
 * can average out over thousands of tries. XOR every byte, never exit early.
 */
function keyMatches(given: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** May this display key open the pickup screen? Checked in the server component,
 *  NOT inside listQueue — a throwing fetch plus a reload guard is an infinite
 *  reload loop on a public URL. */
export async function canViewQueue(key: string): Promise<boolean> {
  const expected = process.env.QUEUE_DISPLAY_KEY ?? "";
  return keyMatches(key, expected);
}

/**
 * Today's board. Reads the financially-clean `queue_public` view with the
 * service client: the TV has no staff session, and the view carries no money
 * column, so there is nothing to leak.
 *
 * The number shown is orderCode(...) — the SAME code printed on the customer's
 * receipt. Showing the raw sequence here would both mismatch the paper and tell
 * the room how many orders were sold today.
 */
export async function listQueue(): Promise<QueueRow[]> {
  const supabase = createSupabaseServiceClient();
  const day = businessDay();
  const { data, error } = await supabase
    .from("queue_public")
    .select("id, order_seq, prep_status, table_no")
    .order("prep_status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    code: orderCode(Number(r.order_seq), day),
    prep_status: r.prep_status === "ready" ? "ready" : "preparing",
    table_no: r.table_no ?? null,
  }));
}

/* ————— staff side: the board that actually moves an order ————— */

export type PrepOrder = {
  id: string;
  code: string;
  seq: number;
  prep: "new" | "preparing" | "ready" | "handed";
  table_no: string | null;
  created_at: string;
  items: string;
};

/** Today's paid orders that are not handed over yet, oldest first. */
export async function listPrepBoard(): Promise<PrepOrder[]> {
  await requireStaff();
  const supabase = createSupabaseServiceClient();
  const day = businessDay();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_seq, prep_status, table_no, created_at")
    .eq("business_day", day)
    .neq("status", "cancelled")
    .in("prep_status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true });
  if (!orders?.length) return [];

  const ids = orders.map((o) => o.id);
  const { data: items } = await supabase.from("order_items").select("order_id, name_ar, qty").in("order_id", ids);
  const byOrder = new Map<string, string[]>();
  for (const it of items ?? []) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push(`${it.name_ar} ×${it.qty}`);
    byOrder.set(it.order_id, arr);
  }

  return orders.map((o) => ({
    id: String(o.id),
    seq: Number(o.order_seq),
    code: orderCode(Number(o.order_seq), day),
    prep: (o.prep_status ?? "new") as PrepOrder["prep"],
    table_no: o.table_no ?? null,
    created_at: String(o.created_at),
    items: (byOrder.get(String(o.id)) ?? []).join(" · "),
  }));
}

/** Move one order along the prep flow. Staff only. */
export async function setPrepStatus(
  orderId: string,
  prep: "preparing" | "ready" | "handed",
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff();
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({ prep_status: prep, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ————— idle showcase: the cafe's own products ————— */

/** Owner: the hall screen must NOT show prices. */
export type ShowcaseItem = { name: string; image: string; category: string };

/**
 * Pictures for the idle screen, read from the cost-free `menu_public` view.
 * Deterministic order so the server's first paint and the browser agree on which
 * slide is showing — the whole screen derives "which slide" from the clock.
 */
export async function listShowcase(): Promise<ShowcaseItem[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("menu_public")
    .select("name_ar, image_url, category_name, category_sort, sort")
    .order("category_sort", { ascending: true })
    .order("sort", { ascending: true });
  if (error || !data) return [];
  return data
    .filter((r) => !!r.image_url)
    .map((r) => ({
      name: r.name_ar,
      image: String(r.image_url),
      category: r.category_name ?? "",
    }));
}
