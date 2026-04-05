import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

const VALID_DEBT_TYPES = ["credit_card", "auto", "student", "mortgage", "personal", "medical", "other"];

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.debt.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: msg.includes("profile") ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (typeof body.balance !== "number" || !isFinite(body.balance) || body.balance < 0) return NextResponse.json({ error: "balance must be a non-negative finite number" }, { status: 400 });
    if (typeof body.interestRate !== "number" || !isFinite(body.interestRate) || body.interestRate < 0) return NextResponse.json({ error: "interestRate must be a non-negative finite number" }, { status: 400 });
    if (typeof body.minimumPayment !== "number" || !isFinite(body.minimumPayment) || body.minimumPayment < 0) return NextResponse.json({ error: "minimumPayment must be a non-negative finite number" }, { status: 400 });
    if (body.type && !VALID_DEBT_TYPES.includes(body.type)) return NextResponse.json({ error: `type must be one of: ${VALID_DEBT_TYPES.join(", ")}` }, { status: 400 });

    const item = await prisma.debt.create({
      data: {
        profileId,
        name: body.name,
        balance: body.balance,
        interestRate: body.interestRate,
        minimumPayment: body.minimumPayment,
        type: body.type || "personal",
        originalLoan: typeof body.originalLoan === "number" && isFinite(body.originalLoan) ? body.originalLoan : null,
        loanTermMonths: typeof body.loanTermMonths === "number" && isFinite(body.loanTermMonths) ? Math.round(body.loanTermMonths) : null,
        collateralValue: ["mortgage", "auto"].includes(body.type || "personal") && typeof body.collateralValue === "number" && isFinite(body.collateralValue) ? body.collateralValue : null,
        appreciationRate: ["mortgage", "auto"].includes(body.type || "personal") && typeof body.appreciationRate === "number" && isFinite(body.appreciationRate) ? body.appreciationRate : null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (body.name !== undefined && typeof body.name !== "string") return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    for (const field of ["balance", "interestRate", "minimumPayment"] as const) {
      if (body[field] !== undefined && (typeof body[field] !== "number" || !isFinite(body[field]) || body[field] < 0)) {
        return NextResponse.json({ error: `${field} must be a non-negative finite number` }, { status: 400 });
      }
    }
    if (body.type !== undefined && !VALID_DEBT_TYPES.includes(body.type)) return NextResponse.json({ error: `type must be one of: ${VALID_DEBT_TYPES.join(", ")}` }, { status: 400 });
    if (body.originalLoan !== undefined && body.originalLoan !== null && (typeof body.originalLoan !== "number" || !isFinite(body.originalLoan))) return NextResponse.json({ error: "originalLoan must be a finite number or null" }, { status: 400 });
    if (body.loanTermMonths !== undefined && body.loanTermMonths !== null && (typeof body.loanTermMonths !== "number" || body.loanTermMonths < 0)) return NextResponse.json({ error: "loanTermMonths must be a positive number or null" }, { status: 400 });

    const existing = await prisma.debt.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.balance !== undefined) data.balance = body.balance;
    if (body.interestRate !== undefined) data.interestRate = body.interestRate;
    if (body.minimumPayment !== undefined) data.minimumPayment = body.minimumPayment;
    if (body.type !== undefined) data.type = body.type;
    if (body.originalLoan !== undefined) data.originalLoan = typeof body.originalLoan === "number" ? body.originalLoan : null;
    if (body.loanTermMonths !== undefined) data.loanTermMonths = typeof body.loanTermMonths === "number" ? Math.round(body.loanTermMonths) : null;
    const debtType = (body.type || existing.type) as string;
    if (body.collateralValue !== undefined) data.collateralValue = ["mortgage", "auto"].includes(debtType) && typeof body.collateralValue === "number" ? body.collateralValue : null;
    if (body.appreciationRate !== undefined) data.appreciationRate = ["mortgage", "auto"].includes(debtType) && typeof body.appreciationRate === "number" ? body.appreciationRate : null;

    const item = await prisma.debt.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const existing = await prisma.debt.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.plaidAccount.updateMany({
      where: { linkedDebtId: id },
      data: { linkedDebtId: null },
    });
    await prisma.debt.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
