export type BankFormat = "chase_checking" | "chase_credit" | "usaa" | "nfcu_checking" | "nfcu_credit" | "amex" | "unknown";

export type AccountType = "checking" | "credit_card" | "savings";

export interface NormalizedTransaction {
  id: string;
  date: string; // ISO date string
  description: string;
  amount: number; // always positive
  isIncome: boolean;
  category: string;
  source: BankFormat;
  excluded: boolean;
  accountType: AccountType;
  accountLabel: string; // e.g. "USAA Checking", "AMEX Credit Card"
}

export interface ParseResult {
  format: BankFormat;
  formatLabel: string;
  transactions: NormalizedTransaction[];
  errors: string[];
  dateRange: { from: string; to: string } | null;
}

export interface CategoryGrade {
  category: string;
  budgeted: number;
  actual: number;
  ratio: number;
  grade: string;
  diff: number;
}

export interface CheckinGrade {
  categories: CategoryGrade[];
  overallGrade: string;
  totalBudgeted: number;
  totalActual: number;
  totalDiff: number;
}

export interface CheckinSummary {
  id: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  overallGrade: string;
  createdAt: string;
}

export type WizardStep = "upload" | "review" | "grade" | "suggestions";
