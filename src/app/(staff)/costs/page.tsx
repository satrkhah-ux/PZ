import { redirect } from "next/navigation";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { listMenuAdmin, type AdminCategory } from "@/lib/cafe/menu-admin-actions";
import { CostsClient } from "@/components/cafe/CostsClient";

export const dynamic = "force-dynamic";

/** «كلف الأصناف» — bulk cost entry for the whole menu.
 *  Reuses the menu editor's own loader, which already reads cost and sizes
 *  through the service client. */
export default async function CostsPage() {
  if (!isDemoServer()) {
    const staff = await getStaff();
    if (staff && staff.role !== "admin") redirect("/cashier");
  }

  let categories: AdminCategory[] = [];
  try {
    categories = await listMenuAdmin();
  } catch {
    // demo mode / non-admin — empty state
  }
  return <CostsClient categories={categories} />;
}
