import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { GoalsClient } from "./client";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyExpenses,
  calculateDebtPayoff,
  calculateNetWorth,
} from "@/lib/engine/calculator";
import { projectToGoal, projectMonthly } from "@/lib/engine/projections";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const profileId = await getActiveProfileId();
  const [profile, goals, incomes, expenses, debts, assets, scenarios] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId }, select: { currentAge: true, retirementAge: true } }),
    prisma.goal.findMany({ where: { profileId }, orderBy: { priority: "asc" } }),
    prisma.income.findMany({ where: { profileId } }),
    prisma.expense.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.scenario.findMany({ where: { profileId, isBaseline: false }, include: { changes: true }, take: 5 }),
  ]);

  const incomeInputs = incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate }));
  const expenseInputs = expenses.map((e) => ({ id: e.id, name: e.name, amount: e.amount, frequency: e.frequency, category: e.category, isFixed: e.isFixed }));
  const debtInputs = debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type, collateralValue: d.collateralValue, appreciationRate: d.appreciationRate }));
  const assetInputs = assets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution }));

  const state = { incomes: incomeInputs, expenses: expenseInputs, debts: debtInputs, assets: assetInputs, goals: [] as typeof goalInputs };

  const cashFlow = calculateMonthlyCashFlow(incomeInputs, expenseInputs, debtInputs, assetInputs);
  const freeSurplus = cashFlow;
  const debtPayoffs = debtInputs.map((d) => calculateDebtPayoff(d));

  const goalInputs = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate.toISOString(),
    priority: g.priority,
    type: g.type,
  }));

  state.goals = goalInputs;

  // Compute auto-tracked current amounts for non-custom goal types
  const liquidAssetTotal = assetInputs
    .filter((a) => a.type === "savings" || a.type === "checking")
    .reduce((sum, a) => sum + a.value, 0);
  const investmentAssetTotal = assetInputs
    .filter((a) => a.type === "investment")
    .reduce((sum, a) => sum + a.value, 0);
  const netWorth = calculateNetWorth(assetInputs, debtInputs);

  const autoTrackedAmounts: Record<string, number> = {};
  for (const g of goalInputs) {
    switch (g.type) {
      case "net_worth":
        autoTrackedAmounts[g.id] = netWorth;
        break;
      case "debt_free": {
        // Try both directions for name matching, then fall back to closest balance match
        const goalLower = g.name.toLowerCase();
        const matchingDebt = debtInputs.find(
          (d) => goalLower.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(goalLower)
        ) || (g.targetAmount > 0
          ? debtInputs.reduce<(typeof debtInputs)[0] | null>((best, d) => {
              const diff = Math.abs(d.balance - g.targetAmount);
              const bestDiff = best ? Math.abs(best.balance - g.targetAmount) : Infinity;
              return diff < bestDiff ? d : best;
            }, null)
          : null);
        if (matchingDebt) {
          autoTrackedAmounts[g.id] = Math.max(0, g.targetAmount - matchingDebt.balance);
        }
        break;
      }
      case "emergency_fund":
        autoTrackedAmounts[g.id] = liquidAssetTotal;
        break;
      case "retirement":
        autoTrackedAmounts[g.id] = investmentAssetTotal;
        break;
      case "purchase":
        autoTrackedAmounts[g.id] = liquidAssetTotal;
        break;
    }
  }

  // Compute projections for each goal
  const goalProjections = goalInputs.map((g) => {
    // For debt_free goals, use debt payoff calculation instead
    if (g.type === "debt_free") {
      const goalLower = g.name.toLowerCase();
      const matchingDebt = debtPayoffs.find(
        (dp) => goalLower.includes(dp.debtName.toLowerCase()) || dp.debtName.toLowerCase().includes(goalLower)
      ) || (g.targetAmount > 0
        ? debtPayoffs.reduce<(typeof debtPayoffs)[0] | null>((best, dp) => {
            const diff = Math.abs(dp.totalPaid - g.targetAmount);
            const bestDiff = best ? Math.abs(best.totalPaid - g.targetAmount) : Infinity;
            return diff < bestDiff ? dp : best;
          }, null)
        : null);
      if (matchingDebt) {
        return {
          goalId: g.id,
          goalName: g.name,
          estimatedMonths: matchingDebt.monthsToPayoff,
          estimatedDate: matchingDebt.payoffDate,
          monthlySavingsNeeded: matchingDebt.monthsToPayoff !== Infinity
            ? Math.round((matchingDebt.totalPaid / matchingDebt.monthsToPayoff) * 100) / 100
            : 0,
          onTrack: matchingDebt.monthsToPayoff !== Infinity,
        };
      }
    }

    // For net_worth and retirement goals, use projectMonthly which accounts for
    // compound asset growth and debt payoff — not just cash surplus accumulation
    if (g.type === "net_worth" || g.type === "retirement") {
      const snapshots = projectMonthly(state, 600);
      const targetField = g.type === "retirement" ? "totalAssetValue" : "netWorth";
      const hitMonth = snapshots.findIndex((s) => s[targetField] >= g.targetAmount);
      const estimatedMonths = hitMonth >= 0 ? hitMonth : Infinity;

      const targetDate = new Date(g.targetDate);
      const monthsUntilTarget = Math.max(0,
        (targetDate.getFullYear() - new Date().getFullYear()) * 12 +
        targetDate.getMonth() - new Date().getMonth()
      );
      const remaining = g.targetAmount - (autoTrackedAmounts[g.id] ?? g.currentAmount);
      const monthlySavingsNeeded = monthsUntilTarget > 0 ? remaining / monthsUntilTarget : Infinity;
      const estimatedDate = new Date();
      if (estimatedMonths !== Infinity) estimatedDate.setMonth(estimatedDate.getMonth() + estimatedMonths);

      return {
        goalId: g.id,
        goalName: g.name,
        estimatedMonths,
        estimatedDate: estimatedMonths === Infinity ? "Never" : estimatedDate.toISOString().split("T")[0],
        monthlySavingsNeeded: isFinite(monthlySavingsNeeded) ? Math.round(monthlySavingsNeeded * 100) / 100 : Infinity,
        onTrack: monthsUntilTarget > 0 && estimatedMonths <= monthsUntilTarget,
      };
    }

    const proj = projectToGoal(state, g);
    return { ...proj, goalId: g.id, goalName: g.name };
  });

  // Compute FI data for the Financial Independence section
  const monthlyExpenses = calculateMonthlyExpenses(expenseInputs);
  const annualExpenses = monthlyExpenses * 12;
  const investmentContributions = assetInputs
    .filter((a) => a.type === "investment")
    .reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);
  const avgGrowthRate = assetInputs.filter((a) => a.type === "investment").length > 0
    ? assetInputs
        .filter((a) => a.type === "investment")
        .reduce((sum, a) => sum + a.growthRate, 0) /
      assetInputs.filter((a) => a.type === "investment").length
    : 8;

  const fiData = {
    annualExpenses,
    currentInvestments: investmentAssetTotal,
    monthlyContributions: investmentContributions,
    defaultGrowthRate: Math.round(avgGrowthRate * 10) / 10,
    profileCurrentAge: profile?.currentAge ?? null,
    profileRetirementAge: profile?.retirementAge ?? 60,
  };

  return (
    <GoalsClient
      items={goalInputs}
      projections={goalProjections}
      cashFlow={freeSurplus}
      debtPayoffs={JSON.parse(JSON.stringify(debtPayoffs))}
      debts={debtInputs}
      autoTrackedAmounts={autoTrackedAmounts}
      fiData={fiData}
    />
  );
}
