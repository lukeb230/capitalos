import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

const VALID_ASSET_TYPES = ["savings", "checking", "investment", "property", "vehicle", "other"];

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.asset.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
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
    if (typeof body.value !== "number" || !isFinite(body.value) || body.value < 0) return NextResponse.json({ error: "value must be a non-negative finite number" }, { status: 400 });

    const item = await prisma.asset.create({
      data: {
        profileId,
        name: body.name,
        value: body.value,
        type: VALID_ASSET_TYPES.includes(body.type) ? body.type : "other",
        growthRate: typeof body.growthRate === "number" && isFinite(body.growthRate) ? body.growthRate : 0,
        monthlyContribution: typeof body.monthlyContribution === "number" && isFinite(body.monthlyContribution) && body.monthlyContribution >= 0 ? body.monthlyContribution : 0,
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
    if (body.value !== undefined && (typeof body.value !== "number" || !isFinite(body.value) || body.value < 0)) return NextResponse.json({ error: "value must be a non-negative finite number" }, { status: 400 });
    if (body.type !== undefined && !VALID_ASSET_TYPES.includes(body.type)) return NextResponse.json({ error: `type must be one of: ${VALID_ASSET_TYPES.join(", ")}` }, { status: 400 });
    if (body.growthRate !== undefined && (typeof body.growthRate !== "number" || !isFinite(body.growthRate))) return NextResponse.json({ error: "growthRate must be a finite number" }, { status: 400 });
    if (body.monthlyContribution !== undefined && (typeof body.monthlyContribution !== "number" || !isFinite(body.monthlyContribution) || body.monthlyContribution < 0)) return NextResponse.json({ error: "monthlyContribution must be a non-negative finite number" }, { status: 400 });

    const existing = await prisma.asset.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.value !== undefined) data.value = body.value;
    if (body.type !== undefined) data.type = body.type;
    if (body.growthRate !== undefined) data.growthRate = body.growthRate;
    if (body.monthlyContribution !== undefined) data.monthlyContribution = body.monthlyContribution;

    const item = await prisma.asset.update({ where: { id }, data });
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
    const existing = await prisma.asset.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Clear any Plaid account links pointing to this asset
    await prisma.plaidAccount.updateMany({
      where: { linkedAssetId: id },
      data: { linkedAssetId: null },
    });
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
