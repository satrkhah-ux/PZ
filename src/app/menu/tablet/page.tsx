import { getPublicMenu } from "@/lib/cafe/menu-data";
import { TabletMenuClient } from "@/components/cafe/TabletMenuClient";

export const dynamic = "force-dynamic";

/** منيو لوحي (تجريبي للعرض): أقسام على اليمين قابلة للتمرير + شبكة صور، مع
 *  مبدّل لون قهوائي/فيروزي. عام (بلا تسجيل دخول) — /menu/tablet. */
export default async function TabletMenuPage() {
  const menu = await getPublicMenu();
  return <TabletMenuClient menu={menu} />;
}
