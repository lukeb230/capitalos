import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);

    const items = await prisma.plaidItem.findMany({
      where: { profileId },
      include: {
        accounts: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const item = await prisma.plaidItem.findFirst({
      where: { id: itemId, profileId },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Remove from Plaid
    try {
      await plaidClient.itemRemove({ access_token: item.accessToken });
    } catch {
      // Plaid may have already removed it — proceed with local cleanup
    }

    // Delete from DB (cascades to PlaidAccount)
    await prisma.plaidItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Link a PlaidAccount to an existing Asset or Debt
export async function PUT(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);
    const body = await req.json();
    const { plaidAccountId, linkedAssetId, linkedDebtId } = body;

    if (!plaidAccountId) {
      return NextResponse.json({ error: "plaidAccountId is required" }, { status: 400 });
    }

    // Verify ownership
    const account = await prisma.plaidAccount.findFirst({
      where: { id: plaidAccountId },
      include: { plaidItem: true },
    });

    if (!account || account.plaidItem.profileId !== profileId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.plaidAccount.update({
      where: { id: plaidAccountId },
      data: {
        linkedAssetId: linkedAssetId || null,
        linkedDebtId: linkedDebtId || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
