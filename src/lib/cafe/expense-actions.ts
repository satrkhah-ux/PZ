"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { businessDay } from "./time";

export type ExpenseRow = {
  id: string;
  business_day: string;
  amount: number;
  category: string | null;
  note: string | null;
};

/** Any staff member records expenses (the cashier pays for ice, milk, …).
 *  Service client behind the staff gate — expenses has admin-only RLS. */
export async function addExpense(input: { amount: number; category?: string; note?: string }) {
  const staff = await requireStaff();
  const amount = Math.max(0, Math.round(input.amount));
  if (amount <= 0) return { ok: false as const, error: "أدخل مبلغاً صحيحاً." };

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("expenses").insert({
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

/** Admin sees the full history; the cashier sees today's expenses only. */
export async function listExpenses(limit = 60): Promise<ExpenseRow[]> {
  const staff = await requireStaff();
  const svc = createSupabaseServiceClient();
  let q = svc
    .from("expenses")
    .select("id, business_day, amount, category, note")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (staff.role !== "admin") q = q.eq("business_day", businessDay());
  const { data } = await q;
  return (data ?? []) as ExpenseRow[];
}

// ── daily register closure (إغلاق الصندوق) ──────────────────────────────────

export type RegisterClosure = { business_day: string; remaining: number; note: string | null };

/** Record how much cash stays in the drawer at close (upsert — re-saving
 *  the same day just updates the amount). */
export async function saveRegisterClosure(input: { remaining: number; note?: string }) {
  const staff = await requireStaff();
  const remaining = Math.max(0, Math.round(input.remaining));
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("register_closures").upsert(
    {
      business_day: businessDay(),
      remaining,
      note: input.note?.trim() || null,
      closed_by: staff.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_day" },
  );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/expenses");
  return { ok: true as const };
}

/** Today's saved closure (if any) + the most recent previous one. */
export async function getRegisterClosures(): Promise<{ today: RegisterClosure | null; previous: RegisterClosure | null }> {
  await requireStaff();
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("register_closures")
    .select("business_day, remaining, note")
    .order("business_day", { ascending: false })
    .limit(2);
  const rows = (data ?? []) as RegisterClosure[];
  const day = businessDay();
  const today = rows.find((r) => r.business_day === day) ?? null;
  const previous = rows.find((r) => r.business_day !== day) ?? null;
  return { today, previous };
}
