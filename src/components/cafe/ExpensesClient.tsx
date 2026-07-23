"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addExpense, saveRegisterClosure, type ExpenseRow, type RegisterClosure } from "@/lib/cafe/expense-actions";
import { formatIqdLabel } from "@/lib/cafe/money";

// recurring monthly bills — tap a chip to prefill the category
const MONTHLY = ["الإيجار", "الكهرباء", "المولد", "المياه"];
const CATEGORIES = ["مشتريات", "رواتب", ...MONTHLY, "صيانة", "أخرى"];

export function ExpensesClient({
  expenses,
  closures,
  isAdmin,
}: {
  expenses: ExpenseRow[];
  closures: { today: RegisterClosure | null; previous: RegisterClosure | null };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // إغلاق الصندوق — remaining cash kept in the drawer at day end
  const [remaining, setRemaining] = useState(closures.today ? String(closures.today.remaining) : "");
  const [closeNote, setCloseNote] = useState(closures.today?.note ?? "");
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  async function submitClosure(e: React.FormEvent) {
    e.preventDefault();
    setCloseBusy(true);
    setCloseMsg(null);
    const res = await saveRegisterClosure({ remaining: Number(remaining), note: closeNote });
    setCloseBusy(false);
    setCloseMsg(res.ok ? "تم حفظ إغلاق الصندوق ✅" : res.error);
    if (res.ok) router.refresh();
  }

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

  function quickMonthly(cat: string) {
    setCategory(cat);
    document.getElementById("expense-amount")?.focus();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المصروفات</h1>

      {/* monthly recurring bills — quick prefill */}
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">🗓️ المصروفات الشهرية</h2>
        <div className="flex flex-wrap gap-2">
          {MONTHLY.map((c) => (
            <button
              key={c}
              onClick={() => quickMonthly(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                category === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">اضغط الصنف ثم أدخل المبلغ في نموذج المصروف بالأسفل.</p>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[160px_180px_1fr_auto]">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">المبلغ (د.ع)</span>
          <input
            id="expense-amount"
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

      {/* daily register closure */}
      <form onSubmit={submitClosure} className="space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">🏦 إغلاق الصندوق اليومي</h2>
          {closures.previous && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              متبقي {closures.previous.business_day}: {formatIqdLabel(closures.previous.remaining)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          في نهاية الدوام سجّل المبلغ الذي يبقى في القاصة (مثلاً 25,000 كصرافة ليوم غد). يظهر في التقرير الليلي على التليجرام.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">المبلغ المتبقي في القاصة (د.ع)</span>
            <input
              type="number"
              min={0}
              required
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              className="w-44 rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </label>
          <label className="min-w-40 flex-1 space-y-1 text-sm">
            <span className="text-muted-foreground">ملاحظة (اختياري)</span>
            <input
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={closeBusy}
            className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {closeBusy ? "…" : closures.today ? "تحديث الإغلاق" : "حفظ الإغلاق"}
          </button>
        </div>
        {closures.today && (
          <p className="text-sm font-semibold text-primary">إغلاق اليوم محفوظ: {formatIqdLabel(closures.today.remaining)}</p>
        )}
        {closeMsg && <p className="text-sm text-muted-foreground">{closeMsg}</p>}
      </form>

      {!isAdmin && <p className="text-xs text-muted-foreground">تُعرض مصروفات اليوم فقط — السجل الكامل عند الإدارة.</p>}

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
