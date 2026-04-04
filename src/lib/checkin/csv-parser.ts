import type { AccountType, BankFormat, NormalizedTransaction, ParseResult } from "./types";
import { autoCategory } from "./category-mapper";

function generateId(): string {
  return "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): string | null {
  // Handle MM/DD/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const [, m, d, y] = match;
    const year = y.length === 2 ? (parseInt(y) > 50 ? "19" + y : "20" + y) : y;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split("T")[0];
  return null;
}

// Split CSV text into logical rows, handling multi-line quoted fields
function splitCSVRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) rows.push(current);
      current = "";
      // Skip \r\n as single newline
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function detectFormat(headers: string[]): BankFormat {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const joined = lower.join("|");

  // Chase checking: has "Details", "Posting Date", "Balance"
  if (joined.includes("details") && joined.includes("posting date") && joined.includes("balance")) return "chase_checking";

  // Chase credit: has "Transaction Date", "Post Date", "Category", "Type"
  if (joined.includes("transaction date") && joined.includes("post date") && joined.includes("category") && joined.includes("type")) return "chase_credit";

  // Amex: has "Extended Details" or "Appears On Your Statement As" or "Card Member" or "Account #"
  if (joined.includes("extended details") || joined.includes("appears on your statement") || joined.includes("card member") || joined.includes("account #") || joined.includes("account number")) return "amex";

  // Amex alternate: "Date, Description, Amount" with "Reference" or "Category" (11+ cols)
  if (joined.includes("reference") && joined.includes("date") && joined.includes("amount")) return "amex";

  // NFCU checking: has separate "Debit" and "Credit" columns
  if (joined.includes("debit") && joined.includes("credit")) return "nfcu_checking";

  // NFCU credit: has "Transaction Date" + "Post Date" (without Category/Type)
  if (joined.includes("transaction date") && joined.includes("post date")) return "nfcu_credit";

  // Amex simple 3-col: Date, Description, Amount (no "Original Description" which is USAA)
  if (lower.length <= 5 && lower[0] === "date" && !joined.includes("original description")) {
    if (lower.includes("description") && lower.includes("amount")) return "amex";
  }

  // USAA: has "Date", "Description", "Amount" (often with "Original Description")
  if (joined.includes("date") && joined.includes("description") && joined.includes("amount")) return "usaa";

  return "unknown";
}

const FORMAT_LABELS: Record<BankFormat, string> = {
  chase_checking: "Chase Checking/Savings",
  chase_credit: "Chase Credit Card",
  usaa: "USAA",
  nfcu_checking: "Navy Federal Checking/Savings",
  nfcu_credit: "Navy Federal Credit Card",
  amex: "American Express",
  unknown: "Unknown Format",
};

export const DEFAULT_ACCOUNT_TYPE: Record<BankFormat, AccountType> = {
  chase_checking: "checking",
  chase_credit: "credit_card",
  usaa: "checking",
  nfcu_checking: "checking",
  nfcu_credit: "credit_card",
  amex: "credit_card",
  unknown: "checking",
};

export const DEFAULT_ACCOUNT_LABEL: Record<BankFormat, string> = {
  chase_checking: "Chase Checking",
  chase_credit: "Chase Credit Card",
  usaa: "USAA Checking",
  nfcu_checking: "Navy Federal Checking",
  nfcu_credit: "Navy Federal Credit Card",
  amex: "AMEX Credit Card",
  unknown: "Account",
};

function parseChaseChecking(cols: string[]): { date: string | null; desc: string; amount: number } | null {
  // Details, Posting Date, Description, Amount, Type, Balance, Check or Slip
  if (cols.length < 4) return null;
  return { date: parseDate(cols[1]), desc: cols[2], amount: parseFloat(cols[3]) };
}

function parseChaseCredit(cols: string[]): { date: string | null; desc: string; amount: number } | null {
  // Transaction Date, Post Date, Description, Category, Type, Amount, Memo
  if (cols.length < 6) return null;
  return { date: parseDate(cols[0]), desc: cols[2], amount: parseFloat(cols[5]) };
}

function parseUSAA(cols: string[], colCount: number): { date: string | null; desc: string; amount: number } | null {
  // 5-col: Date, Description, Original Description, Category, Amount
  // 3-col: Date, Description, Amount
  if (colCount >= 5 && cols.length >= 5) {
    return { date: parseDate(cols[0]), desc: cols[1] || cols[2], amount: parseFloat(cols[4]) };
  }
  if (cols.length >= 3) {
    return { date: parseDate(cols[0]), desc: cols[1], amount: parseFloat(cols[cols.length - 1]) };
  }
  return null;
}

function parseNFCUChecking(cols: string[], headers: string[]): { date: string | null; desc: string; amount: number; isIncome: boolean } | null {
  // Date, No., Description, Debit, Credit (possibly Balance)
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === "date");
  const descIdx = headers.findIndex((h) => h.toLowerCase() === "description");
  const debitIdx = headers.findIndex((h) => h.toLowerCase() === "debit");
  const creditIdx = headers.findIndex((h) => h.toLowerCase() === "credit");

  if (dateIdx < 0 || descIdx < 0) return null;

  const debit = debitIdx >= 0 ? parseFloat(cols[debitIdx]) || 0 : 0;
  const credit = creditIdx >= 0 ? parseFloat(cols[creditIdx]) || 0 : 0;

  if (debit === 0 && credit === 0) return null;

  return {
    date: parseDate(cols[dateIdx]),
    desc: cols[descIdx],
    amount: debit > 0 ? debit : credit,
    isIncome: credit > 0,
  };
}

function parseNFCUCredit(cols: string[]): { date: string | null; desc: string; amount: number } | null {
  // Transaction Date, Post Date, Description, Amount
  if (cols.length < 4) return null;
  return { date: parseDate(cols[0]), desc: cols[2], amount: parseFloat(cols[3]) };
}

function parseAmex(cols: string[], headers: string[]): { date: string | null; desc: string; amount: number } | null {
  // Multiple Amex formats:
  // Format A (5+ cols): Date, Description, Card Member, Account #, Amount
  // Format B (5 cols): Date, Description, Category, Type, Amount
  // Format C (3 cols): Date, Description, Amount
  // Format D (7+ cols): Date, Ref, Amount, Payee, Memo...

  const lower = headers.map((h) => h.toLowerCase().trim());

  // Find the Amount column by header name
  const amountIdx = lower.indexOf("amount");
  const dateIdx = lower.indexOf("date");
  const descIdx = lower.indexOf("description");

  // If we found named columns, use them
  if (amountIdx >= 0 && dateIdx >= 0) {
    const desc = descIdx >= 0 ? cols[descIdx] : cols[1];
    const amount = parseFloat(cols[amountIdx]);
    if (isNaN(amount)) return null;
    return { date: parseDate(cols[dateIdx]), desc, amount };
  }

  // Fallback: assume Date(0), Description(1), Amount(2) for 3-col format
  if (cols.length >= 3) {
    return { date: parseDate(cols[0]), desc: cols[1], amount: parseFloat(cols[2]) };
  }

  return null;
}

export function parseCSV(csvText: string): ParseResult {
  const lines = splitCSVRows(csvText);
  if (lines.length < 2) return { format: "unknown", formatLabel: "Unknown", transactions: [], errors: ["File is empty or has no data rows"], dateRange: null };

  const headers = parseCSVLine(lines[0]);
  const format = detectFormat(headers);
  const formatLabel = FORMAT_LABELS[format];
  const headerCount = headers.length;

  if (format === "unknown") {
    return { format, formatLabel, transactions: [], errors: ["Could not detect bank format from headers: " + headers.join(", ")], dateRange: null };
  }

  const transactions: NormalizedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2 || cols.every((c) => !c)) continue; // skip empty rows

    try {
      let parsed: { date: string | null; desc: string; amount: number; isIncome?: boolean } | null = null;

      switch (format) {
        case "chase_checking": parsed = parseChaseChecking(cols); break;
        case "chase_credit": parsed = parseChaseCredit(cols); break;
        case "usaa": parsed = parseUSAA(cols, headerCount); break;
        case "nfcu_checking": parsed = parseNFCUChecking(cols, headers) as typeof parsed; break;
        case "nfcu_credit": parsed = parseNFCUCredit(cols); break;
        case "amex": parsed = parseAmex(cols, headers); break;
      }

      if (!parsed || !parsed.date || isNaN(parsed.amount)) {
        errors.push(`Row ${i + 1}: Could not parse`);
        continue;
      }

      // Determine income vs expense based on bank format:
      // Most banks: negative = expense, positive = income
      // Amex: POSITIVE = charge (expense), NEGATIVE = payment/credit (income)
      // NFCU checking: uses separate debit/credit columns (handled in parser)
      const isIncome = parsed.isIncome !== undefined
        ? parsed.isIncome
        : format === "amex"
        ? parsed.amount < 0
        : parsed.amount > 0;
      const absAmount = Math.abs(parsed.amount);

      if (absAmount === 0) continue; // skip zero transactions

      transactions.push({
        id: generateId(),
        date: parsed.date,
        description: parsed.desc?.trim() || "Unknown transaction",
        amount: absAmount,
        isIncome,
        category: autoCategory(parsed.desc),
        source: format,
        excluded: false,
        accountType: DEFAULT_ACCOUNT_TYPE[format],
        accountLabel: DEFAULT_ACCOUNT_LABEL[format],
      });
    } catch {
      errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  // Sort by date
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const dateRange = transactions.length > 0
    ? { from: transactions[0].date, to: transactions[transactions.length - 1].date }
    : null;

  return { format, formatLabel, transactions, errors, dateRange };
}
