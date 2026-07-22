import { getPublicMenu } from "@/lib/cafe/menu-data";
import { isDemoServer } from "@/lib/cafe/demo";
import { MenuOrderClient } from "@/components/cafe/MenuOrderClient";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const menu = await getPublicMenu();
  return <MenuOrderClient menu={menu} channel="kiosk" demo={isDemoServer()} />;
}
