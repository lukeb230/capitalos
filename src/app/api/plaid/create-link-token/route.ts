import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { CountryCode, Products } from "plaid";

export async function POST(req: Request) {
  try {
    const profileId = await getActiveProfileIdFromRequest(req);

    // Try with Investments as optional; fall back to Transactions-only if it fails
    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: profileId },
        client_name: "CapitalOS",
        products: [Products.Transactions],
        additional_consented_products: [Products.Investments],
        country_codes: [CountryCode.Us],
        language: "en",
      });
      return NextResponse.json({ linkToken: response.data.link_token });
    } catch {
      // Fallback without Investments (some institutions don't support it)
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: profileId },
        client_name: "CapitalOS",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
      });
      return NextResponse.json({ linkToken: response.data.link_token });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create link token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
