import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { getActualSpending } from "@/lib/budget/helpers";

// GET — fetch recent transactions (last 90 days by default)
// Supports ?summary=true&month=N&year=N for budget page month navigation
export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { searchParams } = new URL(req.url);

    // Budget summary mode: return spending grouped by category for a month
    const summaryMode = searchParams.get("summary") === "true";
    const monthParam = parseInt(searchParams.get("month") || "");
    const yearParam = parseInt(searchParams.get("year") || "");

    if (summaryMode && Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 && Number.isInteger(yearParam) && yearParam >= 1900) {
      const byCategory = await getActualSpending(profileId, monthParam, yearParam);
      return NextResponse.json({ byCategory });
    }

    const days = parseInt(searchParams.get("days") || "90");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get all check-in IDs for this profile
    const checkins = await prisma.monthlyCheckin.findMany({
      where: { profileId },
      select: { id: true },
    });
    const checkinIds = checkins.map((c) => c.id);

    // Get Plaid account IDs for this profile (for unattached transactions)
    const plaidAccounts = await prisma.plaidAccount.findMany({
      where: { plaidItem: { profileId } },
      select: { id: true },
    });
    const plaidAccountIds = plaidAccounts.map((a) => a.id);

    // Fetch transactions: either attached to a check-in OR unattached Plaid transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: cutoff },
        OR: [
          { checkinId: { in: checkinIds } },
          { plaidAccountId: { in: plaidAccountIds }, checkinId: null },
        ],
      },
      include: {
        plaidAccount: {
          select: { name: true, mask: true, plaidItem: { select: { institutionName: true } } },
        },
      },
      orderBy: { date: "desc" },
      take: 2000,
    });

    // Add accountLabel to each transaction
    const enriched = transactions.map((t) => ({
      ...t,
      accountLabel: t.plaidAccount
        ? `${t.plaidAccount.plaidItem.institutionName} - ${t.plaidAccount.name}${t.plaidAccount.mask ? ` ****${t.plaidAccount.mask}` : ""}`
        : t.source || "Manual",
      plaidAccount: undefined,
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — update a transaction's category
export async function PUT(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const body = await req.json();
    const { transactionId, category } = body;

    if (!transactionId || !category) {
      return NextResponse.json({ error: "transactionId and category are required" }, { status: 400 });
    }

    // Verify ownership: transaction must belong to a check-in owned by this profile
    // or be an unattached Plaid transaction for this profile
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { checkin: true, plaidAccount: { include: { plaidItem: true } } },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownsCheckin = transaction.checkin && transaction.checkin.profileId === profileId;
    const ownsPlaid = transaction.plaidAccount && transaction.plaidAccount.plaidItem.profileId === profileId;
    if (!ownsCheckin && !ownsPlaid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oldCategory = transaction.category;

    // Update the transaction
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { category },
    });

    // If attached to a check-in, update the aggregated expensesByCategory
    if (transaction.checkinId && transaction.checkin && !transaction.isIncome && !transaction.excluded) {
      try {
        const existing = JSON.parse(transaction.checkin.expensesByCategory || "{}");
        // Subtract from old category
        if (existing[oldCategory]) {
          existing[oldCategory] = Math.max(0, existing[oldCategory] - transaction.amount);
          if (existing[oldCategory] === 0) delete existing[oldCategory];
        }
        // Add to new category
        existing[category] = (existing[category] || 0) + transaction.amount;

        await prisma.monthlyCheckin.update({
          where: { id: transaction.checkinId },
          data: { expensesByCategory: JSON.stringify(existing) },
        });
      } catch {
        // Aggregate update failed — transaction category still updated
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — cleanup old transactions (called on startup or manually)
export async function DELETE(req: Request) {
  try {
    await getActiveProfileIdFromRequest(req);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await prisma.transaction.deleteMany({
      where: { date: { lt: cutoff } },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
