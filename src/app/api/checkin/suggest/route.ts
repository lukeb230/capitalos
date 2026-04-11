import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

export async function POST(req: Request) {
  let profileId;
  try { profileId = await getActiveProfileIdFromRequest(req); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auth error" }, { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { month, year, gradeDetails, expensesByCategory, totalIncome, totalExpenses } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      summary: "AI suggestions not configured.",
      categoryInsights: [],
      topActions: ["Add an ANTHROPIC_API_KEY environment variable to enable AI suggestions."],
    });
  }

  // Fetch user's budget categories (amounts are already monthly)
  const budgetCategories = await prisma.budgetCategory.findMany({ where: { profileId } });
  const budgeted: Record<string, number> = {};
  for (const c of budgetCategories) {
    budgeted[c.category] = (budgeted[c.category] || 0) + c.monthlyAmount;
  }

  const systemPrompt = `You are a personal budget optimizer inside a financial planning app. The user has completed their monthly check-in for ${month}/${year}.

BUDGET VS ACTUAL SPENDING:
${Object.entries(gradeDetails || {}).map(([cat, d]: [string, any]) =>
  `- ${cat}: Budgeted $${d.budgeted?.toFixed(0) ?? 0}/mo, Actual $${d.actual?.toFixed(0) ?? 0}/mo, Grade: ${d.grade ?? "N/A"}, Diff: ${d.diff > 0 ? "+" : ""}$${d.diff?.toFixed(0) ?? 0}`
).join("\n")}

TOTALS:
- Total Budgeted: $${Object.values(budgeted).reduce((s: number, v) => s + (v as number), 0).toFixed(0)}/mo
- Total Actual: $${totalExpenses?.toFixed(0) ?? 0}/mo
- Monthly Income: $${totalIncome?.toFixed(0) ?? 0}/mo

RESPONSE FORMAT:
Respond with valid JSON:
{
  "summary": "1-2 sentence overall assessment of the month",
  "categoryInsights": [
    { "category": "food", "grade": "D", "insight": "Specific observation about spending", "suggestion": "Specific actionable cut or change" }
  ],
  "topActions": ["Action 1 with specific dollar amount", "Action 2", "Action 3"]
}

GUIDELINES:
- Be specific with dollar amounts
- Reference actual categories and amounts from the data
- Suggest concrete cuts, not vague advice
- Prioritize suggestions by dollar impact
- Keep categoryInsights to the 3-5 most impactful categories
- Keep topActions to exactly 3 items`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: "Analyze my spending this month and give me specific optimization suggestions." }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        summary: "Could not connect to AI service.",
        categoryInsights: [],
        topActions: ["Try again later."],
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch {}

    return NextResponse.json({ summary: text, categoryInsights: [], topActions: [] });
  } catch {
    return NextResponse.json({
      summary: "An error occurred.",
      categoryInsights: [],
      topActions: ["Please try again."],
    });
  }
}
