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
      try {
        const response = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken,
        });

        const { accounts, holdings, securities } = response.data;

        // Build a map of security_id → security for price lookup
        const securityMap = new Map(securities.map((s) => [s.security_id, s]));

        // Sum holdings value by account
        const accountTotals = new Map<string, number>();
        for (const holding of holdings) {
          const current = accountTotals.get(holding.account_id) || 0;
          const value = holding.institution_value || (holding.quantity * (securityMap.get(holding.security_id)?.close_price || 0));
          accountTotals.set(holding.account_id, current + value);
        }

        // Update PlaidAccount balances and linked Assets
        for (const [accountId, totalValue] of accountTotals) {
          const plaidAccount = item.accounts.find((a) => a.accountId === accountId);
          if (!plaidAccount) continue;

          await prisma.plaidAccount.update({
            where: { id: plaidAccount.id },
            data: { balanceCurrent: totalValue },
          });

          if (plaidAccount.linkedAssetId) {
            await prisma.asset.update({
              where: { id: plaidAccount.linkedAssetId },
              data: { value: Math.round(totalValue * 100) / 100 },
            });
            updatedCount++;
          }
        }
      } catch (err) {
        // Investment product may not be available for this item — log and skip
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("PRODUCTS_NOT_SUPPORTED") && !msg.includes("INVALID_PRODUCT")) {
          console.error(`Investment sync failed for item ${item.id}:`, msg);
        }
        continue;
      }
    }

    return NextResponse.json({ success: true, updatedAccounts: updatedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch investments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
