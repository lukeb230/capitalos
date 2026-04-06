import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportData {
  profileName: string;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  monthlyIncome: number;
  monthlyGrossIncome: number;
  monthlyExpenses: number;
  cashFlow: number;
  savingsRate: number;
  emergencyMonths: number;
  debtToIncomeRatio: number;
  incomes: { name: string; amount: number; frequency: string; taxRate: number }[];
  expenses: { name: string; amount: number; category: string }[];
  debts: { name: string; balance: number; interestRate: number; minimumPayment: number; type: string }[];
  assets: { name: string; value: number; type: string; growthRate: number; monthlyContribution: number }[];
  goals: { name: string; targetAmount: number; currentAmount: number; type: string }[];
}

function fmt(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString();
}

function fmtSigned(n: number): string {
  return (n < 0 ? "-" : "") + fmt(n);
}

// Draw a rounded rectangle
function roundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: [number, number, number]) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

// Draw a metric card
function metricCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number, number, number]) {
  roundedRect(doc, x, y, w, 28, 3, [248, 250, 252]);
  // Color accent bar at top
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, w, 3, 1.5, 1.5, "F");
  // Label
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(label, x + w / 2, y + 12, { align: "center" });
  // Value
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text(value, x + w / 2, y + 22, { align: "center" });
}

// Section header with colored bar
function sectionHeader(doc: jsPDF, y: number, title: string, color: [number, number, number]): number {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(14, y, 3, 8, "F");
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.text(title, 20, y + 6);
  return y + 12;
}

function getLastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function checkNewPage(doc: jsPDF, y: number, needed: number = 40): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function generatePDFReport(data: ReportData): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 0;

  // ========= HEADER =========
  // Green header bar
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, pw, 35, "F");

  // App name
  doc.setFontSize(24);
  doc.setTextColor(255);
  doc.text("CapitalOS", 16, 18);
  doc.setFontSize(11);
  doc.text("Financial Report", 16, 27);

  // Date + profile (right side)
  doc.setFontSize(10);
  doc.text(data.profileName, pw - 16, 18, { align: "right" });
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), pw - 16, 26, { align: "right" });

  y = 45;

  // ========= SNAPSHOT CARDS (2 rows of 4) =========
  const cardW = (pw - 28 - 18) / 4; // 4 cards with gaps
  const gap = 6;

  // Row 1
  metricCard(doc, 14, y, cardW, "NET WORTH", fmtSigned(data.netWorth), [59, 130, 246]);
  metricCard(doc, 14 + cardW + gap, y, cardW, "MONTHLY INCOME", fmt(data.monthlyIncome), [34, 197, 94]);
  metricCard(doc, 14 + (cardW + gap) * 2, y, cardW, "MONTHLY EXPENSES", fmt(data.monthlyExpenses), [239, 68, 68]);
  metricCard(doc, 14 + (cardW + gap) * 3, y, cardW, "CASH FLOW", fmtSigned(data.cashFlow), data.cashFlow >= 0 ? [34, 197, 94] : [239, 68, 68]);

  y += 34;

  // Row 2
  metricCard(doc, 14, y, cardW, "TOTAL ASSETS", fmt(data.totalAssets), [34, 197, 94]);
  metricCard(doc, 14 + cardW + gap, y, cardW, "TOTAL DEBTS", fmt(data.totalDebts), [239, 68, 68]);
  metricCard(doc, 14 + (cardW + gap) * 2, y, cardW, "SAVINGS RATE", `${data.savingsRate}%`, data.savingsRate >= 20 ? [34, 197, 94] : [245, 158, 11]);
  metricCard(doc, 14 + (cardW + gap) * 3, y, cardW, "EMERGENCY FUND", `${data.emergencyMonths} mo`, data.emergencyMonths >= 6 ? [34, 197, 94] : [245, 158, 11]);

  y += 40;

  // ========= INCOME SOURCES =========
  if (data.incomes.length > 0) {
    y = checkNewPage(doc, y, 50);
    y = sectionHeader(doc, y, "Income Sources", [59, 130, 246]);

    autoTable(doc, {
      startY: y,
      head: [["Source", "Amount", "Frequency", "Tax Rate", "Net Monthly"]],
      body: data.incomes.map((i) => {
        const monthly = i.frequency === "annual" ? i.amount / 12 : i.frequency === "biweekly" ? (i.amount * 26) / 12 : i.amount;
        const net = monthly * (1 - i.taxRate / 100);
        return [i.name, fmt(i.amount), i.frequency.charAt(0).toUpperCase() + i.frequency.slice(1), `${i.taxRate}%`, fmt(net)];
      }),
      theme: "plain",
      headStyles: { fillColor: [240, 245, 255], textColor: [59, 130, 246], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });

    y = getLastY(doc) + 14;
  }

  // ========= EXPENSES =========
  if (data.expenses.length > 0) {
    y = checkNewPage(doc, y, 50);
    y = sectionHeader(doc, y, "Monthly Expenses", [245, 158, 11]);

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const e of data.expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }
    const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    autoTable(doc, {
      startY: y,
      head: [["Category", "Monthly Amount", "Annual Amount", "% of Expenses"]],
      body: sortedCategories.map(([cat, amt]) => {
        const pct = data.monthlyExpenses > 0 ? ((amt / data.monthlyExpenses) * 100).toFixed(1) : "0";
        return [cat.charAt(0).toUpperCase() + cat.slice(1), fmt(amt), fmt(amt * 12), `${pct}%`];
      }),
      theme: "plain",
      headStyles: { fillColor: [255, 251, 235], textColor: [180, 120, 0], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });

    y = getLastY(doc) + 14;
  }

  // ========= DEBTS =========
  if (data.debts.length > 0) {
    y = checkNewPage(doc, y, 50);
    y = sectionHeader(doc, y, "Debts", [239, 68, 68]);

    autoTable(doc, {
      startY: y,
      head: [["Name", "Balance", "Interest Rate", "Monthly Payment", "Type"]],
      body: data.debts.map((d) => [
        d.name, fmt(d.balance), `${d.interestRate}%`, fmt(d.minimumPayment),
        d.type.charAt(0).toUpperCase() + d.type.slice(1),
      ]),
      theme: "plain",
      headStyles: { fillColor: [254, 242, 242], textColor: [220, 50, 50], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });

    y = getLastY(doc) + 14;
  }

  // ========= ASSETS =========
  if (data.assets.length > 0) {
    y = checkNewPage(doc, y, 50);
    y = sectionHeader(doc, y, "Assets", [34, 197, 94]);

    autoTable(doc, {
      startY: y,
      head: [["Name", "Value", "Type", "Growth Rate", "Monthly Contrib."]],
      body: data.assets.map((a) => [
        a.name, fmt(a.value),
        a.type.charAt(0).toUpperCase() + a.type.slice(1),
        `${a.growthRate}%`, a.monthlyContribution > 0 ? fmt(a.monthlyContribution) : "--",
      ]),
      theme: "plain",
      headStyles: { fillColor: [240, 253, 244], textColor: [22, 163, 74], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });

    y = getLastY(doc) + 14;
  }

  // ========= GOALS =========
  if (data.goals.length > 0) {
    y = checkNewPage(doc, y, 50);
    y = sectionHeader(doc, y, "Financial Goals", [168, 85, 247]);

    autoTable(doc, {
      startY: y,
      head: [["Goal", "Target", "Current", "Progress", "Type"]],
      body: data.goals.map((g) => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        return [
          g.name, fmt(g.targetAmount), fmt(g.currentAmount), `${pct}%`,
          g.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        ];
      }),
      theme: "plain",
      headStyles: { fillColor: [245, 240, 255], textColor: [140, 70, 220], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });

    y = getLastY(doc) + 14;
  }

  // ========= DISCLAIMER =========
  y = checkNewPage(doc, y, 30);
  doc.setFontSize(7);
  doc.setTextColor(160);
  doc.text("This report is generated for informational purposes only and does not constitute financial advice.", pw / 2, y, { align: "center" });
  doc.text("Projections are based on current data and assumptions. Actual results may vary.", pw / 2, y + 4, { align: "center" });

  // ========= FOOTER ON ALL PAGES =========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Green footer bar
    doc.setFillColor(34, 197, 94);
    doc.rect(0, ph - 8, pw, 8, "F");
    doc.setFontSize(7);
    doc.setTextColor(255);
    doc.text(`CapitalOS Financial Report | ${data.profileName} | Page ${i} of ${pageCount}`, pw / 2, ph - 3, { align: "center" });
  }

  return doc;
}
