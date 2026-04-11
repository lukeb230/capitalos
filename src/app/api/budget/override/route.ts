import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900) {
    return NextResponse.json({ error: "Valid month (1-12) and year required" }, { status: 400 });
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

  if (!budgetCategoryId || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900) {
    return NextResponse.json({ error: "Valid budgetCategoryId, month (1-12), and year required" }, { status: 400 });
  }
  if (overrideAmount !== undefined && overrideAmount !== null && (typeof overrideAmount !== "number" || overrideAmount < 0)) {
    return NextResponse.json({ error: "Invalid overrideAmount" }, { status: 400 });
  }
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500)) {
    return NextResponse.json({ error: "Note too long (max 500 chars)" }, { status: 400 });
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
