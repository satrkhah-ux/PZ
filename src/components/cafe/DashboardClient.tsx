"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DaySummary, RecentOrder } from "@/lib/cafe/dashboard-actions";
import { formatIqd, formatIqdLabel } from "@/lib/cafe/money";

const CHANNEL_AR: Record<string, string> = { qr: "موبايل QR", kiosk: "لوحي", cashier: "كاشير" };
const STATUS_AR: Record<string, string> = { pending: "معلّق", paid: "مدفوع", cancelled: "ملغي", refunded: "مسترجع" };
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  paid: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

export function DashboardClient({
  days,
  summary,
  recent,
}: {
  days: number;
  summary: DaySummary[];
  recent: RecentOrder[];
}) {
  const today = summary[summary.length - 1];
  const totals = summary.reduce(
    (t, d) => ({
      sales: t.sales + d.sales,
      orders: t.orders + d.orders_count,
      profit: t.profit + d.profit,
      expenses: t.expenses + d.expenses,
      net: t.net + d.net,
    }),
    { sales: 0, orders: 0, profit: 0, expenses: 0, net: 0 },
  );
  const chartData = summary.map((d) => ({ ...d, label: d.day.slice(5) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {[
            { d: 1, label: "اليوم" },
            { d: 7, label: "٧ أيام" },
            { d: 30, label: "٣٠ يوم" },
          ].map((o) => (
            <Link
              key={o.d}
              href={`/dashboard?days=${o.d}`}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                days === o.d ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {summary.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          لا توجد بيانات بعد — اضبط اتصال قاعدة البيانات أو سجّل أول طلب.
        </div>
      ) : (
        <>
          {/* today KPIs */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">اليوم ({today?.day})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi label="المبيعات" value={formatIqdLabel(today?.sales ?? 0)} />
              <Kpi label="عدد الطلبات" value={String(today?.orders_count ?? 0)} />
              <Kpi label="الأرباح" value={formatIqdLabel(today?.profit ?? 0)} />
              <Kpi label="المصروفات" value={formatIqdLabel(today?.expenses ?? 0)} />
              <Kpi label="الصافي" value={formatIqdLabel(today?.net ?? 0)} highlight />
            </div>
          </section>

          {/* range totals + chart */}
          {days > 1 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                إجمالي آخر {days === 7 ? "٧ أيام" : "٣٠ يوماً"}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi label="المبيعات" value={formatIqdLabel(totals.sales)} />
                <Kpi label="عدد الطلبات" value={String(totals.orders)} />
                <Kpi label="الأرباح" value={formatIqdLabel(totals.profit)} />
                <Kpi label="المصروفات" value={formatIqdLabel(totals.expenses)} />
                <Kpi label="الصافي" value={formatIqdLabel(totals.net)} highlight />
              </div>
              <div className="rounded-xl border border-border bg-card p-4" dir="ltr">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8a6d3b" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#8a6d3b" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} width={52} tickFormatter={(v: number) => formatIqd(v)} />
                    <Tooltip
                      formatter={(v) => formatIqdLabel(Number(v))}
                      labelFormatter={(l) => `اليوم ${l}`}
                    />
                    <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#8a6d3b" fill="url(#sales)" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#4f7a5a" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* recent orders */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">أحدث الطلبات</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">رقم</th>
                    <th className="px-4 py-2.5 font-medium">القناة</th>
                    <th className="px-4 py-2.5 font-medium">الحالة</th>
                    <th className="px-4 py-2.5 font-medium">المبلغ</th>
                    <th className="px-4 py-2.5 font-medium">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        لا توجد طلبات بعد.
                      </td>
                    </tr>
                  )}
                  {recent.map((o) => (
                    <tr key={o.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-semibold">{String(o.order_seq).padStart(3, "0")}</td>
                      <td className="px-4 py-2.5">{CHANNEL_AR[o.channel] ?? o.channel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[o.status] ?? ""}`}>
                          {STATUS_AR[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{formatIqdLabel(o.subtotal)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground" dir="ltr">
                        {new Date(o.created_at).toLocaleString("en-GB", {
                          timeZone: "Asia/Baghdad",
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className={`text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
