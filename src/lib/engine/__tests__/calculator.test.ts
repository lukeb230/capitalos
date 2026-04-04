import { describe, it, expect } from "vitest";
import {
  calculateMonthlyGrossIncome,
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateMonthlyCashFlow,
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalDebts,
  calculateDebtPayoff,
  calculateInvestmentGrowth,
  calculateEmergencyFundMonths,
  calculateSavingsRate,
  estimateMilestones,
} from "../calculator";
import type { IncomeInput, ExpenseInput, DebtInput, AssetInput } from "../types";

// --- Test fixtures ---

const incomes: IncomeInput[] = [
  { id: "1", name: "Salary", amount: 3269.23, frequency: "biweekly", taxRate: 22 },
  { id: "2", name: "Freelance", amount: 500, frequency: "monthly", taxRate: 25 },
];

const expenses: ExpenseInput[] = [
  { id: "1", name: "Rent", amount: 1800, frequency: "monthly", category: "housing", isFixed: true },
  { id: "2", name: "Groceries", amount: 600, frequency: "monthly", category: "food", isFixed: false },
  { id: "3", name: "Insurance", amount: 1200, frequency: "annual", category: "insurance", isFixed: true },
];

const debts: DebtInput[] = [
  { id: "1", name: "Student Loan", balance: 22000, interestRate: 5.5, minimumPayment: 350, type: "student" },
  { id: "2", name: "Credit Card", balance: 3200, interestRate: 19.99, minimumPayment: 120, type: "credit" },
];

const assets: AssetInput[] = [
  { id: "1", name: "Savings", value: 12000, type: "savings", growthRate: 4.5, monthlyContribution: 0 },
  { id: "2", name: "401k", value: 28000, type: "investment", growthRate: 8, monthlyContribution: 500 },
  { id: "3", name: "Car", value: 18000, type: "vehicle", growthRate: -10, monthlyContribution: 0 },
];

// --- Income tests ---

describe("calculateMonthlyGrossIncome", () => {
  it("converts biweekly salary to monthly and adds monthly freelance", () => {
    const result = calculateMonthlyGrossIncome(incomes);
    // Biweekly: 3269.23 * 26 / 12 = 7083.33, + 500 = 7583.33
    expect(result).toBeCloseTo(7083.33 + 500, 0);
  });

  it("returns 0 for empty incomes", () => {
    expect(calculateMonthlyGrossIncome([])).toBe(0);
  });
});

describe("calculateMonthlyNetIncome", () => {
  it("applies tax rate to each income source", () => {
    const result = calculateMonthlyNetIncome(incomes);
    // Salary: 7083.33 * 0.78 = 5525, Freelance: 500 * 0.75 = 375
    expect(result).toBeCloseTo(5525 + 375, -1);
  });
});

// --- Expense tests ---

describe("calculateMonthlyExpenses", () => {
  it("converts annual expenses to monthly and sums all", () => {
    const result = calculateMonthlyExpenses(expenses);
    // 1800 + 600 + 1200/12 = 2500
    expect(result).toBeCloseTo(2500, 0);
  });
});

// --- Cash flow tests ---

describe("calculateMonthlyCashFlow", () => {
  it("returns income minus expenses minus debt payments", () => {
    const result = calculateMonthlyCashFlow(incomes, expenses, debts);
    const netIncome = calculateMonthlyNetIncome(incomes);
    const totalExpenses = calculateMonthlyExpenses(expenses);
    const debtPayments = calculateMonthlyDebtPayments(debts);
    expect(result).toBeCloseTo(netIncome - totalExpenses - debtPayments, 0);
  });

  it("is positive when income exceeds outflows", () => {
    const result = calculateMonthlyCashFlow(incomes, expenses, debts);
    expect(result).toBeGreaterThan(0);
  });
});

// --- Net worth tests ---

describe("calculateNetWorth", () => {
  it("equals total assets minus total debts", () => {
    const result = calculateNetWorth(assets, debts);
    const totalA = 12000 + 28000 + 18000; // 58000
    const totalD = 22000 + 3200; // 25200
    expect(result).toBe(totalA - totalD); // 32800
  });
});

describe("calculateTotalAssets", () => {
  it("sums all asset values", () => {
    expect(calculateTotalAssets(assets)).toBe(58000);
  });
});

describe("calculateTotalDebts", () => {
  it("sums all debt balances", () => {
    expect(calculateTotalDebts(debts)).toBe(25200);
  });
});

// --- Debt payoff tests ---

describe("calculateDebtPayoff", () => {
  it("calculates credit card payoff with high interest", () => {
    const result = calculateDebtPayoff(debts[1]); // Credit card: $3200 @ 19.99%, $120/mo
    expect(result.monthsToPayoff).toBeGreaterThan(30);
    expect(result.monthsToPayoff).toBeLessThan(40);
    expect(result.totalInterestPaid).toBeGreaterThan(500);
  });

  it("pays off faster with extra payments", () => {
    const normal = calculateDebtPayoff(debts[1]);
    const extra = calculateDebtPayoff(debts[1], 100);
    expect(extra.monthsToPayoff).toBeLessThan(normal.monthsToPayoff);
    expect(extra.totalInterestPaid).toBeLessThan(normal.totalInterestPaid);
  });

  it("returns Infinity when payment is less than interest", () => {
    const badDebt: DebtInput = {
      id: "x",
      name: "Underwater",
      balance: 50000,
      interestRate: 25,
      minimumPayment: 50,
      type: "personal",
    };
    const result = calculateDebtPayoff(badDebt);
    expect(result.monthsToPayoff).toBe(Infinity);
  });

  it("returns 0 months for $0 balance debt (Bug 1)", () => {
    const paidOff: DebtInput = {
      id: "x",
      name: "Done",
      balance: 0,
      interestRate: 5,
      minimumPayment: 0,
      type: "personal",
    };
    const result = calculateDebtPayoff(paidOff);
    expect(result.monthsToPayoff).toBe(0);
    expect(result.totalInterestPaid).toBe(0);
  });

  it("returns 0 months for negative balance debt", () => {
    const overpaid: DebtInput = {
      id: "x",
      name: "Overpaid",
      balance: -100,
      interestRate: 5,
      minimumPayment: 50,
      type: "personal",
    };
    const result = calculateDebtPayoff(overpaid);
    expect(result.monthsToPayoff).toBe(0);
  });

  it("handles zero interest rate correctly", () => {
    const noInterest: DebtInput = {
      id: "x",
      name: "NoInterest",
      balance: 1000,
      interestRate: 0,
      minimumPayment: 100,
      type: "personal",
    };
    const result = calculateDebtPayoff(noInterest);
    expect(result.monthsToPayoff).toBe(10);
    expect(result.totalInterestPaid).toBe(0);
  });

  it("returns Infinity when payment is 0 and balance > 0", () => {
    const noPayment: DebtInput = {
      id: "x",
      name: "NoPayment",
      balance: 1000,
      interestRate: 5,
      minimumPayment: 0,
      type: "personal",
    };
    const result = calculateDebtPayoff(noPayment);
    expect(result.monthsToPayoff).toBe(Infinity);
  });
});

// --- Investment growth tests ---

describe("calculateInvestmentGrowth", () => {
  it("grows principal with compound interest and contributions", () => {
    // $10,000 at 8% for 10 years with $500/mo contributions
    const result = calculateInvestmentGrowth(10000, 500, 8, 10);
    expect(result).toBeGreaterThan(100000);
    expect(result).toBeLessThan(120000);
  });

  it("returns principal when rate and contribution are 0", () => {
    expect(calculateInvestmentGrowth(5000, 0, 0, 10)).toBe(5000);
  });
});

// --- Emergency fund tests ---

describe("calculateEmergencyFundMonths", () => {
  it("calculates months of expenses covered by savings", () => {
    const result = calculateEmergencyFundMonths(assets, expenses);
    // $12,000 savings / $2,500 monthly expenses = 4.8
    expect(result).toBeCloseTo(4.8, 1);
  });

  it("returns Infinity when no expenses", () => {
    expect(calculateEmergencyFundMonths(assets, [])).toBe(Infinity);
  });
});

// --- Savings rate tests ---

describe("calculateSavingsRate", () => {
  it("returns percentage of net income saved", () => {
    const rate = calculateSavingsRate(incomes, expenses, debts);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(100);
  });

  it("returns 0 when expenses exceed income", () => {
    const bigExpenses: ExpenseInput[] = [
      { id: "1", name: "Rent", amount: 10000, frequency: "monthly", category: "housing", isFixed: true },
    ];
    const rate = calculateSavingsRate(incomes, bigExpenses, debts);
    expect(rate).toBe(0);
  });
});

// --- Milestone estimation tests ---

describe("estimateMilestones", () => {
  it("returns achievable milestones with valid data", () => {
    const state = { incomes, expenses, debts, assets, goals: [] };
    const milestones = estimateMilestones(state);

    expect(milestones.length).toBeGreaterThanOrEqual(2);
    const debtFree = milestones.find((m) => m.name === "Debt Free");
    expect(debtFree).toBeDefined();
    expect(debtFree!.achievable).toBe(true);
    expect(debtFree!.estimatedMonths).toBeGreaterThan(0);
  });

  it("estimates emergency fund completion", () => {
    const state = { incomes, expenses, debts, assets, goals: [] };
    const milestones = estimateMilestones(state);
    const emergency = milestones.find((m) => m.name === "6-Month Emergency Fund");
    expect(emergency).toBeDefined();
    expect(emergency!.achievable).toBe(true);
  });

  it("handles no debts gracefully", () => {
    const state = { incomes, expenses, debts: [], assets, goals: [] };
    const milestones = estimateMilestones(state);
    expect(milestones.find((m) => m.name === "Debt Free")).toBeUndefined();
  });

  it("handles no assets gracefully", () => {
    const state = { incomes, expenses, debts, assets: [], goals: [] };
    const milestones = estimateMilestones(state);
    expect(milestones.length).toBeGreaterThan(0);
  });

  it("handles zero income gracefully", () => {
    const state = { incomes: [], expenses, debts, assets, goals: [] };
    const milestones = estimateMilestones(state);
    // Should still produce milestones but mark them as not achievable
    const nw100k = milestones.find((m) => m.name === "$100K Net Worth");
    if (nw100k) expect(nw100k.achievable).toBe(false);
  });
});

// --- projectToGoal edge case tests ---

import { projectToGoal } from "../projections";

describe("projectToGoal edge cases", () => {
  const baseState = { incomes, expenses, debts, assets, goals: [] };

  it("returns 0 months for already-met goal (Bug 6 edge case)", () => {
    const goal = { targetAmount: 5000, currentAmount: 10000, targetDate: "2030-01-01" };
    const result = projectToGoal(baseState, goal);
    expect(result.estimatedMonths).toBe(0);
    expect(result.onTrack).toBe(true);
    expect(result.monthlySavingsNeeded).toBe(0);
  });

  it("returns Infinity for unreachable goal with no surplus", () => {
    const brokeState = { ...baseState, incomes: [] };
    const goal = { targetAmount: 100000, currentAmount: 0, targetDate: "2030-01-01" };
    const result = projectToGoal(brokeState, goal);
    expect(result.estimatedMonths).toBe(Infinity);
    expect(result.estimatedDate).toBe("Never");
  });
});

// --- applyScenarioChanges tests ---

import { applyScenarioChanges } from "../projections";

describe("applyScenarioChanges (Bug 7)", () => {
  const baseState = { incomes, expenses, debts, assets, goals: [] };

  it("converts 'true'/'false' strings to booleans", () => {
    const changes = [{ entityType: "expense", entityId: "1", field: "isFixed", oldValue: "true", newValue: "false" }];
    const result = applyScenarioChanges(baseState, changes);
    expect(result.expenses[0].isFixed).toBe(false);
  });

  it("converts numeric strings to numbers", () => {
    const changes = [{ entityType: "income", entityId: "1", field: "amount", oldValue: "3269.23", newValue: "5000" }];
    const result = applyScenarioChanges(baseState, changes);
    expect(result.incomes[0].amount).toBe(5000);
    expect(typeof result.incomes[0].amount).toBe("number");
  });

  it("leaves non-numeric strings as strings", () => {
    const changes = [{ entityType: "income", entityId: "1", field: "frequency", oldValue: "biweekly", newValue: "monthly" }];
    const result = applyScenarioChanges(baseState, changes);
    expect(result.incomes[0].frequency).toBe("monthly");
  });

  it("silently ignores non-matching entityId", () => {
    const changes = [{ entityType: "income", entityId: "nonexistent", field: "amount", oldValue: "0", newValue: "1000" }];
    const result = applyScenarioChanges(baseState, changes);
    // Should not crash, original state unchanged
    expect(result.incomes[0].amount).toBe(incomes[0].amount);
  });
});
