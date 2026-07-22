import type { MenuCategoryView, MenuItemView } from "./menu-data";

/**
 * Local menu for DEMO mode (no DB). Same data as supabase/migrations/0003_seed.sql.
 * Ids are stable slugs; the demo order flow doesn't validate them server-side.
 */

const item = (
  id: string,
  name_ar: string,
  price: number,
  opts?: { flavors?: string[]; variants?: [string, number][] },
): MenuItemView => ({
  id,
  name_ar,
  description: null,
  image_url: null,
  price,
  flavors: opts?.flavors ?? [],
  variants: (opts?.variants ?? []).map(([n, p]) => ({ id: `${id}-${p}`, name_ar: n, price: p })),
});

const cat = (name_ar: string, items: MenuItemView[]): MenuCategoryView => ({ name_ar, image_url: null, items });

export const DEMO_MENU: MenuCategoryView[] = [
  cat("المشروبات الساخنة", [
    item("espresso", "إسبريسو", 2500),
    item("double-espresso", "دبل إسبريسو", 3000),
    item("americano", "أمريكانو", 3000),
    item("latte", "لاتيه", 3000),
    item("flavored-latte", "لاتيه منكّه", 3500, { flavors: ["كراميل", "فانيلا", "بندق"] }),
    item("spanish-latte", "سبانش لاتيه", 3500),
    item("caramel-macchiato", "كراميل ماكياتو", 4000),
    item("mocha", "موكا", 4000, { flavors: ["دارك", "وايت"] }),
    item("turkish-coffee", "قهوة تركية", 2500),
    item("choc-coffee", "قهوة بالشوكولاتة", 2500, { variants: [["صغير", 2500], ["وسط", 3500]] }),
    item("hot-chocolate", "هوت شوكليت", 3000),
    item("karak", "شاي كرك", 1500, { variants: [["صغير", 1500], ["وسط", 3000]] }),
  ]),
  cat("المشروبات الباردة", [
    item("ice-americano", "آيس أمريكانو", 3000),
    item("ice-latte", "آيس لاتيه", 3000),
    item("ice-flavored-latte", "آيس لاتيه منكّه", 3500, { flavors: ["كراميل", "فانيلا", "بندق", "هازلنت"] }),
    item("ice-spanish-latte", "آيس سبانش لاتيه", 3500),
    item("ice-caramel-macchiato", "آيس كراميل ماكياتو", 4000),
    item("ice-mocha", "آيس موكا", 4000, { flavors: ["دارك", "وايت"] }),
  ]),
  cat("آيس تي", [
    item("icetea-lemon", "آيس تي ليمون", 3000),
    item("icetea-berry", "آيس تي توت", 3000),
  ]),
  cat("الموهيتو", [
    item("mojito-classic", "موهيتو كلاسيك", 3000),
    item("mojito-soda", "موهيتو صودا", 4000),
    item("mojito-energy", "موهيتو طاقة", 6000),
  ]),
  cat("فرابيه", [
    item("frappe-caramel", "فرابيه كراميل", 4500),
    item("frappe-vanilla", "فرابيه فانيلا", 4500),
  ]),
  cat("ميلك شيك", [
    item("shake-cookies", "ميلك شيك كوكيز", 5000),
    item("shake-oreo", "ميلك شيك أوريو", 5000),
    item("shake-nutella", "ميلك شيك نوتيلا", 5000),
    item("shake-lotus", "ميلك شيك لوتس", 5000),
  ]),
  cat("سموذي", [
    item("smoothie-strawberry", "سموذي فراولة", 3000, { variants: [["صغير", 3000], ["وسط", 5000]] }),
    item("smoothie-pineapple", "سموذي أناناس", 3000, { variants: [["صغير", 3000], ["وسط", 5000]] }),
    item("smoothie-mango", "سموذي مانجو", 3000, { variants: [["صغير", 3000], ["وسط", 5000]] }),
    item("smoothie-pomegranate", "سموذي رمان", 3000, { variants: [["صغير", 3000], ["وسط", 5000]] }),
  ]),
  cat("المعجنات", [
    item("croissant", "كرواسون", 2500),
    item("donut", "دونات", 2500),
    item("cookies", "كوكيز", 2500),
  ]),
];
