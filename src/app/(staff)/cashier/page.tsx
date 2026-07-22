import { getPublicMenu } from "@/lib/cafe/menu-data";
import { CashierClient } from "@/components/cafe/CashierClient";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const menu = await getPublicMenu();
  return <CashierClient menu={menu} />;
}
