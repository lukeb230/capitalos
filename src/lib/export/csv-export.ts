export function generateCSV(data: Record<string, unknown>): string {
  const sections: string[] = [];

  // Income
  if (data.incomes && Array.isArray(data.incomes)) {
    sections.push("INCOME SOURCES");
    sections.push("Name,Amount,Frequency,Tax Rate (%)");
    for (const i of data.incomes as { name: string; amount: number; frequency: string; taxRate: number }[]) {
      sections.push(`"${i.name}",${i.amount},${i.frequency},${i.taxRate}`);
    }
    sections.push("");
  }

  // Expenses
  if (data.expenses && Array.isArray(data.expenses)) {
    sections.push("MONTHLY EXPENSES");
    sections.push("Name,Amount,Frequency,Category,Fixed");
    for (const e of data.expenses as { name: string; amount: number; frequency: string; category: string; isFixed: boolean }[]) {
      sections.push(`"${e.name}",${e.amount},${e.frequency},${e.category},${e.isFixed}`);
    }
    sections.push("");
  }

  // Debts
  if (data.debts && Array.isArray(data.debts)) {
    sections.push("DEBTS");
    sections.push("Name,Balance,Interest Rate (%),Monthly Payment,Type");
    for (const d of data.debts as { name: string; balance: number; interestRate: number; minimumPayment: number; type: string }[]) {
      sections.push(`"${d.name}",${d.balance},${d.interestRate},${d.minimumPayment},${d.type}`);
    }
    sections.push("");
  }

  // Assets
  if (data.assets && Array.isArray(data.assets)) {
    sections.push("ASSETS");
    sections.push("Name,Value,Type,Growth Rate (%),Monthly Contribution");
    for (const a of data.assets as { name: string; value: number; type: string; growthRate: number; monthlyContribution: number }[]) {
      sections.push(`"${a.name}",${a.value},${a.type},${a.growthRate},${a.monthlyContribution}`);
    }
    sections.push("");
  }

  // Goals
  if (data.goals && Array.isArray(data.goals)) {
    sections.push("GOALS");
    sections.push("Name,Target,Current,Target Date,Type,Priority");
    for (const g of data.goals as { name: string; targetAmount: number; currentAmount: number; targetDate: string; type: string; priority: number }[]) {
      sections.push(`"${g.name}",${g.targetAmount},${g.currentAmount},${g.targetDate},${g.type},${g.priority}`);
    }
    sections.push("");
  }

  // Check-in history
  if (data.checkins && Array.isArray(data.checkins)) {
    sections.push("CHECK-IN HISTORY");
    sections.push("Month,Year,Income,Expenses,Net Worth,Grade");
    for (const c of data.checkins as { month: number; year: number; totalIncome: number; totalExpenses: number; netWorth: number | null; overallGrade: string }[]) {
      sections.push(`${c.month},${c.year},${c.totalIncome},${c.totalExpenses},${c.netWorth ?? ""},${c.overallGrade}`);
    }
  }

  return sections.join("\n");
}
