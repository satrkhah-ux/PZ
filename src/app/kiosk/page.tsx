import { getPublicMenu } from "@/lib/cafe/menu-data";
import { isDemoServer } from "@/lib/cafe/demo";
import { ModernMenuClient } from "@/components/cafe/ModernMenuClient";

export const dynamic = "force-dynamic";

/** المنيو اللوحي — نفس المودرن التفاعلي لكن بقناة kiosk للتقارير. */
export default async function KioskPage() {
  const menu = await getPublicMenu();
  return <ModernMenuClient menu={menu} channel="kiosk" demo={isDemoServer()} />;
}
