import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid month and year are required" }, { status: 400 });
    }

    // Build date range for the requested month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all Plaid accounts for this profile
    const plaidAccounts = await prisma.plaidAccount.findMany({
      where: { plaidItem: { profileId, isActive: true } },
      select: { id: true, name: true, mask: true, type: true, subtype: true },
    });

    if (plaidAccounts.length === 0) {
      return NextResponse.json([]);
    }

    const plaidAccountIds = plaidAccounts.map((a) => a.id);

    // Query synced Plaid transactions for this month (unattached — no checkinId)
    const transactions = await prisma.transaction.findMany({
      where: {
        plaidAccountId: { in: plaidAccountIds },
        checkinId: null,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    // Build account lookup for labels
    const accountMap = new Map(plaidAccounts.map((a) => [a.id, a]));

    // Convert to NormalizedTransaction format
    const normalized = transactions.map((t) => {
      const account = t.plaidAccountId ? accountMap.get(t.plaidAccountId) : null;
      const plaidType = account?.type || "depository";
      const accountType = plaidType === "credit" ? "credit_card"
        : plaidType === "depository" ? (account?.subtype === "savings" ? "savings" : "checking")
        : "checking";
      const accountLabel = account
        ? `${account.name}${account.mask ? ` ****${account.mask}` : ""}`
        : "Plaid";

      return {
        id: t.id,
        date: t.date.toISOString(),
        description: t.description,
        amount: t.amount,
        isIncome: t.isIncome,
        category: t.category,
        source: "plaid",
        excluded: t.excluded,
        accountType,
        accountLabel,
      };
    });

    return NextResponse.json(normalized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
