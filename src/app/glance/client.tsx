"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Wallet, BarChart3, Zap, AlertTriangle, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface BudgetRow {
  category: string;
  label: string;
  budgeted: number;
  spent: number;
}

interface GoalRow {
  name: string;
  currentAmount: number;
  targetAmount: number;
  type: string;
  onTrack: boolean;
}

interface Props {
  month: number;
  year: number;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyDebtPayments: number;
  totalContributions: number;
  cashFlow: number;
  savingsRate: number;
  emergencyMonths: number;
  dtiRatio: number;
  budgetRows: BudgetRow[];
  goalRows: GoalRow[];
  lastSynced: string | null;
}

function pctColor(pct: number): string {
  if (pct > 100) return "text-red-500";
  if (pct >= 80) return "text-amber-500";
  return "text-emerald-600";
}

function barColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function GlanceClient({
  month,
  year,
  netWorth,
  totalAssets,
  totalDebts,
  monthlyIncome,
  monthlyExpenses,
  monthlyDebtPayments,
  totalContributions,
  cashFlow,
  savingsRate,
  emergencyMonths,
  dtiRatio,
  budgetRows,
  goalRows,
  lastSynced,
}: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        fetch("/api/plaid/balances", { method: "POST" }),
        fetch("/api/plaid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ]);
      router.refresh();
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  const totalBudgeted = budgetRows.reduce((s, r) => s + r.budgeted, 0);
  const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);
  const totalPct =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">CapitalOS</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Syncing…" : "Refresh"}
        </Button>
      </div>

      {/* Budget Alerts */}
      {(() => {
        const overBudget = budgetRows.filter((r) => r.budgeted > 0 && r.spent > r.budgeted);
        const nearLimit = budgetRows.filter((r) => {
          const pct = r.budgeted > 0 ? (r.spent / r.budgeted) * 100 : 0;
          return pct >= 80 && pct <= 100;
        });
        if (overBudget.length === 0 && nearLimit.length === 0) return null;
        return (
          <div className="space-y-1.5">
            {overBudget.map((r) => (
              <div key={r.category} className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="text-xs">
                  <strong>{r.label}</strong> over budget — {formatCurrency(r.spent)}/{formatCurrency(r.budgeted)}
                </span>
              </div>
            ))}
            {nearLimit.map((r) => {
              const pct = Math.round((r.spent / r.budgeted) * 100);
              return (
                <div key={r.category} className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-xs">
                    <strong>{r.label}</strong> at {pct}% — {formatCurrency(r.budgeted - r.spent)} left
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Net Worth */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-muted-foreground">
              Net Worth
            </span>
          </div>
          <p
            className={`text-3xl font-bold ${netWorth >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {formatCurrency(netWorth)}
          </p>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>
              Assets{" "}
              <strong className="text-foreground">
                {formatCurrency(totalAssets)}
              </strong>
            </span>
            <span>
              Debts{" "}
              <strong className="text-red-500">
                {formatCurrency(totalDebts)}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Cash Flow */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Monthly Cash Flow
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-emerald-600">
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">
                -{formatCurrency(monthlyExpenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Debt Payments</span>
              <span className="font-medium">
                -{formatCurrency(monthlyDebtPayments)}
              </span>
            </div>
            {totalContributions > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Investing</span>
                <span className="font-medium">
                  -{formatCurrency(totalContributions)}
                </span>
              </div>
            )}
            <div className="border-t pt-1.5 flex justify-between">
              <span className="font-medium">Free</span>
              <span
                className={`font-bold ${cashFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}
              >
                {formatCurrency(cashFlow)}/mo
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Status */}
      {budgetRows.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  Budget — {MONTH_NAMES[month - 1]} {year}
                </span>
              </div>
              <span className={`text-sm font-bold ${pctColor(totalPct)}`}>
                {totalPct}%
              </span>
            </div>

            {/* Overall bar */}
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs text-muted-foreground w-20">
                {formatCurrency(totalSpent)}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(totalPct)}`}
                  style={{ width: `${Math.min(totalPct, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-20 text-right">
                {formatCurrency(totalBudgeted)}
              </span>
            </div>

            {/* Per-category */}
            <div className="space-y-2 mt-3">
              {budgetRows
                .sort((a, b) => b.budgeted - a.budgeted)
                .map((r) => {
                  const pct =
                    r.budgeted > 0
                      ? Math.round((r.spent / r.budgeted) * 100)
                      : 0;
                  return (
                    <div key={r.category} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {r.label}
                        </span>
                        <span>
                          <span className={pctColor(pct)}>
                            {formatCurrency(r.spent)}
                          </span>
                          <span className="text-muted-foreground">
                            /{formatCurrency(r.budgeted)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Quick Stats
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p
                className={`text-lg font-bold ${savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 10 ? "text-amber-500" : "text-red-500"}`}
              >
                {savingsRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">Savings Rate</p>
            </div>
            <div className="text-center">
              <p
                className={`text-lg font-bold ${emergencyMonths >= 6 ? "text-emerald-600" : emergencyMonths >= 3 ? "text-amber-500" : "text-red-500"}`}
              >
                {emergencyMonths === Infinity
                  ? "N/A"
                  : `${emergencyMonths} mo`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Emergency Fund
              </p>
            </div>
            <div className="text-center">
              <p
                className={`text-lg font-bold ${dtiRatio <= 20 ? "text-emerald-600" : dtiRatio <= 43 ? "text-amber-500" : "text-red-500"}`}
              >
                {dtiRatio}%
              </p>
              <p className="text-[10px] text-muted-foreground">DTI Ratio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      {goalRows.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Goals
              </span>
            </div>
            <div className="space-y-2.5">
              {goalRows.map((g) => {
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                return (
                  <div key={g.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">{g.name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={g.onTrack ? "text-emerald-600" : "text-amber-500"}>
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${g.onTrack ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatCurrency(g.currentAmount)}</span>
                      <span>{formatCurrency(g.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last synced */}
      <p className="text-center text-[10px] text-muted-foreground pb-4">
        {lastSynced
          ? `Last synced: ${relativeTime(lastSynced)}`
          : "No Plaid accounts connected"}
      </p>
    </div>
  );
}
