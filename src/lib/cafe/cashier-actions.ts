"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types";
import { requireStaff } from "./auth";
import { loyaltyConfig } from "./config";
import { earnPoints } from "./points";
import type { OrderLineInput } from "./order-actions";

export type PendingItem = { name_ar: string; flavor_ar: string | null; qty: number; unit_price: number; line_total: number };
export type PendingOrder = {
  id: string;
  order_seq: number;
  channel: string;
  subtotal: number;
  table_no: string | null;
  created_at: string;
  items: PendingItem[];
};

/** Self-orders (qr/kiosk) awaiting the counter, oldest first. */
export async function listPendingOrders(): Promise<PendingOrder[]> {
  await requireStaff();
  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_seq, channel, subtotal, table_no, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!orders?.length) return [];

  const ids = orders.map((o) => o.id);
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, name_ar, flavor_ar, qty, unit_price, line_total")
    .in("order_id", ids);

  const byOrder = new Map<string, PendingItem[]>();
  for (const it of items ?? []) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push({ name_ar: it.name_ar, flavor_ar: it.flavor_ar, qty: it.qty, unit_price: it.unit_price, line_total: it.line_total });
    byOrder.set(it.order_id, arr);
  }
  return orders.map((o) => ({
    id: o.id,
    order_seq: o.order_seq,
    channel: o.channel,
    subtotal: o.subtotal,
    table_no: o.table_no,
    created_at: o.created_at,
    items: byOrder.get(o.id) ?? [],
  }));
}

async function payOrder(
  supabase: SupabaseClient<Database>,
  orderId: string,
  discount: number,
  customerId: string | null,
): Promise<{ ok: true; total: number; awarded: number } | { ok: false; error: string }> {
  const { data: ord } = await supabase.from("orders").select("subtotal").eq("id", orderId).maybeSingle();
  const subtotal = ord?.subtotal ?? 0;
  const disc = Math.max(0, Math.round(discount));
  const net = Math.max(0, subtotal - disc);
  const cfg = loyaltyConfig();
  const award = customerId ? earnPoints(net, cfg.pointsPerIqd) : 0;
  const { error } = await supabase.rpc("mark_order_paid", {
    p_order: orderId,
    p_discount: disc,
    p_customer: customerId,
    p_award_points: award,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, total: net, awarded: award };
}

export type CheckoutResult =
  | { ok: true; orderNumber: string; total: number; awarded: number }
  | { ok: false; error: string };

/** Cashier: create an order and mark it paid in one step (pay at counter). */
export async function cashierCheckout(input: {
  lines: OrderLineInput[];
  discount?: number;
  customerId?: string | null;
}): Promise<CheckoutResult> {
  await requireStaff();
  if (!input.lines?.length) return { ok: false, error: "لا توجد أصناف في الطلب." };

  const supabase = await createSupabaseServerClient();
  const { data: placed, error } = await supabase.rpc("place_order", {
    p_channel: "cashier",
    p_lines: input.lines as unknown as Json,
    p_customer: input.customerId ?? null,
  });
  if (error || !placed?.[0]) return { ok: false, error: error?.message ?? "تعذّر إنشاء الطلب." };

  const paid = await payOrder(supabase, placed[0].order_id, input.discount ?? 0, input.customerId ?? null);
  if (!paid.ok) return paid;

  revalidatePath("/cashier");
  revalidatePath("/dashboard");
  return { ok: true, orderNumber: String(placed[0].order_seq).padStart(3, "0"), total: paid.total, awarded: paid.awarded };
}

/** Accept & pay an existing pending self-order from the queue. */
export async function payPendingOrder(orderId: string, discount = 0, customerId: string | null = null) {
  await requireStaff();
  const supabase = await createSupabaseServerClient();
  const paid = await payOrder(supabase, orderId, discount, customerId);
  if (!paid.ok) return paid;
  revalidatePath("/cashier");
  revalidatePath("/dashboard");
  return { ok: true as const, awarded: paid.awarded };
}

export async function cancelOrder(orderId: string) {
  await requireStaff();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/cashier");
  return { ok: true as const };
}
