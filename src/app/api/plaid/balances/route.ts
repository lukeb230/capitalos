import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);

    const items = await prisma.plaidItem.findMany({
      where: { profileId, isActive: true },
      include: { accounts: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "No connected accounts" }, { status: 404 });
    }

    let updatedCount = 0;

    for (const item of items) {
      const response = await plaidClient.accountsGet({
        access_token: item.accessToken,
      });

      for (const account of response.data.accounts) {
        // Update PlaidAccount balances
        const plaidAccount = await prisma.plaidAccount.update({
          where: { accountId: account.account_id },
          data: {
            balanceCurrent: account.balances.current,
            balanceAvailable: account.balances.available,
            balanceLimit: account.balances.limit,
          },
        });

        // Auto-update linked Asset or Debt
        if (plaidAccount.linkedAssetId) {
          await prisma.asset.update({
            where: { id: plaidAccount.linkedAssetId },
            data: { value: Math.abs(account.balances.current || 0) },
          });
          updatedCount++;
        }

        if (plaidAccount.linkedDebtId) {
          await prisma.debt.update({
            where: { id: plaidAccount.linkedDebtId },
            data: { balance: Math.abs(account.balances.current || 0) },
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, updatedAccounts: updatedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to refresh balances";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
