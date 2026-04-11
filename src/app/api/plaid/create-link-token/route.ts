import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { CountryCode, Products } from "plaid";
// Note: Investments removed from link token — requires separate Plaid
// production approval. Can re-add via additional_consented_products later.

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: profileId },
      client_name: "CapitalOS",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ linkToken: response.data.link_token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create link token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
