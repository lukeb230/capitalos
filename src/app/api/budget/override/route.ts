import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return NextResponse.json({ error: "month and year required" }, { status: 400 });
  }

  const overrides = await prisma.budgetOverride.findMany({
    where: {
      budgetCategory: { profileId },
      month,
      year,
    },
    include: { budgetCategory: { select: { category: true } } },
  });
  return NextResponse.json(overrides);
}

export async function POST(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { budgetCategoryId, month, year, overrideAmount, note } = body;

  if (!budgetCategoryId || !month || !year) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const cat = await prisma.budgetCategory.findUnique({ where: { id: budgetCategoryId } });
  if (!cat || cat.profileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const override = await prisma.budgetOverride.upsert({
    where: {
      budgetCategoryId_month_year: { budgetCategoryId, month, year },
    },
    update: {
      overrideAmount: overrideAmount ?? null,
      note: note ?? null,
    },
    create: {
      budgetCategoryId,
      month,
      year,
      overrideAmount: overrideAmount ?? null,
      note: note ?? null,
    },
  });
  return NextResponse.json(override);
}
