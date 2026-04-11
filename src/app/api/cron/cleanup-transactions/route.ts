import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Deletes Plaid-synced transactions older than 90 days. Runs daily via Vercel
// Cron (see vercel.json). Replaces the old desktop-side cleanup that ran on
// every Electron launch — centralizing avoids two clients racing the DELETE.
export async function GET(request: Request) {
  // Vercel Cron sets this header on scheduled invocations. For local or
  // manual runs, allow a bearer token matching CRON_SECRET.
  const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron");
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const hasValidBearer =
    secret && authHeader === `Bearer ${secret}`;

  if (!isVercelCron && !hasValidBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const result = await prisma.transaction.deleteMany({
    where: { date: { lt: cutoff }, checkinId: null },
  });

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    cutoff: cutoff.toISOString(),
  });
}
