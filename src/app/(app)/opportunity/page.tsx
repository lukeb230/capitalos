import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  toMonthly,
} from "@/lib/engine/calculator";
import { OpportunityClient } from "./client";

export const dynamic = "force-dynamic";

export default async function OpportunityPage() {
  const profileId = await getActiveProfileId();
  const [incomes, expenses, debts, assets] = await Promise.all([
    prisma.income.findMany({ where: { profileId } }),
    prisma.expense.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
  ]);

  const incomeInputs = incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate, isNetInput: i.isNetInput }));
  const expenseInputs = expenses.map((e) => ({ id: e.id, name: e.name, amount: e.amount, frequency: e.frequency, category: e.category, isFixed: e.isFixed }));
  const debtInputs = debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type }));
  const assetInputs = assets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution }));

  const cashFlow = calculateMonthlyCashFlow(incomeInputs, expenseInputs, debtInputs, assetInputs);

  // Pass existing expenses for the "your expenses" analysis
  const expenseBreakdown = expenseInputs.map((e) => ({
    name: e.name,
    amount: toMonthly(e.amount, e.frequency),
    category: e.category,
  }));

  return <OpportunityClient cashFlow={cashFlow} expenses={expenseBreakdown} />;
}
