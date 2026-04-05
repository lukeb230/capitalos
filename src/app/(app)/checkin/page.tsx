import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { toMonthly, calculateNetWorth } from "@/lib/engine/calculator";
import CheckinWizard from "./client";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const profileId = await getActiveProfileId();

  const [expenses, assets, debts, checkins] = await Promise.all([
    prisma.expense.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
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

  const assetInputs = assets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution }));
  const debtInputs = debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type }));
  const currentNetWorth = calculateNetWorth(assetInputs, debtInputs);

  return (
    <CheckinWizard
      budget={budget}
      currentNetWorth={currentNetWorth}
      pastCheckins={JSON.parse(JSON.stringify(checkins))}
    />
  );
}
