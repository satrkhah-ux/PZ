import { getPublicMenu } from "@/lib/cafe/menu-data";
import { TabletMenuClient } from "@/components/cafe/TabletMenuClient";

export const dynamic = "force-dynamic";

/** منيو لوحي (أقسام يمين + شبكة صور + سلة وإتمام طلب + مبدّل لون). عام —
 *  /menu/tablet?t=رقم-الطاولة لطلب من الطاولة. */
export default async function TabletMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const menu = await getPublicMenu();
  return <TabletMenuClient menu={menu} table={sp.t ?? null} channel="qr" />;
}
