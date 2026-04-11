import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { budgetToExpenseInputs } from "@/lib/budget/helpers";
import { CompareClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CompareScenarios() {
  const profileId = await getActiveProfileId();

  const scenarios = await prisma.scenario.findMany({
    where: { profileId },
    include: { changes: true },
    orderBy: { createdAt: "desc" },
  });

  const [incomes, budgetCategories, debts, assets, goals] = await Promise.all([
    prisma.income.findMany({ where: { profileId } }),
    prisma.budgetCategory.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.goal.findMany({ where: { profileId } }),
  ]);

  const financialState = {
    incomes: incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate })),
    expenses: budgetToExpenseInputs(budgetCategories),
    debts: debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type, originalLoan: d.originalLoan, loanTermMonths: d.loanTermMonths })),
    assets: assets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution })),
    goals: goals.map((g) => ({ id: g.id, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate.toISOString(), priority: g.priority, type: g.type })),
  };

  return (
    <CompareClient
      scenarios={JSON.parse(JSON.stringify(scenarios))}
      financialState={financialState}
    />
  );
}
