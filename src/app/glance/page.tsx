import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import {
  budgetToExpenseInputs,
  getActualSpending,
  getEffectiveBudget,
  categoryLabel,
} from "@/lib/budget/helpers";
import {
  calculateMonthlyNetIncome,
  calculateMonthlyGrossIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalDebts,
  calculateEmergencyFundMonths,
  calculateSavingsRate,
  calculateMonthlyCashFlow,
} from "@/lib/engine/calculator";
import { GlanceClient } from "./client";

export const dynamic = "force-dynamic";

export default async function GlancePage() {
  const profileId = await getActiveProfileId();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [incomes, budgetCategories, debts, assets, lastSyncedItem] =
    await Promise.all([
      prisma.income.findMany({ where: { profileId } }),
      prisma.budgetCategory.findMany({
        where: { profileId },
        include: {
          overrides: { where: { month, year } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.debt.findMany({ where: { profileId } }),
      prisma.asset.findMany({ where: { profileId } }),
      prisma.plaidItem.findFirst({
        where: { profileId, isActive: true },
        orderBy: { lastSynced: "desc" },
        select: { lastSynced: true },
      }),
    ]);

  const actualSpending = await getActualSpending(profileId, month, year);

  // Map to engine inputs
  const incomeInputs = incomes.map((i) => ({
    id: i.id,
    name: i.name,
    amount: i.amount,
    frequency: i.frequency,
    taxRate: i.taxRate,
    isNetInput: i.isNetInput,
  }));
  const expenseInputs = budgetToExpenseInputs(budgetCategories);
  const debtInputs = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
    type: d.type,
  }));
  const assetInputs = assets.map((a) => ({
    id: a.id,
    name: a.name,
    value: a.value,
    type: a.type,
    growthRate: a.growthRate,
    monthlyContribution: a.monthlyContribution,
  }));

  // Calculations
  const monthlyIncome = calculateMonthlyNetIncome(incomeInputs);
  const monthlyGrossIncome = calculateMonthlyGrossIncome(incomeInputs);
  const monthlyExpenses = calculateMonthlyExpenses(expenseInputs);
  const monthlyDebtPayments = calculateMonthlyDebtPayments(debtInputs);
  const totalContributions = assetInputs.reduce(
    (s, a) => s + (a.monthlyContribution || 0),
    0,
  );
  const cashFlow = calculateMonthlyCashFlow(
    incomeInputs,
    expenseInputs,
    debtInputs,
    assetInputs,
  );
  const netWorth = calculateNetWorth(assetInputs, debtInputs);
  const totalAssets = calculateTotalAssets(assetInputs);
  const totalDebts = calculateTotalDebts(debtInputs);
  const emergencyMonths = calculateEmergencyFundMonths(
    assetInputs,
    expenseInputs,
  );
  const savingsRate = calculateSavingsRate(
    incomeInputs,
    expenseInputs,
    debtInputs,
    assetInputs,
  );
  const dtiRatio =
    monthlyGrossIncome > 0
      ? Math.round((monthlyDebtPayments / monthlyGrossIncome) * 1000) / 10
      : 0;

  // Budget status with overrides
  const currentOverrides = await prisma.budgetOverride.findMany({
    where: {
      budgetCategory: { profileId },
      month,
      year,
    },
  });
  const overrideMap = new Map(
    currentOverrides.map((o) => [o.budgetCategoryId, o]),
  );

  const budgetRows = budgetCategories.map((c) => {
    const override = overrideMap.get(c.id) ?? null;
    const eff = getEffectiveBudget(c.monthlyAmount, c.rolloverEnabled, override);
    return {
      category: c.category,
      label: categoryLabel(c.category),
      budgeted: eff.amount,
      spent: actualSpending[c.category] ?? 0,
    };
  });

  return (
    <GlanceClient
      month={month}
      year={year}
      netWorth={netWorth}
      totalAssets={totalAssets}
      totalDebts={totalDebts}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      monthlyDebtPayments={monthlyDebtPayments}
      totalContributions={totalContributions}
      cashFlow={cashFlow}
      savingsRate={savingsRate}
      emergencyMonths={emergencyMonths}
      dtiRatio={dtiRatio}
      budgetRows={budgetRows}
      lastSynced={lastSyncedItem?.lastSynced?.toISOString() ?? null}
    />
  );
}
