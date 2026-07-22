import { listExpenses, type ExpenseRow } from "@/lib/cafe/expense-actions";
import { ExpensesClient } from "@/components/cafe/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  let expenses: ExpenseRow[] = [];
  try {
    expenses = await listExpenses();
  } catch {
    // demo mode / non-admin — empty state
  }
  return <ExpensesClient expenses={expenses} />;
}
