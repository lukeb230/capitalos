import { NextResponse } from "next/server";

// Extract text from PDF using pdf.js server-side
async function extractTextFromPDF(base64Data: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = Buffer.from(base64Data, "base64");
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;

    // Group by Y position to reconstruct lines
    const lines: Map<number, { x: number; text: string }[]> = new Map();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, text: item.str });
    }

    const sortedLines = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  ")
      );

    pages.push(sortedLines.join("\n"));
  }

  return pages.join("\n\n");
}

export async function POST(req: Request) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { pdfBase64, text, bankHint } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  // If we received a PDF as base64, extract text server-side first
  let statementText = text || "";
  if (pdfBase64 && !statementText) {
    try {
      statementText = await extractTextFromPDF(pdfBase64);
    } catch (error) {
      return NextResponse.json({
        transactions: [],
        error: `PDF text extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  }

  if (!statementText || statementText.trim().length < 20) {
    return NextResponse.json({ transactions: [], error: "No text could be extracted from the PDF" });
  }

  const systemPrompt = `You are a bank statement parser. Extract ALL transactions from the following bank statement text.

${bankHint ? `This appears to be a ${bankHint} statement.` : ""}

Return ONLY valid JSON in this exact format:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Merchant or transaction description",
      "amount": 123.45,
      "isIncome": false
    }
  ]
}

RULES:
- "amount" must always be a positive number
- "isIncome" is true for deposits, payments received, credits, direct deposits, ACH deposits. False for purchases, withdrawals, charges, fees, bill payments, transfers out.
- "date" must be in YYYY-MM-DD format. If only MM/DD is shown, infer the year from context (statement period, other dates).
- Skip "Beginning Balance", "Ending Balance", totals, subtotals, and header rows
- Skip foreign currency detail lines (e.g. "FOREIGN CURRENCY 27.00 EUR")
- Include ALL individual transactions — do not summarize or group them
- Clean up descriptions — remove reference numbers, extra whitespace, account masks (****)
- For USAA statements: lines with "ACH WITHDRAWAL", "DEBIT", "Bill Pay", "Transfer to" are expenses. Lines with "ACH DEP", "DEPOSIT", "Transfer from" are income.
- Return an empty array if no transactions can be extracted`;

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
        messages: [{ role: "user", content: statementText.substring(0, 15000) }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI service error" }, { status: 500 });
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text || "";

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
    } catch {}

    return NextResponse.json({ transactions: [], error: "Could not parse AI response" });
  } catch {
    return NextResponse.json({ transactions: [], error: "AI request failed" });
  }
}
