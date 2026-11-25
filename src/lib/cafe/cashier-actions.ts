"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types";
import { requireStaff } from "./auth";
import { loyaltyConfig } from "./config";
import { orderCode } from "./order-code";
import { businessDay } from "./time";
import { earnPoints } from "./points";
import type { OrderLineInput } from "./order-actions";

export type PendingItem = { name_ar: string; flavor_ar: string | null; qty: number; unit_price: number; line_total: number };
export type PendingOrder = {
  id: string;
  order_seq: number;
  channel: string;
  subtotal: number;
  table_no: string | null;
  note: string | null;
  created_at: string;
  items: PendingItem[];
};

/** Self-orders (qr/kiosk) awaiting the counter, oldest first. */
/** Pending self-orders, plus which build answered.
 *
 *  The build id rides along deliberately: every staff screen already polls this
 *  every 25s, so the update check costs no extra request. A separate endpoint
 *  for it would add an invocation per screen per tick — the exact idle burn that
 *  once exhausted the Netlify credits and paused the whole site. */
export async function listPendingOrders(): Promise<{ orders: PendingOrder[]; build: string }> {
  await requireStaff();
  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_seq, channel, subtotal, table_no, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!orders?.length) return { orders: [], build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" };

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
  return {
    orders: orders.map((o) => ({
      id: o.id,
      order_seq: o.order_seq,
      channel: o.channel,
      subtotal: o.subtotal,
      table_no: o.table_no,
      note: o.note,
      created_at: o.created_at,
      items: byOrder.get(o.id) ?? [],
    })),
    build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
  };
}

async function payOrder(
  supabase: SupabaseClient<Database>,
  orderId: string,
  discount: number,
  customerId: string | null,
  extra = 0,
  extraNote: string | null = null,
): Promise<{ ok: true; total: number; awarded: number } | { ok: false; error: string }> {
  const { data: ord } = await supabase.from("orders").select("subtotal, customer_id").eq("id", orderId).maybeSingle();
  const subtotal = ord?.subtotal ?? 0;
  const disc = Math.max(0, Math.round(discount));
  const ext = Math.max(0, Math.round(extra));
  const net = Math.max(0, subtotal - disc + ext);
  const cfg = loyaltyConfig();
  // award points to whoever the order belongs to — the customer attached at the
  // counter OR the one the self-order already carries (phone entered on the menu)
  const beneficiary = customerId ?? ord?.customer_id ?? null;
  const award = beneficiary ? earnPoints(net, cfg.pointsPerIqd) : 0;
  const { error } = await supabase.rpc("mark_order_paid", {
    p_order: orderId,
    p_discount: disc,
    p_customer: customerId,
    p_award_points: award,
    p_extra: ext,
    p_extra_note: extraNote?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, total: net, awarded: award };
}

export type CheckoutResult =
  | { ok: true; orderNumber: string; total: number; awarded: number }
  | { ok: false; error: string };

/** Cashier: create an order and mark it paid in one step (pay at counter).
 *  A table number means dine-in — it feeds the live tables screen. */
export async function cashierCheckout(input: {
  lines: OrderLineInput[];
  discount?: number;
  extra?: number;
  extraNote?: string | null;
  customerId?: string | null;
  table?: string | null;
  note?: string | null;
  /** Identity of the SALE, minted by the till before it ever calls.
   *
   *  Every sale carries one, online or offline, and that is what makes the
   *  till's timeout safe: when the line is slow the till stops waiting and
   *  holds the sale, but this request may still land afterwards. Because the
   *  uid came first, the later replay recognises its own sale instead of
   *  booking a second one. */
  clientUid: string;
}): Promise<CheckoutResult> {
  await requireStaff();
  if (!input.lines?.length) return { ok: false, error: "لا توجد أصناف في الطلب." };
  if (!input.clientUid) return { ok: false, error: "بصمة الطلب مفقودة." };

  const supabase = await createSupabaseServerClient();
  const { data: idem, error } = await supabase.rpc("place_order_idem", {
    p_client_uid: input.clientUid,
    p_channel: "cashier",
    p_lines: input.lines as unknown as Json,
    p_customer: input.customerId ?? null,
    p_table: input.table?.trim() || null,
    p_note: input.note?.trim() || null,
  });
  const placed = idem as { order_id: string; order_seq: number; already: boolean }[] | null;
  if (error || !placed?.[0]) return { ok: false, error: error?.message ?? "تعذّر إنشاء الطلب." };

  const paid = await payOrder(supabase, placed[0].order_id, input.discount ?? 0, input.customerId ?? null, input.extra ?? 0, input.extraNote ?? null);
  if (!paid.ok) return paid;

  revalidatePath("/cashier");
  revalidatePath("/dashboard");
  return { ok: true, orderNumber: orderCode(placed[0].order_seq, businessDay()), total: paid.total, awarded: paid.awarded };
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

/** Send one sale that was taken while the cafe had no internet.
 *
 *  Safe to call repeatedly with the same `uid`: place_order_idem records the uid
 *  with the order in a single transaction, so a reply lost on the way back can
 *  never turn into a second sale. The till keeps the sale until THIS returns ok,
 *  because a lost sale is worse than a resend. */
export async function syncOfflineSale(sale: {
  uid: string;
  lines: OrderLineInput[];
  discount?: number;
  extra?: number;
  extraNote?: string | null;
  table?: string | null;
  note?: string | null;
  /** what the paper receipt actually said — the customer already paid this */
  printedTotal?: number;
  /** ms epoch when the till rang it, so an outage crossing midnight still books
   *  the sale on the day it was sold */
  rangAt?: number;
}): Promise<{ ok: true; orderNumber: string; already: boolean } | { ok: false; error: string }> {
  await requireStaff();
  if (!sale.uid) return { ok: false, error: "بصمة الطلب مفقودة." };
  if (!sale.lines?.length) return { ok: false, error: "طلب بلا أصناف." };

  const supabase = await createSupabaseServerClient();
  const args = {
    p_client_uid: sale.uid,
    p_channel: "cashier" as const,
    p_lines: sale.lines as unknown as Json,
    p_customer: null,
    p_table: sale.table?.trim() || null,
    p_note: sale.note?.trim() || null,
  };
  let { data, error } = await supabase.rpc("place_order_idem", {
    ...args,
    p_rang_at: sale.rangAt ? new Date(sale.rangAt).toISOString() : null,
  });
  // 0022 adds p_rang_at (so a sale across midnight keeps its own day). If that
  // migration has not been applied yet, PostgREST cannot find a function with
  // this signature — fall back rather than strand the sale on the till. The
  // sale then lands on the day it SYNCED, which is the old behaviour, not a
  // loss, and the deploy order stops being load-bearing.
  if (error && /PGRST202|p_rang_at|does not exist|Could not find/i.test(`${error.code ?? ""} ${error.message}`)) {
    ({ data, error } = await supabase.rpc("place_order_idem", args));
  }
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "تعذّر تسجيل الطلب." };

  // Which day the order actually belongs to — a sale synced after midnight still
  // belongs to the shift that rang it, and its code is derived from that day.
  const { data: ord } = await supabase
    .from("orders")
    .select("business_day, status")
    .eq("id", row.order_id)
    .maybeSingle();
  const day = ord?.business_day ?? businessDay();
  const code = orderCode(row.order_seq, day);

  // `already` means an earlier attempt created it. It may still be unpaid if
  // that attempt died between the two steps, so settle it rather than assume.
  if (row.already && ord?.status !== "pending") return { ok: true, orderNumber: code, already: true };

  // place_order prices the lines from the LIVE menu at replay time. If a price
  // was edited during the outage, the order's subtotal no longer matches the
  // paper the customer paid against. The receipt is the truth — the money is
  // already in the drawer — so absorb the difference into discount/extra, which
  // is exactly how the project's own formula (subtotal − discount + extra)
  // records a paid amount.
  let discount = Math.max(0, Math.round(sale.discount ?? 0));
  let extra = Math.max(0, Math.round(sale.extra ?? 0));
  let extraNote = sale.extraNote ?? null;
  if (typeof sale.printedTotal === "number" && sale.printedTotal >= 0) {
    const { data: fresh } = await supabase.from("orders").select("subtotal").eq("id", row.order_id).maybeSingle();
    const subtotal = fresh?.subtotal ?? 0;
    const wouldRecord = subtotal - discount + extra;
    const drift = sale.printedTotal - wouldRecord;
    if (drift > 0) extra += drift;
    else if (drift < 0) discount += -drift;
    if (drift !== 0) {
      const mark = `تسعيرة تغيّرت أثناء الانقطاع (${drift > 0 ? "+" : ""}${drift})`;
      extraNote = extraNote ? `${extraNote} — ${mark}` : mark;
    }
  }

  const paid = await payOrder(supabase, row.order_id, discount, null, extra, extraNote);
  if (!paid.ok) return paid;

  revalidatePath("/cashier");
  revalidatePath("/dashboard");
  return { ok: true, orderNumber: code, already: !!row.already };
}
