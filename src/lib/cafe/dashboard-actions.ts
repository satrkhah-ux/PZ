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

export type RecentOrder = {
  id: string;
  order_seq: number;
  channel: string;
  status: string;
  subtotal: number;
  created_at: string;
};

export async function getRecentOrders(limit = 12): Promise<RecentOrder[]> {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("orders")
    .select("id, order_seq, channel, status, subtotal, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as RecentOrder[];
}
