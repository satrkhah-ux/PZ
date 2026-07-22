import { getServerUser, createSupabaseServiceClient } from "@/lib/supabase/server";

/** Resolved staff identity. Server-only. */
export type StaffRole = "admin" | "cashier";
export type Staff = {
  userId: string;
  employeeId: string;
  name: string;
  email: string | null;
  role: StaffRole | null;
};

/** The current signed-in staff member, or null. Uses the service client to read
 *  the employees/roles tables reliably (after the auth token is validated). */
export async function getStaff(): Promise<Staff | null> {
  const user = await getServerUser();
  if (!user) return null;

  const svc = createSupabaseServiceClient();
  const { data: emp } = await svc
    .from("employees")
    .select("id, name_ar, role_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!emp) return null;

  let role: StaffRole | null = null;
  if (emp.role_id) {
    const { data: r } = await svc.from("roles").select("name_en").eq("id", emp.role_id).maybeSingle();
    role = r?.name_en === "admin" ? "admin" : r?.name_en === "cashier" ? "cashier" : null;
  }
  return { userId: user.id, employeeId: emp.id, name: emp.name_ar, email: user.email ?? null, role };
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new Error("غير مصرّح — سجّل الدخول.");
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") throw new Error("هذه الصفحة للمدير فقط.");
  return staff;
}
