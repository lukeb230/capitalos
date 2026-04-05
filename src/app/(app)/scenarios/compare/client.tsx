"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, GitBranch } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateNetWorth,
  calculateSavingsRate,
  calculateDebtPayoff,
} from "@/lib/engine/calculator";
import { projectMonthly, applyScenarioChanges } from "@/lib/engine/projections";
import { compareScenarios } from "@/lib/engine/scenarios";
import type { FinancialState, ScenarioChangeInput } from "@/lib/engine/types";
import { formatCurrency, formatMonths } from "@/lib/utils";

interface ScenarioChange {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  isBaseline: boolean;
  snapshotData: string | null;
  changes: ScenarioChange[];
}

interface CompareClientProps {
  scenarios: Scenario[];
  financialState: FinancialState;
}

const SCENARIO_COLORS = ["#6b7280", "#3b82f6", "#22c55e", "#f59e0b"];

function DiffBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  if (value === 0) return null;
  const isGood = invert ? value < 0 : value > 0;
  return (
    <Badge
      variant="outline"
      className={`ml-2 text-xs ${
        isGood
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
    >
      {value > 0 ? "+" : ""}
      {formatCurrency(value)}
    </Badge>
  );
}

function MonthsDiffBadge({ value }: { value: number }) {
  if (value === 0 || !isFinite(value) || isNaN(value)) return null;
  const positive = value < 0; // fewer months is better
  return (
    <Badge
      variant="outline"
      className={`ml-2 text-xs ${
        positive
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
    >
      {value > 0 ? "+" : ""}
      {formatMonths(Math.abs(value))}
    </Badge>
  );
}

function PercentDiffBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) return null;
  const positive = value > 0;
  return (
    <Badge
      variant="outline"
      className={`ml-2 text-xs ${
        positive
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );
}

interface ScenarioMetrics {
  monthlyCashFlow: number;
  freeCashFlow: number;
  monthlyExpenses: number;
  monthlyDebtPayments: number;
  netWorthNow: number;
  netWorth1yr: number;
  netWorth3yr: number;
  netWorth5yr: number;
  debtFreeMonths: number;
  savingsRate: number;
  investableSurplus: number;
  projections: { month: number; label: string; netWorth: number }[];
}

function computeMetrics(state: FinancialState): ScenarioMetrics {
  const monthlyCashFlow = calculateMonthlyCashFlow(state.incomes, state.expenses, state.debts, state.assets);
  const freeCashFlow = monthlyCashFlow;
  const monthlyExpenses = calculateMonthlyExpenses(state.expenses);
  const monthlyDebtPayments = calculateMonthlyDebtPayments(state.debts);
  const netWorthNow = calculateNetWorth(state.assets, state.debts);
  const savingsRate = calculateSavingsRate(state.incomes, state.expenses, state.debts, state.assets);

  const projections = projectMonthly(state, 60);

  const netWorth1yr = projections[Math.min(12, projections.length - 1)]?.netWorth ?? netWorthNow;
  const netWorth3yr = projections[Math.min(36, projections.length - 1)]?.netWorth ?? netWorthNow;
  const netWorth5yr = projections[Math.min(60, projections.length - 1)]?.netWorth ?? netWorthNow;

  // Earliest debt-free month across all debts
  let debtFreeMonths = 0;
  if (state.debts.length > 0) {
    const payoffs = state.debts.map((d) => calculateDebtPayoff(d));
    debtFreeMonths = Math.max(...payoffs.map((p) => p.monthsToPayoff));
  }

  // Investable surplus = free cash flow (contributions already subtracted)
  const investableSurplus = Math.max(0, freeCashFlow);

  const chartData = projections
    .filter((_, i) => i % 3 === 0 || i === projections.length - 1)
    .map((s) => ({ month: s.month, label: s.label, netWorth: Math.round(s.netWorth) }));

  return {
    monthlyCashFlow,
    freeCashFlow,
    monthlyExpenses,
    monthlyDebtPayments,
    netWorthNow,
    netWorth1yr,
    netWorth3yr,
    netWorth5yr,
    debtFreeMonths,
    savingsRate,
    investableSurplus,
    projections: chartData,
  };
}

export function CompareClient({ scenarios, financialState }: CompareClientProps) {
  const baseline = scenarios.find((s) => s.isBaseline);
  const nonBaseline = scenarios.filter((s) => !s.isBaseline);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return nonBaseline.slice(0, 2).map((s) => s.id);
  });

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((sid) => sid !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const selectedScenarios = useMemo(() => {
    return nonBaseline.filter((s) => selectedIds.includes(s.id));
  }, [nonBaseline, selectedIds]);

  const baselineMetrics = useMemo(() => computeMetrics(financialState), [financialState]);

  const scenarioMetricsMap = useMemo(() => {
    const map = new Map<string, ScenarioMetrics>();
    for (const scenario of selectedScenarios) {
      let modifiedState: FinancialState;
      try {
        modifiedState = scenario.snapshotData
          ? JSON.parse(scenario.snapshotData) as FinancialState
          : applyScenarioChanges(financialState, scenario.changes);
      } catch {
        modifiedState = applyScenarioChanges(financialState, scenario.changes);
      }
      map.set(scenario.id, computeMetrics(modifiedState));
    }
    return map;
  }, [selectedScenarios, financialState]);

  // Build chart data with all selected scenarios overlaid
  const chartData = useMemo(() => {
    const basePoints = baselineMetrics.projections;
    return basePoints.map((bp) => {
      const point: Record<string, string | number> = {
        label: bp.label,
        Baseline: bp.netWorth,
      };
      selectedScenarios.forEach((s) => {
        const metrics = scenarioMetricsMap.get(s.id);
        const match = metrics?.projections.find((p) => p.month === bp.month);
        point[s.name] = match?.netWorth ?? 0;
      });
      return point;
    });
  }, [baselineMetrics, selectedScenarios, scenarioMetricsMap]);

  const rows: {
    label: string;
    type: "currency" | "months" | "percent";
    key: keyof ScenarioMetrics;
    invert?: boolean;
  }[] = [
    { label: "Monthly Surplus", type: "currency", key: "freeCashFlow" },
    { label: "Monthly Expenses", type: "currency", key: "monthlyExpenses", invert: true },
    { label: "Monthly Debt Payments", type: "currency", key: "monthlyDebtPayments", invert: true },
    { label: "Net Worth (Now)", type: "currency", key: "netWorthNow" },
    { label: "Net Worth (1 Year)", type: "currency", key: "netWorth1yr" },
    { label: "Net Worth (3 Years)", type: "currency", key: "netWorth3yr" },
    { label: "Net Worth (5 Years)", type: "currency", key: "netWorth5yr" },
    { label: "Debt-Free Date", type: "months", key: "debtFreeMonths" },
    { label: "Savings Rate", type: "percent", key: "savingsRate" },
  ];

  const formatValue = (value: number, type: "currency" | "months" | "percent") => {
    switch (type) {
      case "currency":
        return formatCurrency(value);
      case "months":
        return formatMonths(value);
      case "percent":
        return `${value.toFixed(1)}%`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/scenarios">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Scenarios
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GitBranch className="h-6 w-6" />
          Compare Scenarios
        </h1>
        <p className="text-muted-foreground mt-1">
          Select up to 3 scenarios to compare side-by-side against your baseline.
        </p>
      </div>

      {/* Scenario selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          {nonBaseline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scenarios to compare. Create scenarios first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nonBaseline.map((scenario) => {
                const isSelected = selectedIds.includes(scenario.id);
                return (
                  <Button
                    key={scenario.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleScenario(scenario.id)}
                    className="gap-2"
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {scenario.name}
                  </Button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Baseline is always included. Select up to 3 additional scenarios.
          </p>
        </CardContent>
      </Card>

      {/* Comparison table */}
      {selectedScenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Metric</TableHead>
                  <TableHead className="bg-blue-50 text-blue-800 font-semibold">
                    {baseline?.name ?? "Baseline"}
                  </TableHead>
                  {selectedScenarios.map((s) => (
                    <TableHead key={s.id}>{s.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const baseVal = baselineMetrics[row.key] as number;
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="bg-blue-50/50">
                        {formatValue(baseVal, row.type)}
                      </TableCell>
                      {selectedScenarios.map((s) => {
                        const metrics = scenarioMetricsMap.get(s.id);
                        const val = (metrics?.[row.key] as number) ?? 0;
                        const diff = val - baseVal;
                        return (
                          <TableCell key={s.id}>
                            {formatValue(val, row.type)}
                            {row.type === "currency" && <DiffBadge value={diff} invert={row.invert} />}
                            {row.type === "months" && <MonthsDiffBadge value={diff} />}
                            {row.type === "percent" && <PercentDiffBadge value={diff} />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Net worth projection chart */}
      {selectedScenarios.length > 0 && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Worth Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Baseline"
                  stroke={SCENARIO_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
                {selectedScenarios.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stroke={SCENARIO_COLORS[i + 1]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
