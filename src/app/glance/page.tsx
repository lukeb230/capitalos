import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
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
  calculateDebtPayoff,
} from "@/lib/engine/calculator";
import { projectToGoal, projectMonthly } from "@/lib/engine/projections";
import { GlanceClient } from "./client";

export const dynamic = "force-dynamic";

export default async function GlancePage() {
  // Use active profile if set, otherwise auto-select the first one.
  // This avoids the /profiles redirect loop that sends users to the
  // full dashboard instead of back to /glance.
  const cookieStore = await cookies();
  let profileId = cookieStore.get("decision-profile-id")?.value;

  if (!profileId) {
    const firstProfile = await prisma.profile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!firstProfile) {
      return (
        <div className="text-center py-20 text-muted-foreground">
          <p>No profiles found. Set up your profile on the desktop app first.</p>
        </div>
      );
    }
    profileId = firstProfile.id;
  }
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [incomes, budgetCategories, debts, assets, goals, lastSyncedItem] =
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
      prisma.goal.findMany({ where: { profileId }, orderBy: { priority: "asc" } }),
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

  // Goal rows for glance
  const goalInputs = goals.map((g) => ({
    id: g.id, name: g.name, targetAmount: g.targetAmount,
    currentAmount: g.currentAmount, targetDate: g.targetDate.toISOString(),
    priority: g.priority, type: g.type,
    linkedAssetId: g.linkedAssetId, linkedDebtId: g.linkedDebtId,
  }));
  const liquidAssetTotal = assetInputs
    .filter((a) => a.type === "savings" || a.type === "checking")
    .reduce((sum, a) => sum + a.value, 0);
  const investmentAssetTotal = assetInputs
    .filter((a) => a.type === "investment")
    .reduce((sum, a) => sum + a.value, 0);
  const state = { incomes: incomeInputs, expenses: expenseInputs, debts: debtInputs, assets: assetInputs, goals: goalInputs };
  const debtPayoffs = debtInputs.map((d) => calculateDebtPayoff(d));

  const goalRows = goalInputs.map((g) => {
    // Auto-tracked current amount
    let currentAmount = g.currentAmount;
    if (g.linkedAssetId) {
      const linked = assetInputs.find((a) => a.id === g.linkedAssetId);
      if (linked) currentAmount = linked.value;
    } else if (g.linkedDebtId) {
      const linked = debtInputs.find((d) => d.id === g.linkedDebtId);
      if (linked) currentAmount = Math.max(0, g.targetAmount - linked.balance);
    } else {
      switch (g.type) {
        case "net_worth": currentAmount = netWorth; break;
        case "debt_free": {
          const goalLower = g.name.toLowerCase();
          const matchingDebt = debtInputs.find(
            (d) => goalLower.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(goalLower),
          );
          if (matchingDebt) currentAmount = Math.max(0, g.targetAmount - matchingDebt.balance);
          break;
        }
        case "emergency_fund": currentAmount = liquidAssetTotal; break;
        case "retirement": currentAmount = investmentAssetTotal; break;
        case "purchase": currentAmount = liquidAssetTotal; break;
      }
    }

    // Determine on-track status
    let onTrack = false;
    if (g.type === "debt_free") {
      const goalLower = g.name.toLowerCase();
      const match = debtPayoffs.find(
        (dp) => goalLower.includes(dp.debtName.toLowerCase()) || dp.debtName.toLowerCase().includes(goalLower),
      );
      onTrack = match ? match.monthsToPayoff !== Infinity : false;
    } else if (g.type === "net_worth" || g.type === "retirement") {
      const snapshots = projectMonthly(state, 360);
      const field = g.type === "retirement" ? "totalAssetValue" : "netWorth";
      const hitMonth = snapshots.findIndex((s) => s[field] >= g.targetAmount);
      const targetDate = new Date(g.targetDate);
      const monthsUntilTarget = Math.max(0, (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth());
      onTrack = hitMonth >= 0 && hitMonth <= monthsUntilTarget;
    } else {
      const proj = projectToGoal(state, g);
      onTrack = proj.onTrack;
    }

    return { name: g.name, currentAmount, targetAmount: g.targetAmount, type: g.type, onTrack };
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
      goalRows={goalRows}
      lastSynced={lastSyncedItem?.lastSynced?.toISOString() ?? null}
    />
  );
}
