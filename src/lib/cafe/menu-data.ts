import { isDemoServer } from "./demo";
import { DEMO_MENU } from "./demo-menu";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MenuVariantView = { id: string; name_ar: string; price: number };
export type MenuItemView = {
  id: string;
  name_ar: string;
  description: string | null;
  image_url: string | null;
  price: number;
  flavors: string[];
  variants: MenuVariantView[];
};
export type MenuCategoryView = { name_ar: string; image_url: string | null; items: MenuItemView[] };

/** The public menu (active items only). Demo → local seed; real → cost-free DB views. */
export async function getPublicMenu(): Promise<MenuCategoryView[]> {
  if (isDemoServer()) return DEMO_MENU;

  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: vars }] = await Promise.all([
    supabase.from("menu_public").select("*").order("category_sort").order("sort"),
    supabase.from("variant_public").select("*").order("sort"),
  ]);

  const varsByItem = new Map<string, MenuVariantView[]>();
  for (const v of vars ?? []) {
    const arr = varsByItem.get(v.item_id) ?? [];
    arr.push({ id: v.id, name_ar: v.name_ar, price: v.price });
    varsByItem.set(v.item_id, arr);
  }

  const cats = new Map<string, MenuCategoryView>();
  for (const r of rows ?? []) {
    let c = cats.get(r.category_name);
    if (!c) {
      c = { name_ar: r.category_name, image_url: r.category_image, items: [] };
      cats.set(r.category_name, c);
    }
    c.items.push({
      id: r.id,
      name_ar: r.name_ar,
      description: r.description_ar,
      image_url: r.image_url,
      price: r.price,
      flavors: r.flavors ?? [],
      variants: varsByItem.get(r.id) ?? [],
    });
  }
  return [...cats.values()];
}
