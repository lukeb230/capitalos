import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
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
  const [incomes, expenses, debts, assets, goals] = await Promise.all([
    prisma.income.findMany({ where: { profileId } }),
    prisma.expense.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.goal.findMany({ where: { profileId } }),
  ]);

  const incomeInputs = incomes.map((i) => ({
    id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate,
  }));
  const expenseInputs = expenses.map((e) => ({
    id: e.id, name: e.name, amount: e.amount, frequency: e.frequency, category: e.category, isFixed: e.isFixed,
  }));
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

  const goalProjections = goalInputs.map((g) => {
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
    />
  );
}
