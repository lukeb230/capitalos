import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.monthlyCheckin.findMany({
      where: { profileId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true, month: true, year: true, totalIncome: true, totalExpenses: true,
        overallGrade: true, expensesByCategory: true, gradeDetails: true, aiSuggestions: true, createdAt: true,
      },
    });
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { transactions, ...checkinData } = body;

    if (typeof checkinData.month !== "number" || typeof checkinData.year !== "number") {
      return NextResponse.json({ error: "month and year are required" }, { status: 400 });
    }
    if (checkinData.month < 1 || checkinData.month > 12) {
      return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
    }
    if (checkinData.year < 2000 || checkinData.year > 2100) {
      return NextResponse.json({ error: "year must be between 2000 and 2100" }, { status: 400 });
    }
    if (Array.isArray(transactions) && transactions.length > 2000) {
      return NextResponse.json({ error: "Too many transactions (max 2000)" }, { status: 400 });
    }

    const checkin = await prisma.$transaction(async (tx) => {
      // Delete existing checkin for this month/year if it exists (upsert behavior)
      const existing = await tx.monthlyCheckin.findUnique({
        where: { profileId_month_year: { profileId, month: checkinData.month, year: checkinData.year } },
      });
      if (existing) {
        await tx.transaction.deleteMany({ where: { checkinId: existing.id } });
        await tx.monthlyCheckin.delete({ where: { id: existing.id } });
      }

      const created = await tx.monthlyCheckin.create({
        data: {
          profileId,
          month: checkinData.month,
          year: checkinData.year,
          totalIncome: typeof checkinData.totalIncome === "number" ? checkinData.totalIncome : 0,
          totalExpenses: typeof checkinData.totalExpenses === "number" ? checkinData.totalExpenses : 0,
          expensesByCategory: JSON.stringify(checkinData.expensesByCategory || {}),
          netWorth: typeof checkinData.netWorth === "number" ? checkinData.netWorth : null,
          overallGrade: typeof checkinData.overallGrade === "string" ? checkinData.overallGrade : "N/A",
          gradeDetails: JSON.stringify(checkinData.gradeDetails || {}),
          aiSuggestions: checkinData.aiSuggestions ? JSON.stringify(checkinData.aiSuggestions) : null,
        },
      });

      if (Array.isArray(transactions) && transactions.length > 0) {
        await tx.transaction.createMany({
          data: transactions.map((t: Record<string, unknown>) => ({
            checkinId: created.id,
            date: new Date(t.date as string),
            description: typeof t.description === "string" ? t.description : "",
            amount: typeof t.amount === "number" && isFinite(t.amount as number) ? t.amount as number : 0,
            isIncome: typeof t.isIncome === "boolean" ? t.isIncome : false,
            category: typeof t.category === "string" ? t.category : "other",
            source: typeof t.accountLabel === "string" ? t.accountLabel : typeof t.source === "string" ? t.source : "unknown",
            excluded: typeof t.excluded === "boolean" ? t.excluded : false,
          })),
        });
      }

      return created;
    });

    return NextResponse.json(checkin, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
