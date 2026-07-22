"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "./auth";

export type DaySummary = {
  day: string;
  sales: number;
  orders_count: number;
  profit: number;
  expenses: number;
  net: number;
};

/** Daily sales/profit/expenses rollup over a range. Admin only — reads profit,
 *  so it goes through the service client (range_summary is service-role-only). */
export async function getRangeSummary(from: string, to: string): Promise<DaySummary[]> {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.rpc("range_summary", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as DaySummary[];
}

export type RecentOrderItem = { name_ar: string; flavor_ar: string | null; qty: number; line_total: number };
export type RecentOrder = {
  id: string;
  order_seq: number;
  channel: string;
  status: string;
  subtotal: number;
  table_no: string | null;
  created_at: string;
  items: RecentOrderItem[];
};

/** Recent orders WITH their stored line items — every table order stays reviewable. */
export async function getRecentOrders(limit = 15): Promise<RecentOrder[]> {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { data: orders } = await svc
    .from("orders")
    .select("id, order_seq, channel, status, subtotal, table_no, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!orders?.length) return [];

  const ids = orders.map((o) => o.id);
  const { data: items } = await svc
    .from("order_items")
    .select("order_id, name_ar, flavor_ar, qty, line_total")
    .in("order_id", ids);
  const byOrder = new Map<string, RecentOrderItem[]>();
  for (const it of items ?? []) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push({ name_ar: it.name_ar, flavor_ar: it.flavor_ar, qty: it.qty, line_total: it.line_total });
    byOrder.set(it.order_id, arr);
  }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] })) as RecentOrder[];
}
