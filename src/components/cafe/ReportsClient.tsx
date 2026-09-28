"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarSearch, Search } from "lucide-react";
import type { DaySummary, RangeOrder } from "@/lib/cafe/dashboard-actions";
import type { Preset } from "@/lib/cafe/date-range";
import { formatIqdLabel } from "@/lib/cafe/money";
import { orderCode } from "@/lib/cafe/order-code";

const CHANNEL_AR: Record<string, string> = { qr: "طاولة", kiosk: "كشك", cashier: "كاشير" };

/** «سجل المبيعات» — any two dates, a day-by-day rollup, and every order in the
 *  period with its items.
 *
 *  The period numbers come from range_summary (the same source as the dashboard,
 *  so the two screens can never disagree); the order list is a separate capped
 *  query. Profit is deliberately absent — item costs aren't entered, so it would
 *  just repeat the sales figure. */
export function ReportsClient({
  from,
  to,
  todayDate,
  presetList,
  summary,
  orders,
  limit,
  error,
}: {
  from: string;
  to: string;
  todayDate: string;
  presetList: Preset[];
  summary: DaySummary[];
  orders: RangeOrder[];
  limit: number;
  error: string | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(true);

  const totals = summary.reduce(
    (a, d) => ({
      sales: a.sales + d.sales,
      orders_count: a.orders_count + d.orders_count,
      expenses: a.expenses + d.expenses,
      net: a.net + d.net,
    }),
    { sales: 0, orders_count: 0, expenses: 0, net: 0 },
  );
  const discounts = orders.reduce((s, o) => s + (o.discount ?? 0), 0);
  const avgOrder = totals.orders_count > 0 ? Math.round(totals.sales / totals.orders_count) : 0;
  const rows = hideEmpty ? summary.filter((d) => d.orders_count > 0 || d.expenses > 0) : summary;
  const truncated = orders.length >= limit;

  function apply() {
    router.push(`/reports?from=${f}&to=${t}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarSearch className="size-6 text-primary" />
          سجل المبيعات
        </h1>
        <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
          → لوحة التحكم
        </Link>
      </div>

      {/* اختيار المدة */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">من</span>
            <input
              type="date"
              value={f}
              max={todayDate}
              onChange={(e) => setF(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              dir="ltr"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">إلى</span>
            <input
              type="date"
              value={t}
              max={todayDate}
              onChange={(e) => setT(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              dir="ltr"
            />
          </label>
          <button
            onClick={apply}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Search className="size-4" />
            عرض
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {presetList.map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <Link
                key={p.key}
                href={`/reports?from=${p.from}&to=${p.to}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">{error}</p>
      ) : (
        <>
          {/* إجمالي المدة */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              الإجمالي من <b className="text-foreground" dir="ltr">{from}</b> إلى{" "}
              <b className="text-foreground" dir="ltr">{to}</b>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Card label="المبيعات" value={formatIqdLabel(totals.sales)} />
              <Card label="عدد الطلبات" value={String(totals.orders_count)} />
              <Card label="متوسط الطلب" value={formatIqdLabel(avgOrder)} />
              <Card label="المصروفات" value={formatIqdLabel(totals.expenses)} />
              <Card label="الصافي" value={formatIqdLabel(totals.net)} highlight />
            </div>
            {discounts > 0 && (
              <p className="text-xs text-muted-foreground">
                مجموع الخصومات في الطلبات المعروضة: <b className="text-foreground">{formatIqdLabel(discounts)}</b> — مخصومة أصلاً من المبيعات أعلاه.
              </p>
            )}
          </section>

          {/* التفصيل اليومي */}
          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">التفصيل اليومي</h2>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
                إخفاء الأيام بلا حركة
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                    <th className="px-3 py-2 text-start font-medium">الطلبات</th>
                    <th className="px-3 py-2 text-start font-medium">المبيعات</th>
                    <th className="px-3 py-2 text-start font-medium">المصروفات</th>
                    <th className="px-3 py-2 text-start font-medium">الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        لا حركة في هذه المدة.
                      </td>
                    </tr>
                  )}
                  {rows.map((d) => (
                    <tr key={d.day} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{d.day}</td>
                      <td className="px-3 py-2 tabular-nums">{d.orders_count}</td>
                      <td className="px-3 py-2">{formatIqdLabel(d.sales)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatIqdLabel(d.expenses)}</td>
                      <td className="px-3 py-2 font-semibold">{formatIqdLabel(d.net)}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold">
                      <td className="px-3 py-2">المجموع</td>
                      <td className="px-3 py-2 tabular-nums">{totals.orders_count}</td>
                      <td className="px-3 py-2">{formatIqdLabel(totals.sales)}</td>
                      <td className="px-3 py-2">{formatIqdLabel(totals.expenses)}</td>
                      <td className="px-3 py-2">{formatIqdLabel(totals.net)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {/* سجل الطلبات */}
          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              سجل الطلبات ({orders.length}) — اضغط على أي طلب لعرض أصنافه
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                    <th className="px-3 py-2 text-start font-medium">الطلب</th>
                    <th className="px-3 py-2 text-start font-medium">الوقت</th>
                    <th className="px-3 py-2 text-start font-medium">القناة</th>
                    <th className="px-3 py-2 text-start font-medium">المدفوع</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        لا توجد طلبات في هذه المدة.
                      </td>
                    </tr>
                  )}
                  {orders.map((o) => (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                        className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40"
                        title="اضغط لعرض تفاصيل الطلب"
                      >
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{o.business_day}</td>
                        <td className="px-3 py-2 font-semibold">
                          {String(o.order_seq).padStart(3, "0")}
                          <span className="ms-2 text-xs font-normal text-muted-foreground">
                            كود {orderCode(o.order_seq, o.business_day)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                          {new Date(o.created_at).toLocaleTimeString("en-GB", {
                            timeZone: "Asia/Baghdad",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2">
                          {CHANNEL_AR[o.channel] ?? o.channel}
                          {o.table_no ? ` ${o.table_no}` : ""}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {formatIqdLabel(o.total)}
                          {o.discount > 0 && (
                            <span className="ms-1 text-xs font-normal text-destructive">(خصم {formatIqdLabel(o.discount)})</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === o.id && (
                        <tr className="border-b border-border/60 bg-secondary/30">
                          <td colSpan={5} className="px-5 py-3">
                            <ul className="space-y-0.5 text-sm">
                              {o.items.map((it, i) => (
                                <li key={i} className="flex justify-between">
                                  <span>
                                    {it.name_ar}
                                    {it.flavor_ar ? ` (${it.flavor_ar})` : ""} ×{it.qty}
                                  </span>
                                  <span className="text-muted-foreground">{formatIqdLabel(it.line_total)}</span>
                                </li>
                              ))}
                              {o.discount > 0 && (
                                <li className="flex justify-between text-destructive">
                                  <span>الخصم</span>
                                  <span>−{formatIqdLabel(o.discount)}</span>
                                </li>
                              )}
                              {o.extra > 0 && (
                                <li className="flex justify-between text-primary">
                                  <span>إضافات{o.extra_note ? ` (${o.extra_note})` : ""}</span>
                                  <span>+{formatIqdLabel(o.extra)}</span>
                                </li>
                              )}
                              <li className="flex justify-between border-t border-border/60 pt-1 font-bold">
                                <span>المدفوع</span>
                                <span>{formatIqdLabel(o.total)}</span>
                              </li>
                              {o.note && <li className="pt-1 text-xs text-muted-foreground">📝 {o.note}</li>}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {truncated && (
              <p className="text-xs text-muted-foreground">
                عرض أحدث {limit} طلب فقط — ضيّق المدة لرؤية الباقي. الأرقام أعلاه كاملة وغير منقوصة.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              لا يظهر الربح لأن كلفة الأصناف غير مُدخلة في المنيو — أدخلها ليُحتسب الربح تلقائياً.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className={`text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
