import { getPublicMenu } from "@/lib/cafe/menu-data";
import { isDemoServer } from "@/lib/cafe/demo";
import { ModernMenuClient } from "@/components/cafe/ModernMenuClient";

export const dynamic = "force-dynamic";

export default async function ModernMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; preview?: string }>;
}) {
  const sp = await searchParams;
  const preview = sp.preview === "v2";
  let menu = await getPublicMenu();
  if (preview) {
    // preview the designer's staged set (products-v2/) without touching the live one
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
