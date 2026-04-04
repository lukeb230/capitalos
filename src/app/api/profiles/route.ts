import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await prisma.profile.create({
    data: {
      name: body.name.trim(),
      avatarColor: typeof body.avatarColor === "string" ? body.avatarColor : "#3b82f6",
    },
  });

  // Create a baseline scenario for the new profile
  await prisma.scenario.create({
    data: {
      profileId: profile.id,
      name: "Current Baseline",
      description: "Your current financial situation",
      isBaseline: true,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  await prisma.profile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
