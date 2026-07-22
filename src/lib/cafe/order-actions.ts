"use server";

import { isDemoServer } from "./demo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
};

export type SubmitOrderResult = { ok: true; orderNumber: string } | { ok: false; error: string };

/** Place a self-order. Demo → a plausible number, no persistence. Real → place_order rpc. */
export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  if (!input.lines?.length) return { ok: false, error: "السلة فارغة" };

  if (isDemoServer()) {
    const n = Math.floor(Math.random() * 900 + 100);
    return { ok: true, orderNumber: String(n).padStart(3, "0") };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_channel: input.channel,
    p_lines: input.lines as unknown as Json,
    p_customer: null,
  });
  if (error || !data?.[0]) return { ok: false, error: "تعذّر إرسال الطلب، حاول مجدداً." };
  return { ok: true, orderNumber: String(data[0].order_seq).padStart(3, "0") };
}
