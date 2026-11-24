"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, HandCoins, Trash2, Wallet } from "lucide-react";
import {
  addDebtEntry,
  deleteDebtEntry,
  listDebtEntries,
  type DebtEntry,
  type Debtor,
} from "@/lib/cafe/debt-actions";
import { formatIqdLabel } from "@/lib/cafe/money";
import { PriceInput } from "./PriceInput";

export function DebtsClient({ debtors, outstanding }: { debtors: Debtor[]; outstanding: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  /** The amount field counts THOUSANDS, so «5000» means five million. That exact
   *  slip put a 5,000,000 payment on a customer once; anything this large is far
   *  more likely a typo than a real movement, so make it say so out loud. */
  const BIG = 500_000;

  async function submit(kind: "debit" | "credit") {
    if (busy) return;
    if (amount >= BIG && !window.confirm(`المبلغ ${amount.toLocaleString("en-US")} د.ع — مبلغ كبير. متأكد؟`)) return;
    setMsg(null);
    setBusy(true);
    const res = await addDebtEntry({ customer_name: name, amount, kind, note });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setAmount(0);
    setNote("");
    // keep the name so a quick follow-up on the same customer is easy
    router.refresh();
  }

  async function toggleLog(name: string) {
    if (openName === name) {
      setOpenName(null);
      return;
    }
    setOpenName(name);
    setLoadingLog(true);
    try {
      setEntries(await listDebtEntries(name));
    } catch {
      setEntries([]);
    } finally {
      setLoadingLog(false);
    }
  }

  async function removeEntry(e: DebtEntry, name: string) {
    const what = `${e.kind === "debit" ? "دَيْن" : "تسديد"} ${e.amount.toLocaleString("en-US")} د.ع`;
    if (!window.confirm(`حذف ${what}؟ لا يمكن التراجع.`)) return;
    const res = await deleteDebtEntry(e.id);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setEntries(await listDebtEntries(name));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wallet className="size-6 text-primary" />
          سجل الديون
        </h1>
        <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-5 py-2 text-center">
          <p className="text-xs text-muted-foreground">إجمالي الديون المستحقة</p>
          <p className="text-2xl font-extrabold tabular-nums text-destructive">{formatIqdLabel(outstanding)}</p>
        </div>
      </div>

      {/* add / settle */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="debtor-names"
          placeholder="اسم العميل"
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <datalist id="debtor-names">
          {debtors.map((d) => (
            <option key={d.customer_name} value={d.customer_name} />
          ))}
        </datalist>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">المبلغ:</span>
          <PriceInput value={amount} onChange={setAmount} />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          placeholder="الملاحظة (إلزامية) — مثلاً: طلب اليوم، تسديد جزئي…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => submit("debit")}
            disabled={busy || !note.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 py-3 font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <HandCoins className="size-4" />
            دَيْن على العميل
          </button>
          <button
            onClick={() => submit("credit")}
            disabled={busy || !note.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            💵 تسديد دفعة
          </button>
        </div>
      </div>

      {/* debtors */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">العملاء المدينون</h2>
        {debtors.filter((d) => d.balance !== 0).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">لا توجد ديون مستحقة.</p>
        ) : (
          /* every debtor with any movement — a name used to DISAPPEAR from this
             list the moment its balance went negative, which is how a wrong
             entry could hide a real customer for weeks. */
          debtors
            .filter((d) => d.balance !== 0)
            .map((d) => {
              const over = d.balance < 0;
              return (
                <div key={d.customer_name} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 p-3.5">
                    <button
                      onClick={() => {
                        setName(d.customer_name);
                        setMsg(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="min-w-0 flex-1 text-right"
                    >
                      <p className="font-bold">{d.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        إجمالي الدين {formatIqdLabel(d.total_debt)} · سُدّد {formatIqdLabel(d.total_paid)}
                      </p>
                    </button>
                    <div className="shrink-0 text-left">
                      <p className={`text-lg font-extrabold tabular-nums ${over ? "text-primary" : "text-destructive"}`}>
                        {formatIqdLabel(Math.abs(d.balance))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{over ? "له عندنا — راجع السجل" : "المتبقّي"}</p>
                    </div>
                    <button
                      onClick={() => toggleLog(d.customer_name)}
                      aria-label="سجل الحركات"
                      className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
                    >
                      <ChevronDown className={`size-4 transition ${openName === d.customer_name ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {openName === d.customer_name && (
                    <div className="border-t border-border/60 p-3 text-sm">
                      {loadingLog ? (
                        <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>
                      ) : entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">لا توجد حركات.</p>
                      ) : (
                        <ul className="space-y-1">
                          {entries.map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground" dir="ltr">
                                {new Date(e.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Baghdad" })}
                              </span>
                              <span className={e.kind === "debit" ? "text-destructive" : "text-primary"}>
                                {e.kind === "debit" ? "دَيْن" : "تسديد"} {formatIqdLabel(e.amount)}
                              </span>
                              <button
                                onClick={() => removeEntry(e, d.customer_name)}
                                aria-label="حذف الحركة"
                                className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">حذف الحركات للإدارة فقط.</p>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
