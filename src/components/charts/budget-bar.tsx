"use client";

import { formatCurrency } from "@/lib/utils";

interface Props {
  income: number;
  expenses: number;
  debtPayments: number;
  contributions: number;
}

export function BudgetBar({ income, expenses, debtPayments, contributions }: Props) {
  const surplus = income - expenses - debtPayments - contributions;
  // When in deficit, use total outflows as denominator so segments fit within the bar
  const totalOutflows = expenses + debtPayments + contributions + Math.max(0, surplus);
  const total = Math.max(income, totalOutflows, 1);

  const segments = [
    { label: "Expenses", amount: expenses, color: "#ef4444" },
    { label: "Debt", amount: debtPayments, color: "#f97316" },
    { label: "Contributions", amount: contributions, color: "#06b6d4" },
    { label: surplus >= 0 ? "Surplus" : "Deficit", amount: Math.abs(surplus), color: surplus >= 0 ? "#22c55e" : "#dc2626" },
  ].filter((s) => s.amount > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Monthly Cash Flow</span>
        <span className="text-xs text-muted-foreground">{formatCurrency(income)} income</span>
      </div>

      {/* Single stacked bar */}
      <div className="h-8 bg-muted rounded-lg overflow-hidden flex">
        {segments.map((seg) => {
          const pct = (seg.amount / total) * 100;
          return (
            <div
              key={seg.label}
              className="h-full flex items-center justify-center transition-all duration-300 relative group"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => {
          const pct = (seg.amount / total) * 100;
          return (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-muted-foreground">{seg.label}</span>
              <span className="text-xs font-medium">{formatCurrency(seg.amount)}</span>
              <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
