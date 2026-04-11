import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
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

  // Fetch user's budget categories (amounts are already monthly)
  const budgetCategories = await prisma.budgetCategory.findMany({ where: { profileId } });

  const budgeted: Record<string, number> = {};
  for (const c of budgetCategories) {
    budgeted[c.category] = (budgeted[c.category] || 0) + c.monthlyAmount;
  }

  const grades = computeGrades(expensesByCategory, budgeted);
  return NextResponse.json(grades);
}
