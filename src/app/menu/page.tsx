import { getPublicMenu } from "@/lib/cafe/menu-data";
import { TabletMenuClient } from "@/components/cafe/TabletMenuClient";

export const dynamic = "force-dynamic";

/** المنيو الأساسي للزبون — النظام اللوحي (أقسام يمين + شبكة صور + سلة وطلب).
 *  كل روابط/بطاقات الطاولات تفتح هنا: /menu?t=رقم-الطاولة. */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const menu = await getPublicMenu();
  return <TabletMenuClient menu={menu} table={sp.t ?? null} channel="qr" />;
}
