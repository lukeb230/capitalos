import type { NormalizedTransaction, ParseResult, BankFormat } from "./types";
import { autoCategory } from "./category-mapper";

function generateId(): string {
  return "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

/**
 * Extract text from a PDF file using pdf.js (runs client-side).
 * Returns the full text content of all pages.
 */
export async function extractPDFText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const items = content.items as Array<{ str: string; transform: number[] }>;
    const lines: Map<number, { x: number; text: string }[]> = new Map();

    for (const item of items) {
      const y = Math.round(item.transform[5]); // Y position (rounded to group nearby items)
      const x = item.transform[4]; // X position
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, text: item.str });
    }

    // Sort lines by Y (descending since PDF Y goes bottom-up) then items by X
    const sortedLines = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  ")
      );

    pages.push(sortedLines.join("\n"));
  }

  return pages.join("\n\n--- PAGE BREAK ---\n\n");
}

/**
 * Detect the bank/statement type from extracted PDF text.
 */
function detectPDFFormat(text: string): BankFormat {
  const upper = text.toUpperCase();
  if (upper.includes("USAA") && (upper.includes("CHECKING") || upper.includes("SAVINGS"))) return "usaa";
  if (upper.includes("USAA") && upper.includes("CREDIT CARD")) return "usaa";
  if (upper.includes("NAVY FEDERAL") || upper.includes("NFCU")) {
    if (upper.includes("VISA") || upper.includes("MASTERCARD") || upper.includes("CREDIT CARD")) return "nfcu_credit";
    return "nfcu_checking";
  }
  if (upper.includes("CHASE")) {
    if (upper.includes("CREDIT CARD") || upper.includes("SAPPHIRE") || upper.includes("FREEDOM")) return "chase_credit";
    return "chase_checking";
  }
  if (upper.includes("AMERICAN EXPRESS") || upper.includes("AMEX")) return "amex";
  return "unknown";
}

/**
 * Parse USAA checking/savings PDF text into transactions.
 * Format: Date(MM/DD)  Description  Debits  Credits  Balance
 * Multi-line descriptions follow the date line.
 */
function parseUSAAPDF(text: string): { transactions: NormalizedTransaction[]; yearInferred: boolean } {
  const transactions: NormalizedTransaction[] = [];

  // Extract statement year from "Statement Period: MM/DD/YYYY to MM/DD/YYYY"
  const periodMatch = text.match(/Statement Period:\s*(\d{2}\/\d{2}\/(\d{4}))/);
  const yearInferred = !periodMatch;
  const year = periodMatch ? periodMatch[2] : new Date().getFullYear().toString();

  // Match transaction lines: starts with MM/DD, has a dollar amount
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match: MM/DD followed by description and dollar amounts
    const match = line.match(/^(\d{2})\/(\d{2})\s+(.+)/);
    if (!match) continue;

    const [, month, day, rest] = match;
    const dateStr = `${year}-${month}-${day}`;

    // Skip "Beginning Balance" lines
    if (rest.includes("Beginning Balance")) continue;

    // Extract dollar amounts from the line
    const amounts = [...rest.matchAll(/\$([0-9,]+\.?\d*)/g)].map((m) =>
      parseFloat(m[1].replace(/,/g, ""))
    );

    if (amounts.length === 0) continue;

    // First description part (before the dollar amounts)
    const descMatch = rest.match(/^(.+?)\s+\$/);
    let description = descMatch ? descMatch[1].trim() : rest.split("$")[0].trim();

    // Gather continuation lines (indented lines that follow, before next date line)
    for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
      const nextLine = lines[j].trim();
      if (!nextLine || /^\d{2}\/\d{2}\s/.test(nextLine) || nextLine.startsWith("Online:") || nextLine.startsWith("USAA")) break;
      if (!nextLine.startsWith("$") && !nextLine.match(/^\*+/) && nextLine.length > 2) {
        description += " " + nextLine;
        break; // take only the first continuation line for description
      }
    }

    // Determine if debit or credit based on column position or keywords
    const isDebit = rest.includes("WITHDRAWAL") || rest.includes("DEBIT") || rest.includes("CHECK") ||
      rest.includes("Bill Pay") || rest.includes("Transfer to");
    const isCredit = rest.includes("DEP") || rest.includes("DEPOSIT") || rest.includes("CREDIT") ||
      rest.includes("Transfer from") || rest.includes("Pay ");

    // Use the first non-balance amount (balance is usually the last/largest)
    const amount = amounts[0];

    // If we can determine direction from keywords, use that; otherwise check position
    const isIncome = isCredit && !isDebit;

    transactions.push({
      id: generateId(),
      date: dateStr,
      description: description.substring(0, 80),
      amount,
      isIncome,
      category: autoCategory(description),
      source: "usaa",
      excluded: false,
      accountType: "checking",
      accountLabel: "PDF Statement",
    });
  }

  return { transactions, yearInferred };
}

/**
 * Parse Navy Federal Credit Card PDF text into transactions.
 * Format: Trans Date  Post Date  Reference No.  Description  Amount
 */
function parseNFCUCreditPDF(text: string): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  const lines = text.split("\n");
  let inPayments = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track section
    if (line.includes("PAYMENTS AND CREDITS")) { inPayments = true; continue; }
    if (line.includes("PURCHASES") || line.includes("TRANSACTIONS")) { inPayments = false; }
    if (line.includes("TOTAL ") || line.includes("INTEREST CHARGE")) continue;
    if (line.includes("FOREIGN CURRENCY")) continue;

    // Match: MM/DD/YY  MM/DD/YY  RefNo  Description  $Amount
    const match = line.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+\d{2}\/\d{2}\/\d{2}\s+[\w]+\s+(.+?)\s+\$([0-9,]+\.?\d*)/);
    if (!match) continue;

    const [, month, day, yr, description, amountStr] = match;
    const year = "20" + yr;
    const amount = parseFloat(amountStr.replace(/,/g, ""));

    if (amount === 0) continue;

    transactions.push({
      id: generateId(),
      date: `${year}-${month}-${day}`,
      description: description.trim().substring(0, 80),
      amount,
      isIncome: inPayments,
      category: inPayments ? "other" : autoCategory(description),
      source: "nfcu_credit",
      excluded: false,
      accountType: "credit_card",
      accountLabel: "Navy Federal Credit Card",
    });
  }

  return transactions;
}

/**
 * Parse a PDF file into normalized transactions.
 * Tries client-side text extraction first.
 */
export async function parsePDF(file: File): Promise<ParseResult & { _rawText?: string }> {
  let text = "";

  // Step 1: Extract text from PDF using pdf.js
  try {
    text = await extractPDFText(file);
  } catch (error) {
    // pdf.js failed — return with empty text so AI fallback can be tried
    return {
      format: "unknown",
      formatLabel: "PDF (text extraction failed)",
      transactions: [],
      errors: [`Could not extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`],
      dateRange: null,
      _rawText: "",
    };
  }

  if (!text || text.trim().length < 50) {
    return {
      format: "unknown",
      formatLabel: "PDF (no text content)",
      transactions: [],
      errors: ["PDF appears to be image-based or empty. AI parsing will be attempted."],
      dateRange: null,
      _rawText: text,
    };
  }

  const format = detectPDFFormat(text);
  const formatLabels: Record<string, string> = {
    usaa: "USAA (PDF)",
    nfcu_checking: "Navy Federal Checking (PDF)",
    nfcu_credit: "Navy Federal Credit Card (PDF)",
    chase_checking: "Chase Checking (PDF)",
    chase_credit: "Chase Credit Card (PDF)",
    amex: "American Express (PDF)",
    unknown: "Unknown PDF",
  };
  const formatLabel = formatLabels[format] || "Unknown PDF";

  // Step 2: Try client-side parsing for supported formats
  let transactions: NormalizedTransaction[] = [];
  const warnings: string[] = [];

  try {
    switch (format) {
      case "usaa": {
        const result = parseUSAAPDF(text);
        transactions = result.transactions;
        if (result.yearInferred) {
          warnings.push(`Statement year inferred as ${new Date().getFullYear()} — no date range found in PDF`);
        }
        break;
      }
      case "nfcu_credit":
        transactions = parseNFCUCreditPDF(text);
        break;
    }
  } catch {
    // Client-side parsing failed — will fall through to AI
  }

  // Step 3: If we got transactions, return them
  if (transactions.length > 0) {
    transactions.sort((a, b) => a.date.localeCompare(b.date));
    return {
      format,
      formatLabel,
      transactions,
      errors: warnings,
      dateRange: { from: transactions[0].date, to: transactions[transactions.length - 1].date },
    };
  }

  // Step 4: No transactions found — always return raw text for AI fallback
  return {
    format,
    formatLabel: formatLabel + " (needs AI parsing)",
    transactions: [],
    errors: [],
    dateRange: null,
    _rawText: text,
  };
}
