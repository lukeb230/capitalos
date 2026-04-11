import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { computeAndStoreRollover } from "@/lib/budget/helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const profileId = await getActiveProfileIdFromRequest(req);
  const body = await req.json();
  const { month, year } = body;

  if (!month || !year) {
    return NextResponse.json({ error: "month and year required" }, { status: 400 });
  }

  const totalRollover = await computeAndStoreRollover(profileId, month, year);
  return NextResponse.json({ success: true, totalRollover });
}
