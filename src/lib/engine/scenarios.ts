import {
  FinancialState,
  ScenarioChangeInput,
  ScenarioComparison,
  NetWorthAtTimeframe,
  DebtComparisonItem,
  GoalComparisonItem,
} from "./types";
import {
  calculateMonthlyCashFlow,
  calculateNetWorth,
  calculateDebtPayoff,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
} from "./calculator";
import { projectMonthly, applyScenarioChanges, projectToGoal } from "./projections";

/**
 * Compares baseline financial state against a modified scenario.
 * Returns comprehensive diffs across cash flow, net worth projections,
 * debt payoff timelines, goal completion dates, and investable surplus.
 */
export function compareScenarios(
  baselineState: FinancialState,
  changes: ScenarioChangeInput[],
  months: number = 60
): ScenarioComparison {
  const scenarioState = applyScenarioChanges(baselineState, changes);

  // Cash flow comparison
  const baselineCashFlow = calculateMonthlyCashFlow(
    baselineState.incomes, baselineState.expenses, baselineState.debts, baselineState.assets
  );
  const scenarioCashFlow = calculateMonthlyCashFlow(
    scenarioState.incomes, scenarioState.expenses, scenarioState.debts, scenarioState.assets
  );

  // Current net worth
  const baselineNetWorth = calculateNetWorth(baselineState.assets, baselineState.debts);
  const scenarioNetWorth = calculateNetWorth(scenarioState.assets, scenarioState.debts);

  // Full projections
  const baselineProjections = projectMonthly(baselineState, months);
  const scenarioProjections = projectMonthly(scenarioState, months);

  // Net worth at 1yr, 3yr, 5yr
  const timeframes = [
    { label: "1 Year", months: 12 },
    { label: "3 Years", months: 36 },
    { label: "5 Years", months: 60 },
  ];
  const netWorthAtTimeframes: NetWorthAtTimeframe[] = timeframes
    .filter((t) => t.months <= months)
    .map((t) => {
      const bSnap = baselineProjections[Math.min(t.months, baselineProjections.length - 1)];
      const sSnap = scenarioProjections[Math.min(t.months, scenarioProjections.length - 1)];
      return {
        label: t.label,
        months: t.months,
        baseline: Math.round(bSnap.netWorth),
        scenario: Math.round(sSnap.netWorth),
        difference: Math.round(sSnap.netWorth - bSnap.netWorth),
      };
    });

  // Debt payoff comparison
  const debtComparisons: DebtComparisonItem[] = baselineState.debts.map((debt) => {
    const basePayoff = calculateDebtPayoff(debt);
    const scenarioDebt = scenarioState.debts.find((d) => d.id === debt.id);
    const scenPayoff = scenarioDebt
      ? calculateDebtPayoff(scenarioDebt)
      : basePayoff;
    // Guard against Infinity - Infinity = NaN, but preserve -Infinity (scenario got worse)
    const monthsSaved =
      (basePayoff.monthsToPayoff === Infinity && scenPayoff.monthsToPayoff === Infinity) ? 0
      : basePayoff.monthsToPayoff === Infinity ? Infinity
      : scenPayoff.monthsToPayoff === Infinity ? -Infinity
      : basePayoff.monthsToPayoff - scenPayoff.monthsToPayoff;
    const interestSaved =
      (basePayoff.totalInterestPaid === Infinity && scenPayoff.totalInterestPaid === Infinity) ? 0
      : basePayoff.totalInterestPaid === Infinity ? Infinity
      : scenPayoff.totalInterestPaid === Infinity ? -Infinity
      : Math.round((basePayoff.totalInterestPaid - scenPayoff.totalInterestPaid) * 100) / 100;

    return {
      debtId: debt.id,
      debtName: debt.name,
      baselineMonths: basePayoff.monthsToPayoff,
      scenarioMonths: scenPayoff.monthsToPayoff,
      monthsSaved: isNaN(monthsSaved) ? 0 : monthsSaved,
      baselineInterest: basePayoff.totalInterestPaid,
      scenarioInterest: scenPayoff.totalInterestPaid,
      interestSaved: isNaN(interestSaved as number) ? 0 : interestSaved,
    };
  });

  // Goal completion comparison
  const goalComparisons: GoalComparisonItem[] = baselineState.goals.map((goal) => {
    const baseProj = projectToGoal(baselineState, goal);
    const scenProj = projectToGoal(scenarioState, goal);
    const monthsChanged = (baseProj.estimatedMonths === Infinity && scenProj.estimatedMonths === Infinity)
      ? 0
      : baseProj.estimatedMonths - scenProj.estimatedMonths;
    return {
      goalId: goal.id,
      goalName: goal.name,
      baselineMonths: baseProj.estimatedMonths,
      scenarioMonths: scenProj.estimatedMonths,
      monthsChanged: isNaN(monthsChanged) ? 0 : monthsChanged,
      accelerated: monthsChanged > 0,
    };
  });

  // Investable surplus: what's available AFTER contributions already committed
  const baselineContributions = baselineState.assets.reduce((s, a) => s + (a.monthlyContribution || 0), 0);
  const scenarioContributions = scenarioState.assets.reduce((s, a) => s + (a.monthlyContribution || 0), 0);
  const baselineInvestableSurplus = Math.max(0, baselineCashFlow - baselineContributions);
  const scenarioInvestableSurplus = Math.max(0, scenarioCashFlow - scenarioContributions);

  // Generate summary text
  const summaryParts: string[] = [];
  const cashDiff = scenarioCashFlow - baselineCashFlow;
  if (Math.abs(cashDiff) > 1) {
    summaryParts.push(
      cashDiff > 0
        ? `Adds $${Math.abs(Math.round(cashDiff)).toLocaleString()}/mo to your cash flow`
        : `Reduces cash flow by $${Math.abs(Math.round(cashDiff)).toLocaleString()}/mo`
    );
  }

  const nw5yr = netWorthAtTimeframes.find((t) => t.months === 60);
  if (nw5yr && Math.abs(nw5yr.difference) > 100) {
    summaryParts.push(
      nw5yr.difference > 0
        ? `Adds $${Math.abs(nw5yr.difference).toLocaleString()} to net worth over 5 years`
        : `Costs $${Math.abs(nw5yr.difference).toLocaleString()} in net worth over 5 years`
    );
  }

  const totalMonthsSaved = debtComparisons.reduce((sum, d) => sum + d.monthsSaved, 0);
  if (totalMonthsSaved !== 0) {
    summaryParts.push(
      totalMonthsSaved > 0
        ? `Saves ${totalMonthsSaved} months of debt payments`
        : `Adds ${Math.abs(totalMonthsSaved)} months to debt payoff`
    );
  }

  const goalsAccelerated = goalComparisons.filter((g) => g.accelerated && g.monthsChanged > 0);
  const goalsDelayed = goalComparisons.filter((g) => !g.accelerated && g.monthsChanged < 0);
  if (goalsAccelerated.length > 0) {
    summaryParts.push(`Accelerates ${goalsAccelerated.length} goal(s)`);
  }
  if (goalsDelayed.length > 0) {
    summaryParts.push(`Delays ${goalsDelayed.length} goal(s)`);
  }

  return {
    baselineCashFlow: Math.round(baselineCashFlow * 100) / 100,
    scenarioCashFlow: Math.round(scenarioCashFlow * 100) / 100,
    cashFlowDifference: Math.round(cashDiff * 100) / 100,
    baselineNetWorth: Math.round(baselineNetWorth * 100) / 100,
    scenarioNetWorth: Math.round(scenarioNetWorth * 100) / 100,
    netWorthDifference: Math.round((scenarioNetWorth - baselineNetWorth) * 100) / 100,
    baselineProjections,
    scenarioProjections,
    netWorthAtTimeframes,
    debtComparisons,
    goalComparisons,
    baselineInvestableSurplus: Math.round(baselineInvestableSurplus * 100) / 100,
    scenarioInvestableSurplus: Math.round(scenarioInvestableSurplus * 100) / 100,
    investableSurplusDifference: Math.round((scenarioInvestableSurplus - baselineInvestableSurplus) * 100) / 100,
    summaryText: summaryParts.length > 0 ? summaryParts.join(". ") + "." : "No measurable impact detected.",
  };
}
