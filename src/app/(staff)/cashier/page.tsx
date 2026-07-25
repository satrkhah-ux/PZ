import { getPublicMenu } from "@/lib/cafe/menu-data";
import { getActiveTableNames } from "@/lib/cafe/table-actions";
import { DEFAULT_TABLES } from "@/lib/cafe/tables";
import { CashierClient } from "@/components/cafe/CashierClient";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  // demo mode (no session) throws in getActiveTableNames → fall back to defaults so dine-in still works
  const [menu, tables] = await Promise.all([getPublicMenu(), getActiveTableNames().catch(() => DEFAULT_TABLES)]);
  return <CashierClient menu={menu} tables={tables} />;
}
