import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { incomes, budgetCategories, debts, assets, goals, currentAge, retirementAge, filingStatus, state } = body;

    // Update profile with age and tax fields if provided
    const profileData: Record<string, unknown> = {};
    if (typeof currentAge === "number" && currentAge > 0) profileData.currentAge = currentAge;
    if (typeof retirementAge === "number" && retirementAge > 0) profileData.retirementAge = retirementAge;
    if (typeof filingStatus === "string" && filingStatus) profileData.filingStatus = filingStatus;
    if (typeof state === "string" && state) profileData.state = state;
    if (Object.keys(profileData).length > 0) {
      await prisma.profile.update({ where: { id: profileId }, data: profileData });
    }

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(incomes)) {
        for (const item of incomes) {
          await tx.income.create({
            data: {
              profileId,
              name: item.name,
              amount: item.amount,
              frequency: item.frequency || "monthly",
              taxRate: item.taxRate || 0,
            },
          });
        }
      }
      if (Array.isArray(budgetCategories)) {
        for (const item of budgetCategories) {
          await tx.budgetCategory.upsert({
            where: {
              profileId_category: { profileId, category: item.category || "other" },
            },
            update: { monthlyAmount: item.monthlyAmount || item.amount || 0 },
            create: {
              profileId,
              category: item.category || "other",
              monthlyAmount: item.monthlyAmount || item.amount || 0,
              isFixed: item.isFixed ?? true,
            },
          });
        }
      }
      if (Array.isArray(debts)) {
        for (const item of debts) {
          await tx.debt.create({
            data: {
              profileId,
              name: item.name,
              balance: item.balance,
              interestRate: item.interestRate,
              minimumPayment: item.minimumPayment,
              type: item.type || "other",
              originalLoan: item.originalLoan ?? null,
              loanTermMonths: item.loanTermMonths ?? null,
            },
          });
        }
      }
      if (Array.isArray(assets)) {
        for (const item of assets) {
          await tx.asset.create({
            data: {
              profileId,
              name: item.name,
              value: item.value,
              type: item.type || "savings",
              growthRate: item.growthRate || 0,
              monthlyContribution: item.monthlyContribution || 0,
            },
          });
        }
      }
      if (Array.isArray(goals)) {
        for (const item of goals) {
          await tx.goal.create({
            data: {
              profileId,
              name: item.name,
              targetAmount: item.targetAmount,
              currentAmount: item.currentAmount || 0,
              targetDate: new Date(item.targetDate),
              type: item.type || "custom",
              priority: item.priority || 1,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: msg.includes("profile") ? 401 : 500 });
  }
}
