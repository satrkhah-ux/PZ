import { redirect } from "next/navigation";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { getPastryAlertCount } from "@/lib/cafe/pastry-actions";
import { StaffShell } from "@/components/cafe/StaffShell";

// Auth + role are resolved per request (runtime env, session cookie).
export const dynamic = "force-dynamic";

// Staff screens install as the separate «إدارة بيزارا» PWA (admin badge icon,
// opens on the dashboard) instead of the customer menu app.
export const metadata = { manifest: "/admin-manifest.webmanifest" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const pushKey = process.env.WEB_PUSH_PUBLIC_KEY ?? null;
  if (isDemoServer()) {
    // Demo trial (no Supabase configured): browsable shell, no real data.
    return (
      <StaffShell role="admin" name="وضع تجريبي" pushKey={pushKey}>
        {children}
      </StaffShell>
    );
  }
  const staff = await getStaff();
  // `rejected=1` means the SERVER refused this session — not that the access
  // token merely expired. The sign-in form must not bounce such a session back
  // here, or the two navigate at each other forever. Only this layer knows the
  // difference: a deactivated employee holds a token getUser() still accepts.
  if (!staff) redirect("/sign-in?rejected=1");
  const pastryAlert = await getPastryAlertCount().catch(() => 0);
  return (
    <StaffShell role={staff.role} name={staff.name} pushKey={pushKey} pastryAlert={pastryAlert}>
      {children}
    </StaffShell>
  );
}
