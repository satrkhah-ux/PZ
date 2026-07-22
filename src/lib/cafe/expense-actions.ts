"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "./auth";
import { businessDay } from "./time";

export type ExpenseRow = {
  id: string;
  business_day: string;
  amount: number;
  category: string | null;
  note: string | null;
};

export async function addExpense(input: { amount: number; category?: string; note?: string }) {
  const staff = await requireAdmin();
  const amount = Math.max(0, Math.round(input.amount));
  if (amount <= 0) return { ok: false as const, error: "أدخل مبلغاً صحيحاً." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("expenses").insert({
    amount,
    category: input.category?.trim() || null,
    note: input.note?.trim() || null,
    business_day: businessDay(),
    created_by: staff.employeeId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function listExpenses(limit = 60): Promise<ExpenseRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, business_day, amount, category, note")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ExpenseRow[];
}
