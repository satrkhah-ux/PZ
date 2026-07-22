import { redirect } from "next/navigation";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { getRangeSummary, getRecentOrders, type DaySummary, type RecentOrder } from "@/lib/cafe/dashboard-actions";
import { lastNDays } from "@/lib/cafe/time";
import { DashboardClient } from "@/components/cafe/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = sp.days === "30" ? 30 : sp.days === "1" ? 1 : 7;

  if (!isDemoServer()) {
    const staff = await getStaff();
    if (staff && staff.role !== "admin") redirect("/cashier");
  }

  let summary: DaySummary[] = [];
  let recent: RecentOrder[] = [];
  try {
    const [from, to] = lastNDays(days);
    [summary, recent] = await Promise.all([getRangeSummary(from, to), getRecentOrders(12)]);
  } catch {
    // demo mode or transient DB failure — render the empty state below
  }

  return <DashboardClient days={days} summary={summary} recent={recent} />;
}
