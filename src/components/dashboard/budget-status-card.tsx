"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Wallet, AlertTriangle } from "lucide-react";
import { categoryLabel } from "@/lib/budget/helpers";

export interface BudgetStatusRow {
  category: string;
  budgeted: number;
  spent: number;
}

interface Props {
  rows: BudgetStatusRow[];
}

function pctBarColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function BudgetStatusCard({ rows }: Props) {
  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalPct =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const remaining = totalBudgeted - totalSpent;
  const overBudgetCount = rows.filter(
    (r) => r.budgeted > 0 && r.spent > r.budgeted,
  ).length;

  // Show top 6 categories by budgeted amount
  const topRows = [...rows]
    .sort((a, b) => b.budgeted - a.budgeted)
    .slice(0, 6);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Budget Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No budget set. Visit the Budget page to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Budget Status
          </CardTitle>
          {overBudgetCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {overBudgetCount} over
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Totals */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}
          </span>
          <span
            className={`font-medium ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {remaining >= 0
              ? `${formatCurrency(remaining)} left`
              : `${formatCurrency(Math.abs(remaining))} over`}
          </span>
        </div>

        {/* Overall bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctBarColor(totalPct)}`}
            style={{ width: `${Math.min(totalPct, 100)}%` }}
          />
        </div>

        {/* Per-category mini bars */}
        <div className="space-y-2 pt-1">
          {topRows.map((r) => {
            const pct =
              r.budgeted > 0 ? Math.round((r.spent / r.budgeted) * 100) : 0;
            return (
              <div key={r.category} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {categoryLabel(r.category)}
                  </span>
                  <span
                    className={`font-medium ${pct > 100 ? "text-red-500" : pct >= 80 ? "text-amber-500" : "text-muted-foreground"}`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pctBarColor(pct)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
