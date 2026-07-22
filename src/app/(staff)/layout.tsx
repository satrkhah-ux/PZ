import { redirect } from "next/navigation";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { StaffShell } from "@/components/cafe/StaffShell";

// Auth + role are resolved per request (runtime env, session cookie).
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (isDemoServer()) {
    // Demo trial (no Supabase configured): browsable shell, no real data.
    return (
      <StaffShell role="admin" name="وضع تجريبي">
        {children}
      </StaffShell>
    );
  }
  const staff = await getStaff();
  if (!staff) redirect("/sign-in");
  return (
    <StaffShell role={staff.role} name={staff.name}>
      {children}
    </StaffShell>
  );
}
