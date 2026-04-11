import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { BUDGET_CATEGORIES } from "@/lib/budget/helpers";

export const runtime = "nodejs";

// Default share of each category's bucket (percentages within needs/wants)
const NEEDS_SHARES: Record<string, number> = {
  housing: 0.55,
  food: 0.20,
  transport: 0.10,
  utilities: 0.06,
  insurance: 0.05,
  health: 0.04,
};

const WANTS_SHARES: Record<string, number> = {
  entertainment: 0.20,
  shopping: 0.20,
  subscriptions: 0.15,
  personal: 0.15,
  education: 0.10,
  pets: 0.05,
  transfers: 0.10,
  other: 0.05,
};

type TemplateType = "50-30-20" | "zero-based";

export async function POST(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { template, monthlyNetIncome } = body as {
    template: TemplateType;
    monthlyNetIncome: number;
  };

  if (!template || !monthlyNetIncome || monthlyNetIncome <= 0) {
    return NextResponse.json(
      { error: "template and monthlyNetIncome required" },
      { status: 400 },
    );
  }

  let allocations: { category: string; amount: number; isFixed: boolean }[];

  if (template === "50-30-20") {
    const needsTotal = monthlyNetIncome * 0.5;
    const wantsTotal = monthlyNetIncome * 0.3;
    // 20% is unbudgeted savings — not allocated to any category

    allocations = BUDGET_CATEGORIES.filter((c) => c.bucket !== "savings").map(
      (c) => {
        const shares =
          c.bucket === "needs" ? NEEDS_SHARES : WANTS_SHARES;
        const share = shares[c.key] ?? 0;
        const pool = c.bucket === "needs" ? needsTotal : wantsTotal;
        return {
          category: c.key,
          amount: Math.round(pool * share),
          isFixed: c.bucket === "needs",
        };
      },
    );
  } else {
    // zero-based: distribute 100% across all categories (same proportional shares)
    const needsTotal = monthlyNetIncome * 0.5;
    const wantsTotal = monthlyNetIncome * 0.5;

    allocations = BUDGET_CATEGORIES.filter((c) => c.bucket !== "savings").map(
      (c) => {
        const shares =
          c.bucket === "needs" ? NEEDS_SHARES : WANTS_SHARES;
        const share = shares[c.key] ?? 0;
        const pool = c.bucket === "needs" ? needsTotal : wantsTotal;
        return {
          category: c.key,
          amount: Math.round(pool * share),
          isFixed: c.bucket === "needs",
        };
      },
    );
  }

  // Filter out $0 allocations
  allocations = allocations.filter((a) => a.amount > 0);

  if (allocations.length === 0) {
    return NextResponse.json(
      { error: "No budget allocations to create — check that income is greater than zero" },
      { status: 400 },
    );
  }

  // Upsert each category
  const results = await Promise.all(
    allocations.map((a) =>
      prisma.budgetCategory.upsert({
        where: {
          profileId_category: { profileId, category: a.category },
        },
        update: { monthlyAmount: a.amount, isFixed: a.isFixed },
        create: {
          profileId,
          category: a.category,
          monthlyAmount: a.amount,
          isFixed: a.isFixed,
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, count: results.length });
}
