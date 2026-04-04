"use client";

import { formatCurrency } from "@/lib/utils";

interface SpendingCategory {
  name: string;
  amount: number;
  color: string;
}

interface Props {
  categories: SpendingCategory[];
  totalIncome: number;
  surplus: number;
}

const COLORS: Record<string, string> = {
  Housing: "#3b82f6",
  Transport: "#f59e0b",
  Food: "#22c55e",
  Utilities: "#8b5cf6",
  Subscriptions: "#ec4899",
  Entertainment: "#f97316",
  Insurance: "#14b8a6",
  Other: "#6b7280",
  "Debt Payments": "#ef4444",
  Contributions: "#06b6d4",
};

function getColor(name: string): string {
  return COLORS[name] || COLORS.Other;
}

export function SpendingBreakdown({ categories, totalIncome, surplus }: Props) {
  const allItems = [
    ...categories.map((c) => ({ ...c, color: c.color || getColor(c.name) })),
  ];

  // Sort by amount descending
  allItems.sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-2.5">
      {allItems.map((item) => {
        const pct = totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0;
        return (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-sm">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                <span className="text-sm font-medium w-20 text-right">{formatCurrency(item.amount)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, pct)}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}

      {/* Surplus row */}
      {surplus > 0 && (
        <div className="space-y-1 pt-1 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-emerald-500" />
              <span className="text-sm font-medium">Free Surplus</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{totalIncome > 0 ? ((surplus / totalIncome) * 100).toFixed(0) : 0}%</span>
              <span className="text-sm font-bold text-emerald-600 w-20 text-right">{formatCurrency(surplus)}</span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${totalIncome > 0 ? Math.min(100, (surplus / totalIncome) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
