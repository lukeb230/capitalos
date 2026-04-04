import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { id } = await params;
    const item = await prisma.monthlyCheckin.findFirst({
      where: { id, profileId },
      include: { transactions: { orderBy: { date: "asc" } } },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: msg.includes("profile") ? 401 : 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { id } = await params;
    const existing = await prisma.monthlyCheckin.findFirst({ where: { id, profileId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.monthlyCheckin.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: msg.includes("profile") ? 401 : 500 });
  }
}
