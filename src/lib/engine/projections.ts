import {
  FinancialState,
  MonthlySnapshot,
  GoalProjection,
  ScenarioChangeInput,
} from "./types";
import {
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
} from "./calculator";

/**
 * Projects financial state forward month by month.
 *
 * Key accounting rules:
 * - Net cash flow = income - expenses - debt payments (dynamic per month)
 * - Monthly asset contributions come OUT of cash flow (not free money)
 * - Remaining surplus after contributions goes to savings
 * - When a debt is paid off, its payment frees up as additional surplus
 * - Asset growth rates compound monthly on current balance
 */
export function projectMonthly(state: FinancialState, months: number): MonthlySnapshot[] {
  const snapshots: MonthlySnapshot[] = [];
  const now = new Date();

  // Clone balances for mutation
  const debtBalances: Record<string, number> = {};
  state.debts.forEach((d) => (debtBalances[d.id] = d.balance));

  const assetValues: Record<string, number> = {};
  state.assets.forEach((a) => (assetValues[a.id] = a.value));

  const monthlyIncome = calculateMonthlyNetIncome(state.incomes);
  const monthlyExpenses = calculateMonthlyExpenses(state.expenses);

  // Total committed monthly contributions across all assets
  const totalContributions = state.assets.reduce(
    (sum, a) => sum + (a.monthlyContribution || 0),
    0
  );

  let cumulativeUnallocatedSurplus = 0;

  for (let m = 0; m <= months; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    let actualDebtPayments = 0;
    let contributionRatio = 1;
    if (m > 0) {
      // Calculate actual debt payments this month (may be less if debt is paid off)
      for (const debt of state.debts) {
        if (debtBalances[debt.id] > 0.01) {
          const monthlyRate = debt.interestRate / 100 / 12;
          const interest = debtBalances[debt.id] * monthlyRate;
          debtBalances[debt.id] += interest;

          // Pay the minimum or remaining balance, whichever is less
          const payment = Math.min(debt.minimumPayment, debtBalances[debt.id]);
          debtBalances[debt.id] -= payment;
          actualDebtPayments += payment;

          if (debtBalances[debt.id] < 0.01) debtBalances[debt.id] = 0;
        }
      }

      // End-of-month contribution assumption: growth compounds on prior month's balance
      // before this month's contribution is added. A common simplification in personal
      // finance tools (~$5-15K difference over 30 years vs beginning-of-month).
      for (const asset of state.assets) {
        const monthlyRate = (asset.growthRate || 0) / 100 / 12;
        assetValues[asset.id] *= 1 + monthlyRate;
      }

      // Cap contributions to available cash flow — don't spend more than you have
      const availableForContributions = Math.max(0, monthlyIncome - monthlyExpenses - actualDebtPayments);
      contributionRatio = totalContributions > 0 && totalContributions > availableForContributions
        ? availableForContributions / totalContributions
        : 1;

      // Apply monthly contributions to assets (scaled down if exceeding available cash)
      for (const asset of state.assets) {
        if (asset.monthlyContribution && asset.monthlyContribution > 0) {
          assetValues[asset.id] += asset.monthlyContribution * contributionRatio;
        }
      }

      const actualContributions = totalContributions * contributionRatio;

      // Calculate remaining surplus AFTER contributions and debt payments
      const surplus = monthlyIncome - monthlyExpenses - actualDebtPayments - actualContributions;

      // Only add positive surplus to liquid accounts (savings or checking)
      if (surplus > 0) {
        const liquidAsset = state.assets.find((a) => a.type === "savings" || a.type === "checking");
        if (liquidAsset) {
          assetValues[liquidAsset.id] += surplus;
        } else {
          // No liquid accounts — track surplus separately
          cumulativeUnallocatedSurplus += surplus;
        }
      }
    }

    const totalDebtBalance = Object.values(debtBalances).reduce((s, v) => s + v, 0);
    const totalAssetValue = Object.values(assetValues).reduce((s, v) => s + v, 0);
    const effectiveAssetValue = totalAssetValue + cumulativeUnallocatedSurplus;

    // Use actual debt payments computed in the simulation loop above (not recalculated)
    const monthDebtPayments = m > 0
      ? actualDebtPayments
      : state.debts.reduce((sum, d) => sum + (debtBalances[d.id] > 0.01 ? d.minimumPayment : 0), 0);

    snapshots.push({
      month: m,
      label,
      totalIncome: Math.round(monthlyIncome * 100) / 100,
      totalExpenses: Math.round(monthlyExpenses * 100) / 100,
      totalDebtPayments: Math.round(monthDebtPayments * 100) / 100,
      netCashFlow: Math.round(
        (monthlyIncome - monthlyExpenses - monthDebtPayments - totalContributions * contributionRatio) * 100
      ) / 100,
      totalDebtBalance: Math.round(totalDebtBalance * 100) / 100,
      totalAssetValue: Math.round(effectiveAssetValue * 100) / 100,
      netWorth: Math.round((effectiveAssetValue - totalDebtBalance) * 100) / 100,
      debtBalances: { ...debtBalances },
      assetValues: { ...assetValues },
    });
  }

  return snapshots;
}

/**
 * Estimates when a goal will be reached based on available surplus.
 * Surplus = income - expenses - debt payments - asset contributions.
 */
export function projectToGoal(
  state: FinancialState,
  goal: { targetAmount: number; currentAmount: number; targetDate: string }
): Omit<GoalProjection, "goalId" | "goalName"> {
  // Goal already met
  if (goal.currentAmount >= goal.targetAmount) {
    return {
      estimatedMonths: 0,
      estimatedDate: new Date().toISOString().split("T")[0],
      monthlySavingsNeeded: 0,
      onTrack: true,
    };
  }

  const monthlyIncome = calculateMonthlyNetIncome(state.incomes);
  const monthlyExpenses = calculateMonthlyExpenses(state.expenses);
  const totalContributions = state.assets.reduce(
    (sum, a) => sum + (a.monthlyContribution || 0),
    0
  );

  // Simulate month-by-month to account for freed debt payments
  const remaining = goal.targetAmount - goal.currentAmount;
  const debtBalances = state.debts.map((d) => ({ balance: d.balance, rate: d.interestRate, payment: d.minimumPayment }));
  let accumulated = 0;
  let estimatedMonths = Infinity;

  for (let m = 1; m <= 1200; m++) {
    // Calculate current debt payments (only for debts still active)
    let currentDebtPayments = 0;
    for (const debt of debtBalances) {
      if (debt.balance > 0.01) {
        debt.balance += debt.balance * (debt.rate / 100 / 12);
        const payment = Math.min(debt.payment, debt.balance);
        debt.balance -= payment;
        currentDebtPayments += payment;
      }
    }

    const availableForContributions = Math.max(0, monthlyIncome - monthlyExpenses - currentDebtPayments);
    const cappedContributions = Math.min(totalContributions, availableForContributions);
    const surplus = availableForContributions - cappedContributions;

    accumulated += surplus;
    if (accumulated >= remaining) {
      estimatedMonths = m;
      break;
    }
  }

  const estimatedDate = new Date();
  if (estimatedMonths !== Infinity) {
    estimatedDate.setMonth(estimatedDate.getMonth() + estimatedMonths);
  }

  const targetDate = new Date(goal.targetDate);
  const monthsUntilTarget = Math.max(
    0,
    (targetDate.getFullYear() - new Date().getFullYear()) * 12 +
      targetDate.getMonth() -
      new Date().getMonth()
  );
  // Past-date goals: can't calculate meaningful monthly savings
  const monthlySavingsNeeded =
    monthsUntilTarget > 0 ? remaining / monthsUntilTarget : Infinity;

  return {
    estimatedMonths,
    estimatedDate:
      estimatedMonths === Infinity
        ? "Never"
        : estimatedDate.toISOString().split("T")[0],
    monthlySavingsNeeded: isFinite(monthlySavingsNeeded) ? Math.round(monthlySavingsNeeded * 100) / 100 : Infinity,
    onTrack: monthsUntilTarget > 0 && estimatedMonths <= monthsUntilTarget,
  };
}

/**
 * Projects when a goal linked to a specific asset or debt will be reached,
 * using that entity's contribution/payment rate and growth/interest rate.
 */
export function projectLinkedGoal(
  goal: { targetAmount: number; targetDate: string },
  linked: { currentValue: number; monthlyContribution: number; annualRate: number; isDebt: boolean },
): Omit<GoalProjection, "goalId" | "goalName"> {
  const currentAmount = linked.isDebt
    ? Math.max(0, goal.targetAmount - linked.currentValue)
    : linked.currentValue;

  if (currentAmount >= goal.targetAmount) {
    return { estimatedMonths: 0, estimatedDate: new Date().toISOString().split("T")[0], monthlySavingsNeeded: 0, onTrack: true };
  }

  const monthlyRate = (linked.annualRate || 0) / 100 / 12;
  let value = linked.currentValue;
  let estimatedMonths = Infinity;

  if (linked.isDebt) {
    // Simulate debt paydown
    for (let m = 1; m <= 1200; m++) {
      value += value * (monthlyRate); // interest accrues
      const payment = Math.min(linked.monthlyContribution, value);
      value -= payment;
      if (value <= 0.01) { estimatedMonths = m; break; }
    }
  } else {
    // Simulate asset growth with contributions
    for (let m = 1; m <= 1200; m++) {
      value = value * (1 + monthlyRate) + linked.monthlyContribution;
      if (value >= goal.targetAmount) { estimatedMonths = m; break; }
    }
  }

  const estimatedDate = new Date();
  if (estimatedMonths !== Infinity) estimatedDate.setMonth(estimatedDate.getMonth() + estimatedMonths);

  const targetDate = new Date(goal.targetDate);
  const monthsUntilTarget = Math.max(0, (targetDate.getFullYear() - new Date().getFullYear()) * 12 + targetDate.getMonth() - new Date().getMonth());
  const remaining = goal.targetAmount - currentAmount;
  const monthlySavingsNeeded = monthsUntilTarget > 0 ? remaining / monthsUntilTarget : Infinity;

  return {
    estimatedMonths,
    estimatedDate: estimatedMonths === Infinity ? "Never" : estimatedDate.toISOString().split("T")[0],
    monthlySavingsNeeded: isFinite(monthlySavingsNeeded) ? Math.round(monthlySavingsNeeded * 100) / 100 : Infinity,
    onTrack: monthsUntilTarget > 0 && estimatedMonths <= monthsUntilTarget,
  };
}

export function applyScenarioChanges(
  state: FinancialState,
  changes: ScenarioChangeInput[]
): FinancialState {
  const newState: FinancialState = {
    incomes: state.incomes.map((i) => ({ ...i })),
    expenses: state.expenses.map((e) => ({ ...e })),
    debts: state.debts.map((d) => ({ ...d })),
    assets: state.assets.map((a) => ({ ...a })),
    goals: state.goals.map((g) => ({ ...g })),
  };

  for (const change of changes) {
    const collection = newState[
      (change.entityType + "s") as keyof FinancialState
    ] as unknown as Array<Record<string, unknown>>;
    const entity = collection?.find((e) => e.id === change.entityId);
    if (entity) {
      // Handle type coercion: only coerce known numeric fields to numbers
      const NUMERIC_FIELDS = new Set([
        "amount", "balance", "interestRate", "minimumPayment", "value",
        "growthRate", "monthlyContribution", "taxRate", "targetAmount",
        "currentAmount", "priority", "originalLoan", "loanTermMonths",
        "collateralValue", "appreciationRate",
      ]);
      const val = change.newValue;
      if (val === "true") {
        entity[change.field] = true;
      } else if (val === "false") {
        entity[change.field] = false;
      } else if (NUMERIC_FIELDS.has(change.field)) {
        const num = Number(val);
        entity[change.field] = isNaN(num) ? entity[change.field] : num;
      } else {
        entity[change.field] = val;
      }
    }
  }

  return newState;
}
