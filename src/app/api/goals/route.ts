import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

const VALID_GOAL_TYPES = ["emergency_fund", "net_worth", "retirement", "purchase", "debt_free", "custom"];

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.goal.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
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
    if (typeof body.targetAmount !== "number" || !isFinite(body.targetAmount) || body.targetAmount < 0) return NextResponse.json({ error: "targetAmount must be a non-negative finite number" }, { status: 400 });
    if (body.targetDate && isNaN(new Date(body.targetDate).getTime())) return NextResponse.json({ error: "targetDate must be a valid date" }, { status: 400 });
    if (body.type && !VALID_GOAL_TYPES.includes(body.type)) return NextResponse.json({ error: `type must be one of: ${VALID_GOAL_TYPES.join(", ")}` }, { status: 400 });

    const item = await prisma.goal.create({
      data: {
        profileId,
        name: body.name,
        targetAmount: body.targetAmount,
        currentAmount: typeof body.currentAmount === "number" && isFinite(body.currentAmount) ? body.currentAmount : 0,
        targetDate: body.targetDate ? new Date(body.targetDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        priority: typeof body.priority === "number" ? Math.round(body.priority) : 1,
        type: body.type || "custom",
        linkedAssetId: typeof body.linkedAssetId === "string" ? body.linkedAssetId : null,
        linkedDebtId: typeof body.linkedDebtId === "string" ? body.linkedDebtId : null,
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
    if (body.targetAmount !== undefined && (typeof body.targetAmount !== "number" || !isFinite(body.targetAmount) || body.targetAmount < 0)) return NextResponse.json({ error: "targetAmount must be a non-negative finite number" }, { status: 400 });
    if (body.currentAmount !== undefined && (typeof body.currentAmount !== "number" || !isFinite(body.currentAmount) || body.currentAmount < 0)) return NextResponse.json({ error: "currentAmount must be a non-negative finite number" }, { status: 400 });
    if (body.targetDate !== undefined && isNaN(new Date(body.targetDate).getTime())) return NextResponse.json({ error: "targetDate must be a valid date" }, { status: 400 });
    if (body.priority !== undefined && (typeof body.priority !== "number" || body.priority < 1)) return NextResponse.json({ error: "priority must be a positive number" }, { status: 400 });
    if (body.type !== undefined && !VALID_GOAL_TYPES.includes(body.type)) return NextResponse.json({ error: `type must be one of: ${VALID_GOAL_TYPES.join(", ")}` }, { status: 400 });

    const existing = await prisma.goal.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.targetAmount !== undefined) data.targetAmount = body.targetAmount;
    if (body.currentAmount !== undefined) data.currentAmount = body.currentAmount;
    if (body.targetDate !== undefined) data.targetDate = new Date(body.targetDate);
    if (body.priority !== undefined) data.priority = Math.round(body.priority);
    if (body.type !== undefined) data.type = body.type;
    if (body.linkedAssetId !== undefined) data.linkedAssetId = typeof body.linkedAssetId === "string" ? body.linkedAssetId : null;
    if (body.linkedDebtId !== undefined) data.linkedDebtId = typeof body.linkedDebtId === "string" ? body.linkedDebtId : null;

    const item = await prisma.goal.update({ where: { id }, data });
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
    const existing = await prisma.goal.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
