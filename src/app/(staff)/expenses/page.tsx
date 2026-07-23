import { listExpenses, getRegisterClosures, type ExpenseRow, type RegisterClosure } from "@/lib/cafe/expense-actions";
import { getStaff } from "@/lib/cafe/auth";
import { isDemoServer } from "@/lib/cafe/demo";
import { ExpensesClient } from "@/components/cafe/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  let expenses: ExpenseRow[] = [];
  let closures: { today: RegisterClosure | null; previous: RegisterClosure | null } = { today: null, previous: null };
  let isAdmin = false;
  try {
    if (!isDemoServer()) {
      const staff = await getStaff();
      isAdmin = staff?.role === "admin";
      [expenses, closures] = await Promise.all([listExpenses(), getRegisterClosures()]);
    }
  } catch {
    // signed-out / demo — empty state
  }
  return <ExpensesClient expenses={expenses} closures={closures} isAdmin={isAdmin} />;
}
