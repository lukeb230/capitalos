import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { computeAndStoreRollover } from "@/lib/budget/helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { month, year } = body;

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900) {
    return NextResponse.json({ error: "Valid month (1-12) and year required" }, { status: 400 });
  }

  const totalRollover = await computeAndStoreRollover(profileId, month, year);
  return NextResponse.json({ success: true, totalRollover });
}
