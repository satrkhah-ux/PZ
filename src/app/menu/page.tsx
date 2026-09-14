import { Suspense } from "react";
import { getPublicMenu } from "@/lib/cafe/menu-data";
import { getActiveItemOffers } from "@/lib/cafe/pastry-actions";
import { TabletMenuClient } from "@/components/cafe/TabletMenuClient";
import { MenuWithTable } from "@/components/cafe/MenuWithTable";

/** STATIC, re-generated at most once a minute.
 *
 *  This is the busiest page (every customer at every table). It used to be
 *  force-dynamic, so each visit ran a serverless function; on Netlify a cold start
 *  is 7-17s and anything past 10s is killed — customers and the cashier were
 *  fighting over the same slow Lambdas. Served from the CDN it costs nothing and
 *  loads instantly. The table number (?t=) is read in the browser, so every NFC
 *  tag and QR sticker keeps working unchanged. */
export const revalidate = 60;

/** المنيو الأساسي للزبون — النظام اللوحي (أقسام يمين + شبكة صور + سلة وطلب).
 *  كل روابط/بطاقات الطاولات تفتح هنا: /menu?t=رقم-الطاولة. */
export default async function MenuPage() {
  const [menu, offers] = await Promise.all([getPublicMenu(), getActiveItemOffers().catch(() => ({}))]);
  return (
    <Suspense fallback={<TabletMenuClient menu={menu} channel="qr" offers={offers} />}>
      <MenuWithTable menu={menu} offers={offers} />
    </Suspense>
  );
}
