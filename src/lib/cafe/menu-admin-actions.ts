"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "./auth";

export type AdminVariant = {
  id: string;
  name_ar: string;
  price_override: number | null;
  /** null = this size costs whatever the item costs. place_order resolves it as
   *  coalesce(cost_override, item.cost), so a size priced 6000 against a 3500
   *  base is otherwise booked at the base cost and reads as pure profit. */
  cost_override: number | null;
  kind: string;
  sort: number;
};
export type AdminItem = {
  id: string;
  category_id: string;
  name_ar: string;
  description_ar: string | null;
  image_url: string | null;
  price: number;
  cost: number;
  flavors: string[];
  is_active: boolean;
  sort: number;
  variants: AdminVariant[];
};
export type AdminCategory = { id: string; name_ar: string; sort: number; is_active: boolean; items: AdminItem[] };

function revalidateMenu() {
  revalidatePath("/menu-admin");
  revalidatePath("/menu");
  revalidatePath("/kiosk");
  revalidatePath("/cashier");
}

/** Full menu for the admin editor (includes cost — service client only). */
export async function listMenuAdmin(): Promise<AdminCategory[]> {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const [{ data: cats }, { data: items }, { data: vars }] = await Promise.all([
    svc.from("categories").select("id, name_ar, sort, is_active").order("sort"),
    svc.from("menu_items").select("id, category_id, name_ar, description_ar, image_url, price, cost, flavors, is_active, sort").order("sort"),
    svc.from("item_variants").select("id, item_id, name_ar, price_override, cost_override, kind, sort").order("sort"),
  ]);

  const varsByItem = new Map<string, AdminVariant[]>();
  for (const v of vars ?? []) {
    const arr = varsByItem.get(v.item_id) ?? [];
    arr.push({
      id: v.id,
      name_ar: v.name_ar,
      price_override: v.price_override,
      cost_override: v.cost_override,
      kind: v.kind,
      sort: v.sort,
    });
    varsByItem.set(v.item_id, arr);
  }
  const itemsByCat = new Map<string, AdminItem[]>();
  for (const it of items ?? []) {
    const arr = itemsByCat.get(it.category_id) ?? [];
    arr.push({ ...it, variants: varsByItem.get(it.id) ?? [] });
    itemsByCat.set(it.category_id, arr);
  }
  return (cats ?? []).map((c) => ({ ...c, items: itemsByCat.get(c.id) ?? [] }));
}

export async function listCategoriesAdmin() {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { data } = await svc.from("categories").select("id, name_ar, sort, is_active").order("sort");
  return data ?? [];
}

export type ItemInput = {
  id?: string;
  category_id: string;
  name_ar: string;
  description_ar?: string | null;
  image_url?: string | null;
  price: number;
  cost?: number;
  flavors?: string[];
  is_active?: boolean;
  sort?: number;
};

export async function upsertItem(input: ItemInput) {
  await requireAdmin();
  if (!input.name_ar?.trim()) return { ok: false as const, error: "أدخل اسم الصنف." };
  if (!input.category_id) return { ok: false as const, error: "اختر القسم." };
  const svc = createSupabaseServiceClient();
  const row = {
    category_id: input.category_id,
    name_ar: input.name_ar.trim(),
    description_ar: input.description_ar?.trim() || null,
    image_url: input.image_url || null,
    price: Math.max(0, Math.round(input.price || 0)),
    cost: Math.max(0, Math.round(input.cost || 0)),
    flavors: (input.flavors ?? []).map((f) => f.trim()).filter(Boolean),
    is_active: input.is_active ?? true,
    sort: Math.round(input.sort ?? 0),
  };
  const { error } = input.id
    ? await svc.from("menu_items").update(row).eq("id", input.id)
    : await svc.from("menu_items").insert(row);
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

/** Bulk cost entry — the only writer that touches `cost` and nothing else.
 *
 *  Deliberately NOT routed through upsertItem: that rebuilds the whole row from
 *  its input, so a costs screen calling it would also rewrite names, prices,
 *  flavors and is_active from whatever it happened to be holding. Here an item
 *  update carries one column and a variant update carries one column.
 *
 *  53 single-column updates in parallel rather than one RPC: the alternative is
 *  new SQL on a live database that has already drifted ahead of its migrations,
 *  for a screen whose whole job is a one-off data-entry session. */
export async function saveItemCosts(input: {
  items?: { id: string; cost: number }[];
  variants?: { id: string; cost: number }[];
}): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  await requireAdmin();
  const items = input.items ?? [];
  const variants = input.variants ?? [];
  if (!items.length && !variants.length) return { ok: false, error: "لا توجد تغييرات لحفظها." };

  const svc = createSupabaseServiceClient();
  const results = await Promise.all([
    ...items.map(async (r) => ({
      what: r.id,
      error: (await svc.from("menu_items").update({ cost: Math.max(0, Math.round(r.cost)) }).eq("id", r.id)).error,
    })),
    ...variants.map(async (r) => ({
      what: r.id,
      error: (await svc.from("item_variants").update({ cost_override: Math.max(0, Math.round(r.cost)) }).eq("id", r.id)).error,
    })),
  ]);

  const failed = results.filter((r) => r.error);
  // Partial success is reported as failure on purpose: the owner is entering a
  // costing they will then read profit from, so "most of it saved" is the one
  // outcome they must not mistake for success.
  if (failed.length) {
    return { ok: false, error: `تعذّر حفظ ${failed.length} من ${results.length}: ${failed[0].error?.message ?? ""}` };
  }
  revalidateMenu();
  revalidatePath("/costs");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, saved: results.length };
}

export async function toggleItem(id: string, is_active: boolean) {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("menu_items").update({ is_active }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

export async function deleteItem(id: string) {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("menu_items").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

export async function addVariant(itemId: string, name_ar: string, price: number) {
  await requireAdmin();
  if (!name_ar.trim()) return { ok: false as const, error: "أدخل اسم الحجم." };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("item_variants").insert({
    item_id: itemId,
    kind: "size",
    name_ar: name_ar.trim(),
    price_override: Math.max(0, Math.round(price)),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

export async function deleteVariant(id: string) {
  await requireAdmin();
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("item_variants").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

export async function addCategory(name_ar: string, sort = 0) {
  await requireAdmin();
  if (!name_ar.trim()) return { ok: false as const, error: "أدخل اسم القسم." };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("categories").insert({ name_ar: name_ar.trim(), sort: Math.round(sort) });
  if (error) return { ok: false as const, error: error.message };
  revalidateMenu();
  return { ok: true as const };
}

/** Upload an item image → resized webp in the public `menu` bucket. Returns its URL. */
export async function uploadItemImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "لا يوجد ملف." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "الملف ليس صورة." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "الصورة كبيرة جداً (أكثر من 8MB)." };

  const buf = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(buf).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

  const svc = createSupabaseServiceClient();
  const path = `items/${crypto.randomUUID()}.webp`;
  const { error } = await svc.storage.from("menu").upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) return { ok: false, error: error.message };
  const { data } = svc.storage.from("menu").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
