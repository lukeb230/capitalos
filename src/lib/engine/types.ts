export interface IncomeInput {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  taxRate: number;
  isNetInput?: boolean;
}

export interface ExpenseInput {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  isFixed: boolean;
}

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type: string;
  originalLoan?: number | null;
  loanTermMonths?: number | null;
  collateralValue?: number | null;
  appreciationRate?: number | null;
}

export interface AssetInput {
  id: string;
  name: string;
  value: number;
  type: string;
  growthRate: number;
  monthlyContribution: number;
}

export interface GoalInput {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: number;
  type: string;
  linkedAssetId?: string | null;
  linkedDebtId?: string | null;
}

export interface FinancialState {
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  debts: DebtInput[];
  assets: AssetInput[];
  goals: GoalInput[];
}

export interface MonthlySnapshot {
  month: number;
  label: string;
  totalIncome: number;
  totalExpenses: number;
  totalDebtPayments: number;
  netCashFlow: number;
  totalDebtBalance: number;
  totalAssetValue: number;
  netWorth: number;
  debtBalances: Record<string, number>;
  assetValues: Record<string, number>;
}

export interface DebtPayoffResult {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffDate: string;
  effectivelyUnpayable?: boolean;
}

export interface GoalProjection {
  goalId: string;
  goalName: string;
  estimatedMonths: number;
  estimatedDate: string;
  monthlySavingsNeeded: number;
  onTrack: boolean;
}

export interface ScenarioChangeInput {
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface MilestoneEstimate {
  name: string;
  targetValue: number;
  currentValue: number;
  estimatedMonths: number;
  estimatedDate: string;
  achievable: boolean;
}

export interface SavingsProjectionPoint {
  month: number;
  label: string;
  savings: number;
  investments: number;
  totalLiquid: number;
}

export interface NetWorthAtTimeframe {
  label: string;
  months: number;
  baseline: number;
  scenario: number;
  difference: number;
}

export interface DebtComparisonItem {
  debtId: string;
  debtName: string;
  baselineMonths: number;
  scenarioMonths: number;
  monthsSaved: number;
  baselineInterest: number;
  scenarioInterest: number;
  interestSaved: number;
}

export interface GoalComparisonItem {
  goalId: string;
  goalName: string;
  baselineMonths: number;
  scenarioMonths: number;
  monthsChanged: number;
  accelerated: boolean;
}

export interface ScenarioComparison {
  baselineCashFlow: number;
  scenarioCashFlow: number;
  cashFlowDifference: number;
  baselineNetWorth: number;
  scenarioNetWorth: number;
  netWorthDifference: number;
  baselineProjections: MonthlySnapshot[];
  scenarioProjections: MonthlySnapshot[];
  netWorthAtTimeframes: NetWorthAtTimeframe[];
  debtComparisons: DebtComparisonItem[];
  goalComparisons: GoalComparisonItem[];
  baselineInvestableSurplus: number;
  scenarioInvestableSurplus: number;
  investableSurplusDifference: number;
  summaryText: string;
}
