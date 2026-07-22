import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { listCustomers, type CustomerRow } from "@/lib/cafe/loyalty-actions";
import { LoyaltyClient } from "@/components/cafe/LoyaltyClient";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  let customers: CustomerRow[] = [];
  let isAdmin = false;
  try {
    if (!isDemoServer()) {
      const staff = await getStaff();
      isAdmin = staff?.role === "admin";
      if (isAdmin) customers = await listCustomers();
    }
  } catch {
    // empty state
  }
  return <LoyaltyClient customers={customers} isAdmin={isAdmin} />;
}
