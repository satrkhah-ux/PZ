"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { deriveTableStatuses, type TableStatus } from "./tables";

/** Live occupancy of every table, derived from the last 12h of orders. */
export async function listTableStatus(): Promise<TableStatus[]> {
  await requireStaff();
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("order_seq, status, table_no, paid_at, created_at, subtotal")
    .not("table_no", "is", null)
    .gte("created_at", since)
    .in("status", ["pending", "paid"])
    .order("created_at", { ascending: false });
  return deriveTableStatuses(data ?? [], Date.now());
}
