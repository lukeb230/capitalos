import {
  IncomeInput,
  ExpenseInput,
  DebtInput,
  AssetInput,
  DebtPayoffResult,
  FinancialState,
  MilestoneEstimate,
  SavingsProjectionPoint,
} from "./types";

export function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "annual":
      return amount / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "weekly":
      return (amount * 52) / 12;
    default:
      return amount;
  }
}

export function calculateMonthlyGrossIncome(incomes: IncomeInput[]): number {
  return incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
}

export function calculateMonthlyNetIncome(incomes: IncomeInput[]): number {
  return incomes.reduce((sum, i) => {
    const monthly = toMonthly(i.amount, i.frequency);
    return sum + monthly * (1 - i.taxRate / 100);
  }, 0);
}

export function calculateMonthlyExpenses(expenses: ExpenseInput[]): number {
  return expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
}

export function calculateMonthlyDebtPayments(debts: DebtInput[]): number {
  return debts.reduce((sum, d) => sum + d.minimumPayment, 0);
}

export function calculateMonthlyCashFlow(
  incomes: IncomeInput[],
  expenses: ExpenseInput[],
  debts: DebtInput[],
  assets?: AssetInput[]
): number {
  const contributions = assets
    ? assets.reduce((sum, a) => sum + (a.monthlyContribution || 0), 0)
    : 0;
  return (
    calculateMonthlyNetIncome(incomes) -
    calculateMonthlyExpenses(expenses) -
    calculateMonthlyDebtPayments(debts) -
    contributions
  );
}

export function calculateNetWorth(assets: AssetInput[], debts: DebtInput[]): number {
  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
  const totalDebts = debts.reduce((sum, d) => sum + d.balance, 0);
  return totalAssets - totalDebts;
}

export function calculateTotalAssets(assets: AssetInput[]): number {
  return assets.reduce((sum, a) => sum + a.value, 0);
}

export function calculateTotalDebts(debts: DebtInput[]): number {
  return debts.reduce((sum, d) => sum + d.balance, 0);
}

export function calculateDebtPayoff(
  debt: DebtInput,
  extraPayment: number = 0
): DebtPayoffResult {
  // Already paid off
  if (debt.balance <= 0) {
    return {
      debtId: debt.id,
      debtName: debt.name,
      monthsToPayoff: 0,
      totalInterestPaid: 0,
      totalPaid: 0,
      payoffDate: new Date().toISOString().split("T")[0],
    };
  }

  const monthlyRate = debt.interestRate / 100 / 12;
  const payment = debt.minimumPayment + extraPayment;
  let balance = debt.balance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600; // 50 year cap

  if (payment <= 0 || payment <= balance * monthlyRate) {
    return {
      debtId: debt.id,
      debtName: debt.name,
      monthsToPayoff: Infinity,
      totalInterestPaid: Infinity,
      totalPaid: Infinity,
      payoffDate: "Never",
    };
  }

  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance = Math.round((balance + interest - payment) * 100) / 100;
    if (balance < 0) balance = 0;
    months++;
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    debtId: debt.id,
    debtName: debt.name,
    monthsToPayoff: months,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((debt.balance + totalInterest) * 100) / 100,
    payoffDate: months >= 360 ? "30+ years" : payoffDate.toISOString().split("T")[0],
    effectivelyUnpayable: months >= 360,
  };
}

export function calculateInvestmentGrowth(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  let value = principal;

  for (let i = 0; i < months; i++) {
    value = value * (1 + monthlyRate) + monthlyContribution;
  }

  return Math.round(value * 100) / 100;
}

export function calculateEmergencyFundMonths(
  assets: AssetInput[],
  expenses: ExpenseInput[]
): number {
  const liquidAssets = assets
    .filter((a) => a.type === "savings")
    .reduce((sum, a) => sum + a.value, 0);
  const monthlyExpenses = calculateMonthlyExpenses(expenses);
  if (monthlyExpenses === 0) return 999;
  return Math.round((liquidAssets / monthlyExpenses) * 10) / 10;
}

/**
 * Savings rate = (income - expenses - debt payments) / net income.
 * Contributions count AS savings (they're money you're keeping),
 * so we don't subtract them here.
 * A healthy savings rate is 20%+. Returns 0-100 scale.
 */
export function calculateSavingsRate(
  incomes: IncomeInput[],
  expenses: ExpenseInput[],
  debts: DebtInput[],
  assets?: AssetInput[]
): number {
  void assets; // accepted for API consistency but not used — contributions ARE savings
  const netIncome = calculateMonthlyNetIncome(incomes);
  if (netIncome <= 0) return 0;
  const saved = netIncome - calculateMonthlyExpenses(expenses) - calculateMonthlyDebtPayments(debts);
  return Math.round((Math.max(0, saved) / netIncome) * 1000) / 10;
}

/**
 * Projects savings account growth over time, assuming surplus cash flow
 * is deposited monthly. Includes interest earned on savings.
 */
export function projectSavings(
  assets: AssetInput[],
  monthlySurplus: number,
  months: number
): SavingsProjectionPoint[] {
  const points: SavingsProjectionPoint[] = [];
  const now = new Date();

  // Separate savings from investments
  let savings = assets
    .filter((a) => a.type === "savings")
    .reduce((sum, a) => sum + a.value, 0);
  let investments = assets
    .filter((a) => a.type === "investment")
    .reduce((sum, a) => sum + a.value, 0);

  // Use weighted average growth rates from actual assets (fall back to defaults)
  const savingsAssets = assets.filter((a) => a.type === "savings");
  const investmentAssets = assets.filter((a) => a.type === "investment");
  const weightedSavingsRate = savings > 0
    ? savingsAssets.reduce((sum, a) => sum + a.growthRate * a.value, 0) / savings
    : 4.5;
  const weightedInvestmentRate = investments > 0
    ? investmentAssets.reduce((sum, a) => sum + a.growthRate * a.value, 0) / investments
    : 8;
  const savingsMonthlyRate = weightedSavingsRate / 100 / 12;
  const investmentMonthlyRate = weightedInvestmentRate / 100 / 12;

  for (let m = 0; m <= months; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    if (m > 0) {
      const savingsContributions = assets
        .filter((a) => a.type === "savings")
        .reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);
      const investmentContributions = assets
        .filter((a) => a.type === "investment")
        .reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);
      const totalContributions = assets.reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);
      // Cap contributions to available surplus (consistent with projectMonthly)
      const contributionRatio = totalContributions > 0 && totalContributions > monthlySurplus
        ? Math.max(0, monthlySurplus) / totalContributions
        : 1;
      const adjustedSurplus = Math.max(0, monthlySurplus - totalContributions * contributionRatio);
      savings = savings * (1 + savingsMonthlyRate) + savingsContributions * contributionRatio + adjustedSurplus;
      investments = investments * (1 + investmentMonthlyRate) + investmentContributions * contributionRatio;
    }

    points.push({
      month: m,
      label,
      savings: Math.round(savings * 100) / 100,
      investments: Math.round(investments * 100) / 100,
      totalLiquid: Math.round((savings + investments) * 100) / 100,
    });
  }

  return points;
}

/**
 * Estimates when key financial milestones will be reached.
 * Uses current trajectory (cash flow + asset growth) to project forward.
 */
export function estimateMilestones(state: FinancialState): MilestoneEstimate[] {
  const milestones: MilestoneEstimate[] = [];
  const now = new Date();
  const netIncome = calculateMonthlyNetIncome(state.incomes);
  const totalExpenses = calculateMonthlyExpenses(state.expenses);
  const debtPayments = calculateMonthlyDebtPayments(state.debts);
  const totalContributions = state.assets.reduce(
    (sum, a) => sum + (a.monthlyContribution || 0), 0
  );
  const cashFlow = netIncome - totalExpenses - debtPayments - totalContributions;
  // Monthly interest charged across all debts (the actual cost, vs debt payments which include principal)
  const monthlyInterest = state.debts.reduce((sum, d) => sum + d.balance * d.interestRate / 100 / 12, 0);
  const currentNetWorth = calculateNetWorth(state.assets, state.debts);
  const totalDebt = calculateTotalDebts(state.debts);
  const totalAssets = calculateTotalAssets(state.assets);
  const savingsContributions = state.assets
    .filter((a) => a.type === "savings")
    .reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);

  // Milestone: Debt-free date
  if (totalDebt > 0) {
    // Simulate month-by-month debt payoff
    const debtBalances = state.debts.map((d) => ({ ...d, currentBalance: d.balance }));
    let months = 0;
    const maxMonths = 600;
    let allPaid = false;

    while (!allPaid && months < maxMonths) {
      months++;
      allPaid = true;

      // Total payment pool = sum of ALL minimum payments (freed payments stay in pool)
      let totalPayment = debtBalances.reduce((sum, d) => sum + d.minimumPayment, 0);

      // Apply interest
      for (const debt of debtBalances) {
        if (debt.currentBalance > 0.01) {
          debt.currentBalance += debt.currentBalance * (debt.interestRate / 100 / 12);
        }
      }

      // Re-sort active debts by interest rate each iteration (avalanche method)
      const activeDebts = debtBalances
        .filter(d => d.currentBalance > 0.01)
        .sort((a, b) => b.interestRate - a.interestRate);

      // Pay minimums first
      for (const debt of activeDebts) {
        const payment = Math.min(debt.minimumPayment, debt.currentBalance);
        debt.currentBalance -= payment;
        totalPayment -= payment;
      }

      // Apply freed surplus to highest-interest debt
      for (const debt of activeDebts) {
        if (totalPayment <= 0) break;
        if (debt.currentBalance > 0.01) {
          const extra = Math.min(totalPayment, debt.currentBalance);
          debt.currentBalance -= extra;
          totalPayment -= extra;
        }
      }

      for (const debt of debtBalances) {
        if (debt.currentBalance > 0.01) { allPaid = false; break; }
      }
    }

    const debtFreeDate = new Date(now);
    debtFreeDate.setMonth(debtFreeDate.getMonth() + months);

    milestones.push({
      name: "Debt Free",
      targetValue: 0,
      currentValue: totalDebt,
      estimatedMonths: allPaid ? months : Infinity,
      estimatedDate: allPaid ? debtFreeDate.toISOString().split("T")[0] : "Never",
      achievable: allPaid,
    });
  }

  // Milestone: $100K net worth
  if (currentNetWorth < 100000) {
    const weightedGrowth100 = state.assets.reduce((sum, a) => sum + a.value * (a.growthRate / 100 / 12), 0);
    // NW change = income - expenses - interest + assetGrowth (contributions are internal transfers)
    const monthlyGrowth = netIncome - totalExpenses - monthlyInterest + weightedGrowth100;
    const remaining = 100000 - currentNetWorth;
    const months = monthlyGrowth > 0 ? Math.ceil(remaining / monthlyGrowth) : Infinity;
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);

    milestones.push({
      name: "$100K Net Worth",
      targetValue: 100000,
      currentValue: currentNetWorth,
      estimatedMonths: months === Infinity ? Infinity : months,
      estimatedDate: months === Infinity ? "Never" : date.toISOString().split("T")[0],
      achievable: months !== Infinity && months < 600,
    });
  }

  // Milestone: 6-month emergency fund
  const liquidSavings = state.assets
    .filter((a) => a.type === "savings")
    .reduce((sum, a) => sum + a.value, 0);
  const monthlyExpensesTotal = totalExpenses; // Match calculateEmergencyFundMonths (expenses only, debt can be deferred in emergency)
  const emergencyTarget = monthlyExpensesTotal * 6;

  if (liquidSavings < emergencyTarget) {
    const remaining = emergencyTarget - liquidSavings;
    const monthlyInflow = cashFlow + savingsContributions;
    const months = monthlyInflow > 0 ? Math.ceil(remaining / monthlyInflow) : Infinity;
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);

    milestones.push({
      name: "6-Month Emergency Fund",
      targetValue: emergencyTarget,
      currentValue: liquidSavings,
      estimatedMonths: months === Infinity ? Infinity : months,
      estimatedDate: months === Infinity ? "Never" : date.toISOString().split("T")[0],
      achievable: months !== Infinity && months < 600,
    });
  }

  // Milestone: $250K net worth
  if (currentNetWorth < 250000) {
    const weightedGrowth250 = state.assets.reduce((sum, a) => sum + a.value * (a.growthRate / 100 / 12), 0);
    const monthlyGrowth = netIncome - totalExpenses - monthlyInterest + weightedGrowth250;
    const remaining = 250000 - currentNetWorth;
    const months = monthlyGrowth > 0 ? Math.ceil(remaining / monthlyGrowth) : Infinity;
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);

    milestones.push({
      name: "$250K Net Worth",
      targetValue: 250000,
      currentValue: currentNetWorth,
      estimatedMonths: months === Infinity ? Infinity : months,
      estimatedDate: months === Infinity ? "Never" : date.toISOString().split("T")[0],
      achievable: months !== Infinity && months < 600,
    });
  }

  return milestones;
}

/**
 * Financial Independence number — the portfolio size needed to sustain
 * annual expenses indefinitely at the given withdrawal rate.
 */
export function calculateFINumber(
  annualExpenses: number,
  withdrawalRate: number = 4
): number {
  if (withdrawalRate <= 0) return Infinity;
  if (annualExpenses <= 0) return 0;
  return Math.round(annualExpenses / (withdrawalRate / 100));
}

/**
 * Coast FI number — the amount you need invested TODAY so that compound
 * growth alone (no further contributions) reaches the FI number by
 * retirement age.
 */
export function calculateCoastFINumber(
  fiNumber: number,
  annualRate: number,
  yearsToRetirement: number
): number {
  if (yearsToRetirement <= 0) return fiNumber;
  const growthFactor = Math.pow(1 + annualRate / 100, yearsToRetirement);
  return Math.round(fiNumber / growthFactor);
}

/**
 * Years to FI — iterates month-by-month with compound growth and
 * contributions until portfolio reaches the FI number.
 * Returns years (fractional) or Infinity if not achievable in 100 years.
 */
export function calculateYearsToFI(
  currentInvestments: number,
  monthlyContribution: number,
  annualRate: number,
  fiNumber: number
): number {
  if (currentInvestments >= fiNumber) return 0;
  const monthlyRate = annualRate / 100 / 12;
  let value = currentInvestments;
  const maxMonths = 1200; // 100 years cap

  for (let m = 1; m <= maxMonths; m++) {
    value = value * (1 + monthlyRate) + monthlyContribution;
    if (value >= fiNumber) return Math.round((m / 12) * 10) / 10;
  }

  return Infinity;
}
