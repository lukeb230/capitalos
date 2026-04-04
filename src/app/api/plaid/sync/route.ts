import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { mapPlaidCategory } from "@/lib/checkin/category-mapper";

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { itemId } = body;

    const items = await prisma.plaidItem.findMany({
      where: {
        profileId,
        isActive: true,
        ...(itemId ? { id: itemId } : {}),
      },
      include: { accounts: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "No connected accounts" }, { status: 404 });
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of items) {
      let cursor = item.syncCursor || undefined;
      let hasMore = true;

      const accountMap = new Map(item.accounts.map((a) => [a.accountId, a.id]));

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor,
        });

        const { added, modified, removed, next_cursor, has_more } = response.data;

        for (const txn of added) {
          try {
            const plaidAccountId = accountMap.get(txn.account_id) || null;
            const isIncome = txn.amount < 0;
            const amount = Math.abs(txn.amount);
            const category = mapPlaidCategory(txn.personal_finance_category?.primary || "", txn.name);

            await prisma.transaction.upsert({
              where: { plaidTransactionId: txn.transaction_id },
              update: {
                description: txn.name,
                amount,
                isIncome,
                category,
              },
              create: {
                date: new Date(txn.date),
                description: txn.name,
                amount,
                isIncome,
                category,
                source: "plaid",
                excluded: false,
                plaidTransactionId: txn.transaction_id,
                plaidAccountId,
              },
            });
            totalAdded++;
          } catch (err) {
            console.error(`Failed to insert transaction ${txn.transaction_id}:`, err);
          }
        }

        for (const txn of modified) {
          try {
            const isIncome = txn.amount < 0;
            const amount = Math.abs(txn.amount);
            const category = mapPlaidCategory(txn.personal_finance_category?.primary || "", txn.name);

            await prisma.transaction.updateMany({
              where: { plaidTransactionId: txn.transaction_id },
              data: {
                description: txn.name,
                amount,
                isIncome,
                category,
              },
            });
            totalModified++;
          } catch (err) {
            console.error(`Failed to update transaction ${txn.transaction_id}:`, err);
          }
        }

        for (const txn of removed) {
          try {
            await prisma.transaction.deleteMany({
              where: { plaidTransactionId: txn.transaction_id },
            });
            totalRemoved++;
          } catch (err) {
            console.error(`Failed to remove transaction ${txn.transaction_id}:`, err);
          }
        }

        cursor = next_cursor;
        hasMore = has_more;
      }

      await prisma.plaidItem.update({
        where: { id: item.id },
        data: {
          syncCursor: cursor,
          lastSynced: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
