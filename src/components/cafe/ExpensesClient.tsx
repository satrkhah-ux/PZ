"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addExpense, type ExpenseRow } from "@/lib/cafe/expense-actions";
import { formatIqdLabel } from "@/lib/cafe/money";

const CATEGORIES = ["مشتريات", "رواتب", "إيجار", "كهرباء وماء", "صيانة", "أخرى"];

export function ExpensesClient({ expenses }: { expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await addExpense({ amount: Number(amount), category, note });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المصروفات</h1>

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[160px_180px_1fr_auto]">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">المبلغ (د.ع)</span>
          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            dir="ltr"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">التصنيف</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">ملاحظة (اختياري)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "إضافة"}
        </button>
        {msg && <p className="col-span-full text-sm text-destructive">{msg}</p>}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">اليوم</th>
              <th className="px-4 py-2.5 font-medium">التصنيف</th>
              <th className="px-4 py-2.5 font-medium">المبلغ</th>
              <th className="px-4 py-2.5 font-medium">ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  لا توجد مصروفات مسجّلة.
                </td>
              </tr>
            )}
            {expenses.map((x) => (
              <tr key={x.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5" dir="ltr">
                  {x.business_day}
                </td>
                <td className="px-4 py-2.5">{x.category ?? "—"}</td>
                <td className="px-4 py-2.5 font-semibold">{formatIqdLabel(x.amount)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{x.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
