import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { budgetToExpenseInputs, getActualSpending } from "@/lib/budget/helpers";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyNetIncome,
  calculateMonthlyGrossIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalDebts,
  calculateEmergencyFundMonths,
  calculateDebtPayoff,
  calculateSavingsRate,
  estimateMilestones,
  projectSavings,
  toMonthly,
} from "@/lib/engine/calculator";
import { projectMonthly, projectToGoal } from "@/lib/engine/projections";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profileId = await getActiveProfileId();
  const [incomes, budgetCategories, debts, assets, goals, profile, checkins, plaidItemCount] = await Promise.all([
    prisma.income.findMany({ where: { profileId } }),
    prisma.budgetCategory.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.goal.findMany({ where: { profileId } }),
    prisma.profile.findUnique({ where: { id: profileId }, select: { filingStatus: true, state: true } }),
    prisma.monthlyCheckin.findMany({
      where: { profileId, netWorth: { not: null } },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: { month: true, year: true, netWorth: true },
    }),
    prisma.plaidItem.count({ where: { profileId, isActive: true } }),
  ]);

  const incomeInputs = incomes.map((i) => ({
    id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate, isNetInput: i.isNetInput,
  }));
  const expenseInputs = budgetToExpenseInputs(budgetCategories);
  const debtInputs = debts.map((d) => ({
    id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type, originalLoan: d.originalLoan, loanTermMonths: d.loanTermMonths, collateralValue: d.collateralValue, appreciationRate: d.appreciationRate,
  }));
  const assetInputs = assets.map((a) => ({
    id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution,
  }));
  const goalInputs = goals.map((g) => ({
    id: g.id, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate.toISOString(), priority: g.priority, type: g.type,
  }));

  const state = { incomes: incomeInputs, expenses: expenseInputs, debts: debtInputs, assets: assetInputs, goals: goalInputs };

  // Budget status for the dashboard card (current month actual vs budgeted)
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const actualSpending = await getActualSpending(profileId, currentMonth, currentYear);
  const budgetStatusRows = budgetCategories.map((c) => ({
    category: c.category,
    budgeted: c.monthlyAmount,
    spent: actualSpending[c.category] ?? 0,
  }));

  const monthlyGrossIncome = calculateMonthlyGrossIncome(incomeInputs);
  const monthlyIncome = calculateMonthlyNetIncome(incomeInputs);
  const monthlyExpenses = calculateMonthlyExpenses(expenseInputs);
  const monthlyDebtPayments = calculateMonthlyDebtPayments(debtInputs);
  const totalContributions = assetInputs.reduce((s, a) => s + (a.monthlyContribution || 0), 0);
  const cashFlow = calculateMonthlyCashFlow(incomeInputs, expenseInputs, debtInputs, assetInputs);
  const freeSurplus = cashFlow;
  const netWorth = calculateNetWorth(assetInputs, debtInputs);
  const totalAssets = calculateTotalAssets(assetInputs);
  const totalDebts = calculateTotalDebts(debtInputs);
  const collateralEquity = debtInputs.reduce((sum, d) => {
    if (d.collateralValue && d.collateralValue > 0) return sum + Math.max(0, d.collateralValue - d.balance);
    return sum;
  }, 0);
  const emergencyMonths = calculateEmergencyFundMonths(assetInputs, expenseInputs);
  const savingsRate = calculateSavingsRate(incomeInputs, expenseInputs, debtInputs, assetInputs);
  const projections1yr = projectMonthly(state, 12);
  const projections5yr = projectMonthly(state, 60);
  const debtPayoffs = debtInputs.map((d) => calculateDebtPayoff(d));
  const milestones = estimateMilestones(state);
  const savingsProjection = projectSavings(assetInputs, cashFlow, 60);

  // DTI ratio: total monthly debt payments / gross monthly income
  const dtiRatio = monthlyGrossIncome > 0 ? (monthlyDebtPayments / monthlyGrossIncome) * 100 : 0;

  // Spending breakdown by category
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenseInputs) {
    const cat = e.category.charAt(0).toUpperCase() + e.category.slice(1);
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + toMonthly(e.amount, e.frequency);
  }
  const spendingCategories = [
    ...Object.entries(expensesByCategory).map(([name, amount]) => ({ name, amount, color: "" })),
    ...(monthlyDebtPayments > 0 ? [{ name: "Debt Payments", amount: monthlyDebtPayments, color: "#ef4444" }] : []),
    ...(totalContributions > 0 ? [{ name: "Contributions", amount: totalContributions, color: "#06b6d4" }] : []),
  ];

  // Fixed vs variable expenses
  const fixedExpenses = expenseInputs.filter((e) => e.isFixed).reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const variableExpenses = expenseInputs.filter((e) => !e.isFixed).reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);

  // Asset allocation by type
  const assetTypeMap: Record<string, number> = {};
  for (const a of assetInputs) {
    const t = a.type.charAt(0).toUpperCase() + a.type.slice(1);
    assetTypeMap[t] = (assetTypeMap[t] || 0) + a.value;
  }
  const assetAllocation = Object.entries(assetTypeMap).map(([type, value]) => ({ type, value }));

  // Asset breakdown (individual assets by name)
  const assetBreakdown = assetInputs.map((a) => ({ name: a.name, value: a.value }));

  // Compute auto-tracked current amounts (same logic as goals page)
  const liquidAssetTotal = assetInputs.filter((a) => a.type === "savings" || a.type === "checking").reduce((sum, a) => sum + a.value, 0);
  const investmentAssetTotal = assetInputs.filter((a) => a.type === "investment").reduce((sum, a) => sum + a.value, 0);
  const autoTrackedAmounts: Record<string, number> = {};
  for (const g of goalInputs) {
    switch (g.type) {
      case "net_worth": autoTrackedAmounts[g.id] = netWorth; break;
      case "debt_free": {
        const goalLower = g.name.toLowerCase();
        const matchingDebt = debtInputs.find((d) => goalLower.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(goalLower));
        if (matchingDebt) autoTrackedAmounts[g.id] = Math.max(0, g.targetAmount - matchingDebt.balance);
        break;
      }
      case "emergency_fund": autoTrackedAmounts[g.id] = liquidAssetTotal; break;
      case "retirement": autoTrackedAmounts[g.id] = investmentAssetTotal; break;
      case "purchase": autoTrackedAmounts[g.id] = liquidAssetTotal; break;
    }
  }

  const goalProjections = goalInputs.map((g) => {
    // For debt_free goals, use debt payoff calculation
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
          goalId: g.id, goalName: g.name,
          estimatedMonths: matchingDebt.monthsToPayoff,
          estimatedDate: matchingDebt.payoffDate,
          monthlySavingsNeeded: matchingDebt.monthsToPayoff !== Infinity ? Math.round((matchingDebt.totalPaid / matchingDebt.monthsToPayoff) * 100) / 100 : 0,
          onTrack: matchingDebt.monthsToPayoff !== Infinity,
        };
      }
    }

    // For net_worth and retirement goals, use projectMonthly (compound growth)
    if (g.type === "net_worth" || g.type === "retirement") {
      const snapshots = projectMonthly(state, 360);
      const targetField = g.type === "retirement" ? "totalAssetValue" : "netWorth";
      const hitMonth = snapshots.findIndex((s) => s[targetField] >= g.targetAmount);
      const estimatedMonths = hitMonth >= 0 ? hitMonth : Infinity;
      const targetDate = new Date(g.targetDate);
      const monthsUntilTarget = Math.max(0, (targetDate.getFullYear() - new Date().getFullYear()) * 12 + targetDate.getMonth() - new Date().getMonth());
      const remaining = g.targetAmount - (autoTrackedAmounts[g.id] ?? g.currentAmount);
      const monthlySavingsNeeded = monthsUntilTarget > 0 ? remaining / monthsUntilTarget : Infinity;
      const estimatedDate = new Date();
      if (estimatedMonths !== Infinity) estimatedDate.setMonth(estimatedDate.getMonth() + estimatedMonths);
      return {
        goalId: g.id, goalName: g.name, estimatedMonths,
        estimatedDate: estimatedMonths === Infinity ? "Never" : estimatedDate.toISOString().split("T")[0],
        monthlySavingsNeeded: isFinite(monthlySavingsNeeded) ? Math.round(monthlySavingsNeeded * 100) / 100 : Infinity,
        onTrack: monthsUntilTarget > 0 && estimatedMonths <= monthsUntilTarget,
      };
    }

    const proj = projectToGoal(state, g);
    return { ...proj, goalId: g.id, goalName: g.name };
  });

  return (
    <DashboardClient
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      monthlyDebtPayments={monthlyDebtPayments}
      cashFlow={cashFlow}
      freeSurplus={freeSurplus}
      totalContributions={totalContributions}
      netWorth={netWorth}
      totalAssets={totalAssets}
      totalDebts={totalDebts}
      collateralEquity={collateralEquity}
      emergencyMonths={emergencyMonths}
      savingsRate={savingsRate}
      dtiRatio={Math.round(dtiRatio * 10) / 10}
      projections1yr={projections1yr}
      projections5yr={projections5yr}
      debts={debtInputs}
      debtPayoffs={debtPayoffs}
      goalProjections={goalProjections}
      goals={goalInputs}
      milestones={milestones}
      savingsProjection={savingsProjection}
      spendingCategories={spendingCategories}
      fixedExpenses={fixedExpenses}
      variableExpenses={variableExpenses}
      assetAllocation={assetAllocation}
      assetBreakdown={assetBreakdown}
      netWorthHistory={checkins.filter((c) => c.netWorth != null).map((c) => ({
        label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][c.month - 1]} ${String(c.year).slice(2)}`,
        netWorth: c.netWorth as number,
      }))}
      monthlyGrossIncome={monthlyGrossIncome}
      filingStatus={profile?.filingStatus || null}
      taxState={profile?.state || null}
      hasPlaid={plaidItemCount > 0}
      budgetStatusRows={budgetStatusRows}
    />
  );
}
