import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

const VALID_FREQUENCIES = ["monthly", "annual", "biweekly", "weekly"];
const VALID_CATEGORIES = ["housing", "transport", "food", "utilities", "subscriptions", "entertainment", "insurance", "shopping", "health", "personal", "education", "pets", "transfers", "other"];

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.expense.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: e instanceof Error && e.message === "No active profile" ? 401 : 500 });
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
    if (typeof body.amount !== "number" || !isFinite(body.amount) || body.amount < 0) return NextResponse.json({ error: "amount must be a non-negative finite number" }, { status: 400 });
    if (body.frequency && !VALID_FREQUENCIES.includes(body.frequency)) return NextResponse.json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` }, { status: 400 });
    if (body.category && !VALID_CATEGORIES.includes(body.category)) return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });

    const item = await prisma.expense.create({
      data: {
        profileId,
        name: body.name,
        amount: body.amount,
        frequency: body.frequency || "monthly",
        category: body.category || "other",
        isFixed: typeof body.isFixed === "boolean" ? body.isFixed : true,
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
    if (body.amount !== undefined && (typeof body.amount !== "number" || !isFinite(body.amount) || body.amount < 0)) return NextResponse.json({ error: "amount must be a non-negative finite number" }, { status: 400 });
    if (body.frequency !== undefined && !VALID_FREQUENCIES.includes(body.frequency)) return NextResponse.json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` }, { status: 400 });
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    if (body.isFixed !== undefined && typeof body.isFixed !== "boolean") return NextResponse.json({ error: "isFixed must be a boolean" }, { status: 400 });

    const existing = await prisma.expense.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.frequency !== undefined) data.frequency = body.frequency;
    if (body.category !== undefined) data.category = body.category;
    if (body.isFixed !== undefined) data.isFixed = body.isFixed;

    const item = await prisma.expense.update({ where: { id }, data });
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
    const existing = await prisma.expense.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
