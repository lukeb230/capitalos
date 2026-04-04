import { NextResponse } from "next/server";

const CATEGORIES = [
  "housing", "transport", "food", "utilities", "subscriptions",
  "entertainment", "insurance", "shopping", "health", "personal",
  "education", "pets", "transfers", "other",
];

export async function POST(req: Request) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { descriptions } = body;

  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    return NextResponse.json({ categories: {} });
  }
  if (descriptions.length > 500) {
    return NextResponse.json({ error: "Too many descriptions (max 500)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ categories: {} });
  }

  // Deduplicate descriptions to minimize tokens
  const unique = [...new Set(descriptions as string[])];

  const systemPrompt = `You are a transaction categorizer for a personal finance app. Categorize each bank transaction description into exactly ONE of these categories:

${CATEGORIES.map((c) => `- ${c}`).join("\n")}

Category definitions:
- housing: rent, mortgage, HOA, property tax, home repair, furniture
- transport: gas, fuel, car wash, parking, tolls, uber/lyft, auto parts, car maintenance
- food: groceries, restaurants, fast food, coffee shops, food delivery
- utilities: electric, water, gas bill, internet, phone, cable
- subscriptions: streaming services, gym memberships, software subscriptions, recurring digital services
- entertainment: movies, concerts, bars, gaming, hobbies, sports events
- insurance: any insurance premiums
- shopping: general retail, Amazon, clothing, electronics, home goods
- health: pharmacy, doctor, dentist, hospital, gym, wellness
- personal: haircuts, clothing stores, dry cleaning
- education: tuition, books, school supplies, courses
- pets: vet, pet food, pet supplies
- transfers: Venmo, Zelle, PayPal transfers, bank transfers, account transfers, loan payments to own accounts
- other: anything that doesn't clearly fit above

Return ONLY valid JSON: { "description1": "category", "description2": "category", ... }
Do NOT include any other text. Categorize every single description provided.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: "Categorize these transaction descriptions:\n\n" + unique.map((d, i) => `${i + 1}. ${d}`).join("\n"),
        }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ categories: {} });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate categories — only allow known categories
        const validated: Record<string, string> = {};
        for (const [desc, cat] of Object.entries(parsed)) {
          validated[desc] = CATEGORIES.includes(cat as string) ? (cat as string) : "other";
        }
        return NextResponse.json({ categories: validated });
      }
    } catch {}

    return NextResponse.json({ categories: {} });
  } catch {
    return NextResponse.json({ categories: {} });
  }
}
