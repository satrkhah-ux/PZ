import { redirect } from "next/navigation";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import {
  getRangeOrders,
  getRangeSummary,
  type DaySummary,
  type RangeOrder,
} from "@/lib/cafe/dashboard-actions";
import { isValidRange, presets, RANGE_ORDERS_LIMIT } from "@/lib/cafe/date-range";
import { businessDay, lastNDays } from "@/lib/cafe/time";
import { ReportsClient } from "@/components/cafe/ReportsClient";

export const dynamic = "force-dynamic";

/** «سجل المبيعات» — sales between any two dates plus the full order log.
 *  The range lives in the URL so a period the owner checks often can be
 *  bookmarked, refreshed and shared. */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;

  if (!isDemoServer()) {
    const staff = await getStaff();
    if (staff && staff.role !== "admin") redirect("/cashier");
  }

  const today = businessDay();
  const [defFrom, defTo] = lastNDays(7);
  // A junk or over-long query string falls back to the default rather than
  // erroring — only a range the user typed into the form is worth complaining about.
  const wanted = { from: sp.from ?? "", to: sp.to ?? "" };
  const [from, to] = isValidRange(wanted.from, wanted.to) ? [wanted.from, wanted.to] : [defFrom, defTo];

  let summary: DaySummary[] = [];
  let orders: RangeOrder[] = [];
  let error: string | null = null;
  try {
    [summary, orders] = await Promise.all([getRangeSummary(from, to), getRangeOrders(from, to)]);
  } catch (e) {
    // The range guard speaks Arabic and is meant for the owner; anything else
    // (demo mode, a transient DB failure) renders as an empty report.
    error = e instanceof Error ? e.message : null;
  }

  return (
    <ReportsClient
      from={from}
      to={to}
      todayDate={today}
      presetList={presets(today)}
      summary={summary}
      orders={orders}
      limit={RANGE_ORDERS_LIMIT}
      error={error}
    />
  );
}
