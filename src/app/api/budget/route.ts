import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { CATEGORY_KEYS } from "@/lib/budget/helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const categories = await prisma.budgetCategory.findMany({
    where: { profileId },
    include: { overrides: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { category, monthlyAmount, isFixed, rolloverEnabled } = body;

  if (!category || !CATEGORY_KEYS.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof monthlyAmount !== "number" || monthlyAmount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const item = await prisma.budgetCategory.create({
    data: {
      profileId,
      category,
      monthlyAmount,
      isFixed: isFixed ?? true,
      rolloverEnabled: rolloverEnabled ?? false,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { id, monthlyAmount, isFixed, rolloverEnabled } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.budgetCategory.findUnique({ where: { id } });
  if (!existing || existing.profileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (monthlyAmount !== undefined) data.monthlyAmount = monthlyAmount;
  if (isFixed !== undefined) data.isFixed = isFixed;
  if (rolloverEnabled !== undefined) data.rolloverEnabled = rolloverEnabled;

  const updated = await prisma.budgetCategory.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.budgetCategory.findUnique({ where: { id } });
  if (!existing || existing.profileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.budgetCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
