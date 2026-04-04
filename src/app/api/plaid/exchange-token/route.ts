import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const body = await req.json();
    const { public_token, institution } = body;

    if (!public_token) {
      return NextResponse.json({ error: "public_token is required" }, { status: 400 });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = exchangeResponse.data;

    // Get account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    // Create PlaidItem
    const plaidItem = await prisma.plaidItem.create({
      data: {
        profileId,
        accessToken: access_token,
        itemId: item_id,
        institutionId: institution?.institution_id || "unknown",
        institutionName: institution?.name || "Unknown Bank",
      },
    });

    // Create PlaidAccount records for each account
    const accounts = accountsResponse.data.accounts;
    for (const account of accounts) {
      await prisma.plaidAccount.create({
        data: {
          plaidItemId: plaidItem.id,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name || null,
          type: account.type,
          subtype: account.subtype || null,
          mask: account.mask || null,
          balanceCurrent: account.balances.current,
          balanceAvailable: account.balances.available,
          balanceLimit: account.balances.limit,
        },
      });
    }

    return NextResponse.json({
      success: true,
      itemId: plaidItem.id,
      accountCount: accounts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to exchange token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
