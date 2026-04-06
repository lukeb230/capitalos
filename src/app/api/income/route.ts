import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

const VALID_FREQUENCIES = ["monthly", "annual", "biweekly", "weekly"];

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.income.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
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
    if (body.taxRate !== undefined && (typeof body.taxRate !== "number" || !isFinite(body.taxRate) || body.taxRate < 0 || body.taxRate > 100)) return NextResponse.json({ error: "taxRate must be 0-100" }, { status: 400 });
    if (body.startDate && isNaN(new Date(body.startDate).getTime())) return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
    if (body.endDate && isNaN(new Date(body.endDate).getTime())) return NextResponse.json({ error: "endDate must be a valid date" }, { status: 400 });

    const item = await prisma.income.create({
      data: {
        profileId,
        name: body.name,
        amount: body.amount,
        frequency: body.frequency || "monthly",
        taxRate: body.taxRate ?? 0,
        isNetInput: body.isNetInput === true,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: e instanceof Error && e.message.includes("profile") ? 401 : 500 });
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
    if (body.taxRate !== undefined && (typeof body.taxRate !== "number" || !isFinite(body.taxRate) || body.taxRate < 0 || body.taxRate > 100)) return NextResponse.json({ error: "taxRate must be 0-100" }, { status: 400 });
    if (body.startDate !== undefined && body.startDate !== null && isNaN(new Date(body.startDate).getTime())) return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
    if (body.endDate !== undefined && body.endDate !== null && isNaN(new Date(body.endDate).getTime())) return NextResponse.json({ error: "endDate must be a valid date" }, { status: 400 });

    const existing = await prisma.income.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.frequency !== undefined) data.frequency = body.frequency;
    if (body.taxRate !== undefined) data.taxRate = body.taxRate;
    if (body.isNetInput !== undefined) data.isNetInput = body.isNetInput === true;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

    const item = await prisma.income.update({ where: { id }, data });
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
    const existing = await prisma.income.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.income.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
