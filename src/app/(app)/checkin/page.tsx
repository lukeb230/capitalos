import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { toMonthly } from "@/lib/engine/calculator";
import CheckinWizard from "./client";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const profileId = await getActiveProfileId();

  const [expenses, checkins] = await Promise.all([
    prisma.expense.findMany({ where: { profileId } }),
    prisma.monthlyCheckin.findMany({
      where: { profileId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true, month: true, year: true, totalIncome: true, totalExpenses: true,
        overallGrade: true, expensesByCategory: true, gradeDetails: true, createdAt: true,
      },
    }),
  ]);

  // Build budget map from expenses
  const budget: Record<string, number> = {};
  for (const e of expenses) {
    const monthly = toMonthly(e.amount, e.frequency);
    budget[e.category] = (budget[e.category] || 0) + monthly;
  }

  return (
    <CheckinWizard
      budget={budget}
      pastCheckins={JSON.parse(JSON.stringify(checkins))}
    />
  );
}
