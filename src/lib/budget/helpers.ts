import type { ExpenseInput } from "@/lib/engine/types";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Category constants
// ---------------------------------------------------------------------------

export interface CategoryMeta {
  key: string;
  label: string;
  /** needs / wants / savings — for 50/30/20 template */
  bucket: "needs" | "wants" | "savings";
}

export const BUDGET_CATEGORIES: CategoryMeta[] = [
  { key: "housing", label: "Housing", bucket: "needs" },
  { key: "utilities", label: "Utilities", bucket: "needs" },
  { key: "transport", label: "Transport", bucket: "needs" },
  { key: "food", label: "Food", bucket: "needs" },
  { key: "insurance", label: "Insurance", bucket: "needs" },
  { key: "health", label: "Health", bucket: "needs" },
  { key: "education", label: "Education", bucket: "wants" },
  { key: "entertainment", label: "Entertainment", bucket: "wants" },
  { key: "subscriptions", label: "Subscriptions", bucket: "wants" },
  { key: "shopping", label: "Shopping", bucket: "wants" },
  { key: "personal", label: "Personal", bucket: "wants" },
  { key: "pets", label: "Pets", bucket: "wants" },
  { key: "transfers", label: "Transfers", bucket: "wants" },
  { key: "other", label: "Other", bucket: "wants" },
];

export const CATEGORY_KEYS = BUDGET_CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return (
    BUDGET_CATEGORIES.find((c) => c.key === key)?.label ??
    key.charAt(0).toUpperCase() + key.slice(1)
  );
}

// ---------------------------------------------------------------------------
// Adapter: BudgetCategory[] → ExpenseInput[] (for the engine)
// ---------------------------------------------------------------------------

export interface BudgetCategoryRow {
  id: string;
  category: string;
  monthlyAmount: number;
  isFixed: boolean;
}

/**
 * Maps budget categories to the ExpenseInput shape the financial engine
 * expects. Frequency is always "monthly" because budget amounts are monthly.
 */
export function budgetToExpenseInputs(
  categories: BudgetCategoryRow[],
): ExpenseInput[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.category,
    amount: c.monthlyAmount,
    frequency: "monthly",
    category: c.category,
    isFixed: c.isFixed,
  }));
}

// ---------------------------------------------------------------------------
// Actual spending from transactions for a given month
// ---------------------------------------------------------------------------

export async function getActualSpending(
  profileId: string,
  month: number,
  year: number,
): Promise<Record<string, number>> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Check if a monthly check-in exists for this month. If it does, its
  // transactions are copies of the Plaid-synced originals — only count
  // the check-in copies to avoid double-counting.
  const checkins = await prisma.monthlyCheckin.findMany({
    where: { profileId, month, year },
    select: { id: true },
  });

  let transactions;
  if (checkins.length > 0) {
    // Check-in exists: use only its linked transactions
    transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isIncome: false,
        excluded: false,
        checkinId: { in: checkins.map((c) => c.id) },
      },
    });
  } else {
    // No check-in: use unattached Plaid-synced transactions
    const plaidAccounts = await prisma.plaidAccount.findMany({
      where: { plaidItem: { profileId, isActive: true } },
      select: { id: true },
    });
    transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isIncome: false,
        excluded: false,
        plaidAccountId: { in: plaidAccounts.map((a) => a.id) },
        checkinId: null,
      },
    });
  }

  const byCategory: Record<string, number> = {};
  for (const t of transactions) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  return byCategory;
}

// ---------------------------------------------------------------------------
// Effective budget for a category in a specific month
// ---------------------------------------------------------------------------

export interface EffectiveBudget {
  amount: number;
  rolloverIn: number;
  isOverride: boolean;
}

export function getEffectiveBudget(
  baseAmount: number,
  rolloverEnabled: boolean,
  override: { overrideAmount: number | null; rolloverIn: number } | null,
): EffectiveBudget {
  const isOverride = override?.overrideAmount != null;
  const amount = override?.overrideAmount ?? baseAmount;
  const rolloverIn = rolloverEnabled ? (override?.rolloverIn ?? 0) : 0;
  return { amount: amount + rolloverIn, rolloverIn, isOverride };
}

// ---------------------------------------------------------------------------
// Compute rollover from a previous month and store it
// ---------------------------------------------------------------------------

export async function computeAndStoreRollover(
  profileId: string,
  targetMonth: number,
  targetYear: number,
): Promise<number> {
  // Previous month
  let prevMonth = targetMonth - 1;
  let prevYear = targetYear;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const categories = await prisma.budgetCategory.findMany({
    where: { profileId, rolloverEnabled: true },
    include: {
      overrides: {
        where: { month: prevMonth, year: prevYear },
      },
    },
  });

  const prevActual = await getActualSpending(profileId, prevMonth, prevYear);
  let totalRollover = 0;

  // Atomic: all rollover writes for the month succeed or fail together
  await prisma.$transaction(async (tx) => {
    for (const cat of categories) {
      const override = cat.overrides.find(o => o.month === prevMonth && o.year === prevYear) ?? null;
      const eff = getEffectiveBudget(
        cat.monthlyAmount,
        cat.rolloverEnabled,
        override,
      );
      const actual = prevActual[cat.category] ?? 0;
      const surplus = Math.max(0, eff.amount - actual);
      if (surplus <= 0) continue;

      totalRollover += surplus;

      await tx.budgetOverride.upsert({
        where: {
          budgetCategoryId_month_year: {
            budgetCategoryId: cat.id,
            month: targetMonth,
            year: targetYear,
          },
        },
        update: { rolloverIn: surplus },
        create: {
          budgetCategoryId: cat.id,
          month: targetMonth,
          year: targetYear,
          rolloverIn: surplus,
        },
      });
    }
  });

  return totalRollover;
}
