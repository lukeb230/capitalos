import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { getActualSpending } from "@/lib/budget/helpers";
import { calculateMonthlyNetIncome } from "@/lib/engine/calculator";
import { BudgetClient } from "./client";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const profileId = await getActiveProfileId();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [categories, incomes, assets] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { profileId },
      include: { overrides: { where: { month, year } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.income.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
  ]);

  const actualSpending = await getActualSpending(profileId, month, year);

  const incomeInputs = incomes.map((i) => ({
    id: i.id,
    name: i.name,
    amount: i.amount,
    frequency: i.frequency,
    taxRate: i.taxRate,
    isNetInput: i.isNetInput,
  }));
  const monthlyNetIncome = calculateMonthlyNetIncome(incomeInputs);

  // Investment contributions: sum monthlyContribution from investment-type assets
  const investmentContributions = assets
    .filter((a) => a.type === "investment")
    .map((a) => ({ name: a.name, amount: a.monthlyContribution }))
    .filter((a) => a.amount > 0);

  return (
    <BudgetClient
      initialCategories={JSON.parse(JSON.stringify(categories))}
      initialActual={actualSpending}
      initialMonth={month}
      initialYear={year}
      monthlyNetIncome={monthlyNetIncome}
      investmentContributions={investmentContributions}
    />
  );
}
