import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { toMonthly } from "@/lib/engine/calculator";
import { computeGrades } from "@/lib/checkin/grading";

export async function POST(req: Request) {
  let profileId;
  try { profileId = await getActiveProfileIdFromRequest(req); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auth error" }, { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { expensesByCategory } = body;

  // Fetch user's budgeted expenses
  const expenses = await prisma.expense.findMany({ where: { profileId } });

  // Sum budgeted amounts per category using toMonthly for frequency conversion
  const budgeted: Record<string, number> = {};
  for (const e of expenses) {
    const monthly = toMonthly(e.amount, e.frequency);
    budgeted[e.category] = (budgeted[e.category] || 0) + monthly;
  }

  const grades = computeGrades(expensesByCategory, budgeted);
  return NextResponse.json(grades);
}
