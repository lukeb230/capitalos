import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);

    const [profile, incomes, expenses, debts, assets, goals, scenarios, checkins] = await Promise.all([
      prisma.profile.findUnique({ where: { id: profileId } }),
      prisma.income.findMany({ where: { profileId } }),
      prisma.expense.findMany({ where: { profileId } }),
      prisma.debt.findMany({ where: { profileId } }),
      prisma.asset.findMany({ where: { profileId } }),
      prisma.goal.findMany({ where: { profileId } }),
      prisma.scenario.findMany({ where: { profileId }, include: { changes: true } }),
      prisma.monthlyCheckin.findMany({
        where: { profileId },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: {
          month: true, year: true, totalIncome: true, totalExpenses: true,
          netWorth: true, overallGrade: true, expensesByCategory: true,
        },
      }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      profile: {
        name: profile?.name,
        currentAge: profile?.currentAge,
        retirementAge: profile?.retirementAge,
        filingStatus: profile?.filingStatus,
        state: profile?.state,
      },
      incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate })),
      expenses: expenses.map((e) => ({ name: e.name, amount: e.amount, frequency: e.frequency, category: e.category, isFixed: e.isFixed })),
      debts: debts.map((d) => ({ name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type, originalLoan: d.originalLoan, loanTermMonths: d.loanTermMonths })),
      assets: assets.map((a) => ({ name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution })),
      goals: goals.map((g) => ({ name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate, priority: g.priority, type: g.type })),
      scenarios: scenarios.map((s) => ({ name: s.name, description: s.description, changes: s.changes })),
      checkins: checkins.map((c) => ({ month: c.month, year: c.year, totalIncome: c.totalIncome, totalExpenses: c.totalExpenses, netWorth: c.netWorth, overallGrade: c.overallGrade })),
    };

    return NextResponse.json(exportData);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
