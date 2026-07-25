import { getPublicMenu } from "@/lib/cafe/menu-data";
import { getActiveTableNames } from "@/lib/cafe/table-actions";
import { CashierClient } from "@/components/cafe/CashierClient";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const [menu, tables] = await Promise.all([getPublicMenu(), getActiveTableNames().catch(() => [])]);
  return <CashierClient menu={menu} tables={tables} />;
}
