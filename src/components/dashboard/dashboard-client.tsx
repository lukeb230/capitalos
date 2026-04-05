"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { MilestoneTimeline } from "@/components/charts/milestone-timeline";
import { SpendingBreakdown } from "@/components/charts/spending-breakdown";
import { DTIGauge } from "@/components/charts/dti-gauge";
import { SpendingDonut } from "@/components/charts/spending-donut";
import { AssetDonut } from "@/components/charts/asset-donut";
import { NetWorthHistoryChart } from "@/components/charts/net-worth-history";
import { calculateTotalTax, type FilingStatus } from "@/lib/engine/tax";
import { generateCSV } from "@/lib/export/csv-export";
import { formatCurrency, formatMonths } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Shield,
  Target,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Zap,
  Sparkles,
  Eye,
  EyeOff,
  Settings,
  GripVertical,
  X,
} from "lucide-react";
import type {
  MonthlySnapshot,
  DebtPayoffResult,
  GoalProjection,
  GoalInput,
  MilestoneEstimate,
  SavingsProjectionPoint,
} from "@/lib/engine/types";

interface SpendingCategory {
  name: string;
  amount: number;
  color: string;
}

interface Props {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyDebtPayments: number;
  cashFlow: number;
  freeSurplus: number;
  totalContributions: number;
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  collateralEquity: number;
  emergencyMonths: number;
  savingsRate: number;
  dtiRatio: number;
  projections1yr: MonthlySnapshot[];
  projections5yr: MonthlySnapshot[];
  debts: { id: string; name: string; balance: number; originalLoan?: number | null }[];
  debtPayoffs: DebtPayoffResult[];
  goalProjections: GoalProjection[];
  goals: GoalInput[];
  milestones: MilestoneEstimate[];
  savingsProjection: SavingsProjectionPoint[];
  spendingCategories: SpendingCategory[];
  fixedExpenses: number;
  variableExpenses: number;
  assetAllocation: { type: string; value: number }[];
  assetBreakdown: { name: string; value: number }[];
  netWorthHistory: { label: string; netWorth: number }[];
  monthlyGrossIncome: number;
  filingStatus: string | null;
  taxState: string | null;
}

function StatCard({
  title, value, subtitle, icon: Icon, trend,
}: {
  title: string; value: string; subtitle: string; icon: React.ElementType; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="rounded-lg bg-muted p-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
        </div>
        <p className={`text-xl font-bold tracking-tight ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

type DashboardSection =
  | "projection" | "waterfall" | "dti" | "debtPayoff" | "goals" | "milestones" | "aiInsights"
  | "incomeVsExpenses" | "expenseDonut" | "fixedVsVariable" | "assetAllocation"
  | "netWorthBreakdown" | "debtInterestCost" | "goalCountdown" | "debtFreeCountdown";

const sectionLabels: Record<DashboardSection, string> = {
  projection: "Net Worth Projection",
  waterfall: "Spending Breakdown",
  dti: "Debt-to-Income Ratio",
  debtPayoff: "Debt Payoff",
  goals: "Goal Progress",
  milestones: "Milestones",
  aiInsights: "AI Insights",
  incomeVsExpenses: "Income vs Expenses",
  expenseDonut: "Expense Donut",
  fixedVsVariable: "Fixed vs Variable Expenses",
  assetAllocation: "Asset Allocation",
  netWorthBreakdown: "Net Worth Breakdown",
  debtInterestCost: "Debt Interest Cost",
  goalCountdown: "Goal Countdown",
  debtFreeCountdown: "Debt-Free Countdown",
};

const defaultSections: DashboardSection[] = ["projection", "waterfall", "dti", "debtPayoff", "goals", "milestones", "aiInsights"];

const optionalSections: DashboardSection[] = [
  "incomeVsExpenses", "expenseDonut", "fixedVsVariable", "assetAllocation",
  "netWorthBreakdown", "debtInterestCost", "goalCountdown", "debtFreeCountdown",
];

const allSections: DashboardSection[] = [...defaultSections, ...optionalSections];

function loadDashboardConfig(): { sections: DashboardSection[]; hidden: DashboardSection[] } {
  if (typeof window === "undefined") return { sections: [...allSections], hidden: [...optionalSections] };
  try {
    const saved = localStorage.getItem("dashboard-config");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge any new sections not present in saved config (hidden by default)
      const missing = allSections.filter((s) => !parsed.sections.includes(s));
      if (missing.length > 0) {
        parsed.sections = [...parsed.sections, ...missing];
        parsed.hidden = [...(parsed.hidden || []), ...missing];
      }
      return parsed;
    }
  } catch {}
  return { sections: [...allSections], hidden: [...optionalSections] };
}

function saveDashboardConfig(config: { sections: DashboardSection[]; hidden: DashboardSection[] }) {
  try { localStorage.setItem("dashboard-config", JSON.stringify(config)); } catch {}
}

export function DashboardClient({
  monthlyIncome, monthlyExpenses, monthlyDebtPayments, cashFlow, freeSurplus, totalContributions, netWorth, totalAssets, totalDebts, collateralEquity,
  emergencyMonths, savingsRate, dtiRatio, projections1yr, projections5yr, debts, debtPayoffs,
  goalProjections, goals, milestones, savingsProjection, spendingCategories,
  fixedExpenses, variableExpenses, assetAllocation, assetBreakdown,
  netWorthHistory, monthlyGrossIncome, filingStatus, taxState,
}: Props) {
  const [projectionRange, setProjectionRange] = useState<"1yr" | "5yr">("5yr");
  const [customizing, setCustomizing] = useState(false);
  const [config, setConfig] = useState(loadDashboardConfig);

  useEffect(() => { setConfig(loadDashboardConfig()); }, []);

  const projections = projectionRange === "1yr" ? projections1yr : projections5yr;
  const projectedNetWorth5yr = projections5yr[projections5yr.length - 1]?.netWorth ?? netWorth;

  const goalData = goalProjections.map((gp) => {
    const goal = goals.find((g) => g.id === gp.goalId);
    return { name: gp.goalName, currentAmount: goal?.currentAmount ?? 0, targetAmount: goal?.targetAmount ?? 0, onTrack: gp.onTrack };
  });

  function toggleSection(section: DashboardSection) {
    const newConfig = { ...config };
    if (newConfig.hidden.includes(section)) {
      newConfig.hidden = newConfig.hidden.filter((s) => s !== section);
      if (!newConfig.sections.includes(section)) newConfig.sections.push(section);
    } else {
      newConfig.hidden.push(section);
    }
    setConfig(newConfig);
    saveDashboardConfig(newConfig);
  }

  function moveSection(section: DashboardSection, direction: -1 | 1) {
    const newSections = [...config.sections];
    const idx = newSections.indexOf(section);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= newSections.length) return;
    [newSections[idx], newSections[newIdx]] = [newSections[newIdx], newSections[idx]];
    const newConfig = { ...config, sections: newSections };
    setConfig(newConfig);
    saveDashboardConfig(newConfig);
  }

  const visibleSections = config.sections.filter((s) => !config.hidden.includes(s));

  function renderSection(section: DashboardSection) {
    switch (section) {
      case "projection":
        return (
          <Card key={section}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Net Worth Projection</CardTitle>
                <div className="flex gap-1">
                  {(["1yr", "5yr"] as const).map((r) => (
                    <button key={r} onClick={() => setProjectionRange(r)} className={`px-3 py-1 text-xs rounded-md transition-colors ${projectionRange === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                      {r === "1yr" ? "1 Year" : "5 Year"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Projected: {formatCurrency(projectionRange === "1yr" ? (projections1yr[projections1yr.length - 1]?.netWorth ?? netWorth) : projectedNetWorth5yr)} in {projectionRange === "1yr" ? "1 year" : "5 years"}</p>
            </CardHeader>
            <CardContent>
              {projections.length > 0 ? <ProjectionChart data={projections} /> : <p className="text-muted-foreground text-center py-12">Add financial data to see projections</p>}
            </CardContent>
          </Card>
        );

      case "waterfall":
        return (
          <Card key={section}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Spending Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">Where your {formatCurrency(monthlyIncome)} net income goes each month</p>
            </CardHeader>
            <CardContent>
              {spendingCategories.length > 0 ? (
                <SpendingBreakdown categories={spendingCategories} totalIncome={monthlyIncome} surplus={freeSurplus} />
              ) : (
                <p className="text-muted-foreground text-center py-12">Add expenses to see your spending breakdown</p>
              )}
            </CardContent>
          </Card>
        );

      case "dti":
        return (
          <Card key={section}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Debt-to-Income Ratio</CardTitle>
              <p className="text-xs text-muted-foreground">
                {dtiRatio <= 36 ? "Lenders consider under 36% healthy" : dtiRatio <= 43 ? "Most lenders want under 43% for mortgage approval" : "Above 43% may limit borrowing options"}
              </p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DTIGauge ratio={dtiRatio} />
            </CardContent>
          </Card>
        );

      case "debtPayoff":
        return (
          <Card key={section}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />Debt Payoff</CardTitle>
            </CardHeader>
            <CardContent>
              {debtPayoffs.length > 0 ? (
                <div className="space-y-3">
                  {debtPayoffs.map((dp) => {
                    const debt = debts.find((d) => d.id === dp.debtId);
                    const paidPct = debt?.originalLoan && debt.originalLoan > 0
                      ? Math.min(100, Math.max(0, ((debt.originalLoan - debt.balance) / debt.originalLoan) * 100))
                      : null;
                    return (
                      <div key={dp.debtId} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{dp.debtName}</p>
                          <Badge variant={dp.monthsToPayoff <= 24 ? "default" : "secondary"} className="text-xs">{formatMonths(dp.monthsToPayoff)}</Badge>
                        </div>
                        {paidPct !== null && (
                          <div className="space-y-0.5">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{Math.round(paidPct)}% paid off</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(dp.totalInterestPaid)} interest</span>
                          <span>{dp.payoffDate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-muted-foreground text-center py-6 text-sm">No debts tracked</p>}
            </CardContent>
          </Card>
        );

      case "goals":
        return (
          <Card key={section}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Goal Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {goalData.length > 0 ? <MilestoneTimeline goals={goalData} /> : <p className="text-muted-foreground text-center py-6 text-sm">No goals set</p>}
            </CardContent>
          </Card>
        );

      case "milestones":
        return (
          <Card key={section}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {milestones.map((m, i) => {
                const pct = m.targetValue > 0 ? Math.min(100, (m.currentValue / m.targetValue) * 100) : 0;
                return (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{m.name}</p>
                      <Badge variant={m.achievable ? "default" : "destructive"} className="text-[10px]">{m.achievable ? formatMonths(m.estimatedMonths) : "N/A"}</Badge>
                    </div>
                    {m.name !== "Debt Free" && <Progress value={pct} className="h-1.5" />}
                    <p className="text-[10px] text-muted-foreground">{m.achievable ? `Est. ${m.estimatedDate}` : "Not achievable at current rate"}</p>
                  </div>
                );
              })}
              {milestones.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Add data to see milestone estimates</p>}
            </CardContent>
          </Card>
        );

      case "aiInsights":
        return (
          <Card key={section} className="border-blue-200 bg-gradient-to-b from-blue-50/80 to-white dark:from-blue-950/20 dark:to-card dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" />AI Insights<Badge variant="secondary" className="text-[10px] ml-auto">Preview</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cashFlow > 500 && <div className="flex gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" /><p>Strong {formatCurrency(cashFlow)}/mo surplus. Consider directing extra toward your highest-rate debt.</p></div>}
              {savingsRate < 20 && <div className="flex gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" /><p>Savings rate is {savingsRate}%. Aim for 20%+ to accelerate wealth building.</p></div>}
              {emergencyMonths < 6 && emergencyMonths !== Infinity && <div className="flex gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" /><p>Emergency fund covers {emergencyMonths} months. Build to 6 months before aggressive investing.</p></div>}
              {dtiRatio > 43 && <div className="flex gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" /><p>DTI ratio is {dtiRatio}% — above the 43% threshold. Reducing debt payments will improve borrowing capacity.</p></div>}
              <div className="pt-2 border-t"><p className="text-[10px] text-muted-foreground">Visit the AI Advisor for deeper analysis and to make changes via chat.</p></div>
            </CardContent>
          </Card>
        );

      case "incomeVsExpenses": {
        const totalOutflow = monthlyExpenses + monthlyDebtPayments + totalContributions;
        const maxBar = Math.max(monthlyIncome, totalOutflow, 1);
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Income vs Expenses</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Income</span><span className="font-medium text-emerald-600">{formatCurrency(monthlyIncome)}</span></div>
                <div className="h-6 bg-muted rounded-md overflow-hidden"><div className="h-full bg-emerald-500 rounded-md transition-all" style={{ width: `${(monthlyIncome / maxBar) * 100}%` }} /></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Total Outflow</span><span className="font-medium text-red-500">{formatCurrency(totalOutflow)}</span></div>
                <div className="h-6 bg-muted rounded-md overflow-hidden"><div className="h-full bg-red-500 rounded-md transition-all" style={{ width: `${(totalOutflow / maxBar) * 100}%` }} /></div>
              </div>
              <p className="text-xs text-muted-foreground text-center">{formatCurrency(monthlyIncome - totalOutflow)}/mo surplus</p>
            </CardContent>
          </Card>
        );
      }

      case "expenseDonut":
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Expense Donut</CardTitle></CardHeader>
            <CardContent>
              {spendingCategories.length > 0 ? (
                <SpendingDonut categories={spendingCategories} totalIncome={monthlyIncome} totalOutflow={monthlyExpenses + monthlyDebtPayments + totalContributions} surplus={freeSurplus} />
              ) : <p className="text-muted-foreground text-center py-8 text-sm">Add expenses to see breakdown</p>}
            </CardContent>
          </Card>
        );

      case "fixedVsVariable": {
        const totalExp = fixedExpenses + variableExpenses;
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Fixed vs Variable Expenses</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Fixed</span><span className="font-medium">{formatCurrency(fixedExpenses)} ({totalExp > 0 ? Math.round((fixedExpenses / totalExp) * 100) : 0}%)</span></div>
                <div className="h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${totalExp > 0 ? (fixedExpenses / totalExp) * 100 : 0}%` }} /></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Variable</span><span className="font-medium">{formatCurrency(variableExpenses)} ({totalExp > 0 ? Math.round((variableExpenses / totalExp) * 100) : 0}%)</span></div>
                <div className="h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${totalExp > 0 ? (variableExpenses / totalExp) * 100 : 0}%` }} /></div>
              </div>
              <p className="text-[10px] text-muted-foreground">Fixed expenses are committed. Variable expenses are where you have control.</p>
            </CardContent>
          </Card>
        );
      }

      case "assetAllocation":
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Asset Allocation</CardTitle></CardHeader>
            <CardContent>
              {assetAllocation.length > 0 ? (
                <AssetDonut data={assetAllocation} total={totalAssets} />
              ) : <p className="text-muted-foreground text-center py-8 text-sm">Add assets to see allocation</p>}
            </CardContent>
          </Card>
        );

      case "netWorthBreakdown": {
        const maxVal = Math.max(...assetBreakdown.map((a) => a.value), ...debts.map((d) => d.balance), 1);
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Net Worth Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {assetBreakdown.map((a) => (
                <div key={a.name} className="space-y-0.5">
                  <div className="flex justify-between text-xs"><span>{a.name}</span><span className="font-medium text-emerald-600">{formatCurrency(a.value)}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(a.value / maxVal) * 100}%` }} /></div>
                </div>
              ))}
              {debts.map((d) => (
                <div key={d.id} className="space-y-0.5">
                  <div className="flex justify-between text-xs"><span>{d.name}</span><span className="font-medium text-red-500">-{formatCurrency(d.balance)}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(d.balance / maxVal) * 100}%` }} /></div>
                </div>
              ))}
              {assetBreakdown.length === 0 && debts.length === 0 && <p className="text-muted-foreground text-center py-6 text-sm">Add assets and debts</p>}
            </CardContent>
          </Card>
        );
      }

      case "debtInterestCost": {
        const maxInterest = Math.max(...debtPayoffs.map((d) => d.totalInterestPaid === Infinity ? 0 : d.totalInterestPaid), 1);
        return (
          <Card key={section}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Debt Interest Cost</CardTitle>
              <p className="text-xs text-muted-foreground">Total interest you&apos;ll pay on each debt</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {debtPayoffs.filter((d) => d.totalInterestPaid !== Infinity).map((dp) => (
                <div key={dp.debtId} className="space-y-0.5">
                  <div className="flex justify-between text-xs"><span>{dp.debtName}</span><span className="font-medium text-red-500">{formatCurrency(dp.totalInterestPaid)}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${(dp.totalInterestPaid / maxInterest) * 100}%` }} /></div>
                </div>
              ))}
              {debtPayoffs.length === 0 && <p className="text-muted-foreground text-center py-6 text-sm">No debts tracked</p>}
            </CardContent>
          </Card>
        );
      }

      case "goalCountdown":
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Goal Countdown</CardTitle></CardHeader>
            <CardContent>
              {goals.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {goals.map((g) => {
                    const daysLeft = Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={g.id} className="text-center p-2 rounded-lg bg-muted/50" suppressHydrationWarning>
                        <p className="text-lg font-bold">{daysLeft <= 0 ? "Past Due" : daysLeft}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{g.name}</p>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-muted-foreground text-center py-4 text-sm">No goals set</p>}
            </CardContent>
          </Card>
        );

      case "debtFreeCountdown": {
        const maxMonths = debtPayoffs.length > 0
          ? Math.max(...debtPayoffs.map((d) => d.monthsToPayoff === Infinity ? 0 : d.monthsToPayoff))
          : 0;
        const debtFreeDays = maxMonths > 0 ? Math.round(maxMonths * 30.44) : 0;
        return (
          <Card key={section}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Debt-Free Countdown</CardTitle></CardHeader>
            <CardContent className="text-center py-2">
              {debtPayoffs.length > 0 && maxMonths > 0 ? (
                <>
                  <p className="text-3xl font-bold text-emerald-600">{debtFreeDays}</p>
                  <p className="text-xs text-muted-foreground">days until debt-free</p>
                  <p className="text-[10px] text-muted-foreground mt-1">({formatMonths(maxMonths)})</p>
                </>
              ) : debtPayoffs.length === 0 ? (
                <p className="text-sm text-emerald-600 font-medium">Debt free!</p>
              ) : (
                <p className="text-sm text-muted-foreground">Cannot determine at current payments</p>
              )}
            </CardContent>
          </Card>
        );
      }
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your financial command center</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const res = await fetch("/api/export");
              const data = await res.json();
              // JSON export
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `capitalos-backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
              URL.revokeObjectURL(url);
            } catch { alert("Export failed"); }
          }}>
            <ArrowDownRight className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const res = await fetch("/api/export");
              const data = await res.json();
              const csv = generateCSV(data);
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `capitalos-report-${new Date().toISOString().split("T")[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
            } catch { alert("CSV export failed"); }
          }}>
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const { generatePDFReport } = await import("@/lib/export/pdf-report");
              const res = await fetch("/api/export");
              const data = await res.json();
              const doc = generatePDFReport({
                profileName: data.profile?.name || "User",
                netWorth, totalAssets, totalDebts, monthlyIncome, monthlyExpenses, cashFlow, savingsRate, emergencyMonths,
                incomes: data.incomes || [], expenses: data.expenses || [],
                debts: data.debts || [], assets: data.assets || [], goals: data.goals || [],
              });
              doc.save(`capitalos-report-${new Date().toISOString().split("T")[0]}.pdf`);
            } catch { alert("PDF export failed"); }
          }}>
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCustomizing(!customizing)}>
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            {customizing ? "Done" : "Customize"}
          </Button>
        </div>
      </div>

      {/* Customization Panel */}
      {customizing && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Dashboard Sections</p>
            <div className="space-y-1.5">
              {allSections.map((section) => {
                const isHidden = config.hidden.includes(section);
                const configIdx = config.sections.indexOf(section);
                return (
                  <div key={section} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isHidden ? "opacity-50 bg-muted/30" : "bg-muted/50"}`}>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm flex-1">{sectionLabels[section]}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(section, -1)} disabled={configIdx <= 0}>
                        <span className="text-xs">&#9650;</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(section, 1)} disabled={configIdx >= config.sections.length - 1}>
                        <span className="text-xs">&#9660;</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleSection(section)}>
                        {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards Row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard title="Net Worth" value={formatCurrency(netWorth)} subtitle={`${formatCurrency(totalAssets)} assets - ${formatCurrency(totalDebts)} debts`} icon={TrendingUp} trend={netWorth >= 0 ? "up" : "down"} />
        <StatCard title="Monthly Income" value={formatCurrency(monthlyIncome)} subtitle="After taxes" icon={DollarSign} trend="up" />
        <StatCard title="Monthly Commitments" value={formatCurrency(monthlyExpenses + monthlyDebtPayments + totalContributions)} subtitle={`${formatCurrency(monthlyExpenses)} bills + ${formatCurrency(monthlyDebtPayments)} debt${totalContributions > 0 ? ` + ${formatCurrency(totalContributions)} invest` : ""}`} icon={ArrowDownRight} trend="down" />
        <StatCard title="Free Surplus" value={formatCurrency(freeSurplus)} subtitle={freeSurplus > 0 ? "After bills, debt & contributions" : "Over-committed"} icon={ArrowUpRight} trend={freeSurplus >= 0 ? "up" : "down"} />
        <StatCard title="Savings Rate" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Good" : "Needs work"} icon={PiggyBank} trend={savingsRate >= 20 ? "up" : savingsRate >= 10 ? "neutral" : "down"} />
        <StatCard title="Total Debt" value={formatCurrency(totalDebts)} subtitle={`${formatCurrency(monthlyDebtPayments)}/mo payments`} icon={CreditCard} trend="down" />
        <StatCard title="Emergency Fund" value={emergencyMonths === Infinity ? "N/A" : `${emergencyMonths} mo`} subtitle={emergencyMonths >= 6 ? "6+ mo expenses covered" : emergencyMonths >= 3 ? "3-6 mo expenses covered" : "Under 3 mo expenses"} icon={Shield} trend={emergencyMonths >= 6 ? "up" : emergencyMonths >= 3 ? "neutral" : "down"} />
      </div>

      {/* Net Worth History + Tax Estimate */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Net Worth History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Worth History</CardTitle>
          </CardHeader>
          <CardContent>
            <NetWorthHistoryChart data={netWorthHistory} />
          </CardContent>
        </Card>

        {/* Tax Estimate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Annual Tax Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const grossAnnual = monthlyGrossIncome * 12;
              const tax = calculateTotalTax(grossAnnual, (filingStatus as FilingStatus) || "single", taxState);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-muted-foreground">Gross Income</p><p className="text-lg font-bold">{formatCurrency(grossAnnual)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Take-Home</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(tax.takeHome)}</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">Federal</p><p className="text-sm font-medium">{formatCurrency(tax.federal.tax)}</p><p className="text-[10px] text-muted-foreground">{tax.federal.effectiveRate}% eff.</p></div>
                    <div className="bg-muted/50 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">State ({tax.state.stateName})</p><p className="text-sm font-medium">{formatCurrency(tax.state.tax)}</p><p className="text-[10px] text-muted-foreground">{tax.state.rate}%</p></div>
                    <div className="bg-muted/50 rounded-lg p-2"><p className="text-[10px] text-muted-foreground">FICA</p><p className="text-sm font-medium">{formatCurrency(tax.fica)}</p><p className="text-[10px] text-muted-foreground">SS + Medicare</p></div>
                  </div>
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                    <span className="text-xs text-muted-foreground">Total Tax / Effective Rate</span>
                    <span className="text-sm font-bold">{formatCurrency(tax.totalTax)} ({tax.totalEffectiveRate}%)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Based on {filingStatus ? filingStatus.replace(/_/g, " ") : "single"} filing. Set your filing status and state in Settings.</p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* 2-Column Layout: Charts + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        {/* MAIN: Sections */}
        <div className="space-y-6">
          {visibleSections
            .filter((s) => !["milestones", "aiInsights", "dti", "goalCountdown", "debtFreeCountdown"].includes(s))
            .map((section) => renderSection(section))}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          {visibleSections.includes("dti") && renderSection("dti")}
          {visibleSections.includes("milestones") && renderSection("milestones")}
          {visibleSections.includes("goalCountdown") && renderSection("goalCountdown")}
          {visibleSections.includes("debtFreeCountdown") && renderSection("debtFreeCountdown")}
          {visibleSections.includes("aiInsights") && renderSection("aiInsights")}

          {/* Goal Tracker */}
          {goalProjections.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Goal Tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {goalProjections.map((gp) => (
                  <div key={gp.goalId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{gp.goalName}</p>
                      <Badge variant={gp.onTrack ? "default" : "destructive"} className="text-[10px]">{gp.onTrack ? "On Track" : "Behind"}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Need {isFinite(gp.monthlySavingsNeeded) ? formatCurrency(gp.monthlySavingsNeeded) : "N/A"}/mo{gp.estimatedDate !== "Never" && ` \u2022 Est. ${gp.estimatedDate}`}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
