"use server";

import { isDemoServer } from "./demo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendNewOrderPush } from "./push";
import type { Json } from "@/lib/types";

export type OrderLineInput = {
  item_id: string;
  variant_id?: string | null;
  flavor?: string | null;
  qty: number;
};

export type SubmitOrderInput = {
  channel: "qr" | "kiosk";
  table?: string | null;
  lines: OrderLineInput[];
  /** optional customer capture — builds the loyalty base */
  name?: string | null;
  phone?: string | null;
};

export type SubmitOrderResult =
  | { ok: true; orderNumber: string; orderId?: string | null; cardSerial?: string | null }
  | { ok: false; error: string };

/** Place a self-order. Demo → a plausible number, no persistence. Real → place_order rpc.
 *  A provided phone finds-or-creates the customer (loyalty card) and attaches the
 *  order to them, so paying at the counter auto-awards their points. */
export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  if (!input.lines?.length) return { ok: false, error: "السلة فارغة" };

  if (isDemoServer()) {
    const n = Math.floor(Math.random() * 900 + 100);
    return { ok: true, orderNumber: String(n).padStart(3, "0") };
  }

  const supabase = await createSupabaseServerClient();

  let customerId: string | null = null;
  let cardSerial: string | null = null;
  const phone = input.phone?.trim();
  if (phone) {
    const { data: serial } = await supabase.rpc("create_card", {
      p_phone: phone,
      p_name: input.name?.trim() || null,
    });
    if (serial) {
      cardSerial = serial;
      const { data: card } = await supabase.rpc("get_card", { p_serial: serial });
      customerId = card?.[0]?.id ?? null;
    }
  }

  const { data, error } = await supabase.rpc("place_order", {
    p_channel: input.channel,
    p_lines: input.lines as unknown as Json,
    p_customer: customerId,
    p_table: input.table?.trim() || null,
  });
  if (error || !data?.[0]) return { ok: false, error: "تعذّر إرسال الطلب، حاول مجدداً." };
  // alert subscribed staff devices even when the app is closed (never throws)
  await sendNewOrderPush({
    seq: data[0].order_seq,
    table: input.table?.trim() || null,
    count: input.lines.reduce((s, l) => s + l.qty, 0),
  });
  return { ok: true, orderNumber: String(data[0].order_seq).padStart(3, "0"), orderId: data[0].order_id, cardSerial };
}

export type PublicOrderItem = { name_ar: string; flavor_ar: string | null; qty: number; unit_price: number; line_total: number };
export type PublicOrder = {
  id: string;
  order_seq: number;
  status: string;
  table_no: string | null;
  subtotal: number;
  discount: number;
  created_at: string;
  items: PublicOrderItem[];
};

/** Customer-side order tracking — looks up their own orders by unguessable id. */
export async function getMyOrders(ids: string[]): Promise<PublicOrder[]> {
  if (!ids.length || isDemoServer()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_orders_public", { p_orders: ids.slice(0, 20) });
  return (Array.isArray(data) ? data : []) as PublicOrder[];
}
