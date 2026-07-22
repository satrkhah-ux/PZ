import { getPublicMenu } from "@/lib/cafe/menu-data";
import { isDemoServer } from "@/lib/cafe/demo";
import { ModernMenuClient } from "@/components/cafe/ModernMenuClient";

export const dynamic = "force-dynamic";

/** المنيو الأساسي — المودرن التفاعلي (كل روابط وQR الطاولات تفتح هنا).
 *  ?preview=v2 يعاين صور المصمم المرشّحة، و/menu/classic للنسخة الكلاسيكية. */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; preview?: string }>;
}) {
  const sp = await searchParams;
  const preview = sp.preview === "v2";
  let menu = await getPublicMenu();
  if (preview) {
    menu = menu.map((c) => ({
      ...c,
      items: c.items.map((it) => ({
        ...it,
        image_url: it.image_url?.replace("/products/", "/products-v2/") ?? null,
      })),
    }));
  }
  return <ModernMenuClient menu={menu} table={sp.t ?? null} demo={isDemoServer()} preview={preview} />;
}
