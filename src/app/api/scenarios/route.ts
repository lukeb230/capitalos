import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const items = await prisma.scenario.findMany({
      where: { profileId },
      include: { changes: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
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

    if (body.changes) {
      for (const c of body.changes) {
        if (!c.entityType || !c.entityId || !c.field
            || typeof c.oldValue !== "string" || typeof c.newValue !== "string") {
          return NextResponse.json({ error: "Each change must have entityType, entityId, field, oldValue, newValue" }, { status: 400 });
        }
      }
    }

    const item = await prisma.scenario.create({
      data: {
        profileId,
        name: body.name,
        description: body.description || "",
        isBaseline: typeof body.isBaseline === "boolean" ? body.isBaseline : false,
        snapshotData: body.snapshotData ? JSON.stringify(body.snapshotData) : undefined,
        changes: body.changes ? { create: body.changes } : undefined,
      },
      include: { changes: true },
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
    const { id, changes, snapshotData } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (body.name !== undefined && typeof body.name !== "string") return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    if (body.isBaseline !== undefined && typeof body.isBaseline !== "boolean") return NextResponse.json({ error: "isBaseline must be a boolean" }, { status: 400 });
    if (changes !== undefined && !Array.isArray(changes)) return NextResponse.json({ error: "changes must be an array" }, { status: 400 });
    if (snapshotData !== undefined && snapshotData !== null && typeof snapshotData !== "object") return NextResponse.json({ error: "snapshotData must be an object or null" }, { status: 400 });

    if (changes) {
      for (const c of changes) {
        if (!c.entityType || !c.entityId || !c.field
            || typeof c.oldValue !== "string" || typeof c.newValue !== "string") {
          return NextResponse.json({ error: "Each change must have entityType, entityId, field, oldValue, newValue" }, { status: 400 });
        }
      }
    }

    const existing = await prisma.scenario.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.scenarioChange.deleteMany({ where: { scenarioId: id } });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.isBaseline !== undefined) data.isBaseline = body.isBaseline;
    if (snapshotData !== undefined) data.snapshotData = snapshotData ? JSON.stringify(snapshotData) : null;
    if (changes) data.changes = { create: changes };

    const item = await prisma.scenario.update({
      where: { id },
      data,
      include: { changes: true },
    });
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
    const existing = await prisma.scenario.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
