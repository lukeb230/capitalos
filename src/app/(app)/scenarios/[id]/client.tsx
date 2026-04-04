"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import { BudgetBar } from "@/components/charts/budget-bar";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Landmark,
  Receipt,
  Zap,
  Check,
} from "lucide-react";
import { formatCurrency, formatMonths } from "@/lib/utils";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateNetWorth,
  calculateSavingsRate,
  calculateDebtPayoff,
} from "@/lib/engine/calculator";
import { projectMonthly } from "@/lib/engine/projections";
import type { FinancialState } from "@/lib/engine/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  scenario: {
    id: string;
    name: string;
    description: string;
    isBaseline: boolean;
    snapshotData: string | null;
    changes: {
      entityType: string;
      entityId: string;
      field: string;
      oldValue: string;
      newValue: string;
    }[];
  };
  financialState: FinancialState;
}

type SectionKey = "income" | "expenses" | "debts" | "assets";

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const INCOME_FREQUENCIES = ["monthly", "biweekly", "annual", "weekly"] as const;
const EXPENSE_CATEGORIES = [
  "housing",
  "transport",
  "food",
  "utilities",
  "subscriptions",
  "entertainment",
  "insurance",
  "other",
] as const;
const DEBT_TYPES = ["mortgage", "student", "credit", "auto", "personal"] as const;
const ASSET_TYPES = ["savings", "checking", "investment", "property", "vehicle", "other"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  return "new_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function isNew(id: string) {
  return id.startsWith("new_");
}

function diffBadge(diff: number, invert = false) {
  const positive = invert ? diff < 0 : diff > 0;
  const negative = invert ? diff > 0 : diff < 0;
  if (diff === 0) return null;
  return (
    <span
      className={`ml-1 inline-flex items-center text-xs font-medium ${
        positive ? "text-green-600" : negative ? "text-red-600" : "text-muted-foreground"
      }`}
    >
      {positive ? "+" : ""}
      {formatCurrency(diff)}
    </span>
  );
}

function pctDiffBadge(baseline: number, sandbox: number) {
  if (baseline === 0 && sandbox === 0) return null;
  const diff = sandbox - baseline;
  if (Math.abs(diff) < 0.01) return null;
  const positive = diff > 0;
  return (
    <span
      className={`ml-1 inline-flex items-center text-xs font-medium ${
        positive ? "text-green-600" : "text-red-600"
      }`}
    >
      {positive ? "+" : ""}
      {diff.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScenarioSandboxClient({ scenario, financialState }: Props) {
  const router = useRouter();

  // ---- State ---------------------------------------------------------------
  const [sandboxState, setSandboxState] = useState<FinancialState>(() => {
    if (scenario.snapshotData) {
      try {
        return JSON.parse(scenario.snapshotData) as FinancialState;
      } catch {
        return deepClone(financialState);
      }
    }
    return deepClone(financialState);
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    income: true,
    expenses: true,
    debts: true,
    assets: true,
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // ---- Section toggle ------------------------------------------------------
  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Helper to compute all metrics from a financial state
  function computeMetrics(s: FinancialState) {
    const cashFlow = calculateMonthlyCashFlow(s.incomes, s.expenses, s.debts, s.assets);
    const netIncome = calculateMonthlyNetIncome(s.incomes);
    const expenses = calculateMonthlyExpenses(s.expenses);
    const debtPayments = calculateMonthlyDebtPayments(s.debts);
    const netWorth = calculateNetWorth(s.assets, s.debts);
    const savingsRate = calculateSavingsRate(s.incomes, s.expenses, s.debts, s.assets);
    const totalDebt = s.debts.reduce((sum, d) => sum + d.balance, 0);
    const totalContributions = s.assets.reduce((sum, a) => sum + (a.monthlyContribution || 0), 0);
    const freeCashFlow = cashFlow - totalContributions;
    const outflow = expenses + debtPayments + totalContributions;
    const debtPayoffs = s.debts.map((d) => calculateDebtPayoff(d));
    const projection = projectMonthly(s, 60);
    const nw5yr = projection[projection.length - 1]?.netWorth ?? netWorth;
    return { cashFlow, freeCashFlow, netIncome, expenses, debtPayments, netWorth, savingsRate, totalDebt, totalContributions, outflow, debtPayoffs, projection, nw5yr };
  }

  // ---- Baseline metrics (computed once) ------------------------------------
  const baselineMetrics = useMemo(() => computeMetrics(financialState), [financialState]);

  // ---- Sandbox metrics (recomputed on every change) ------------------------
  const sandboxMetrics = useMemo(() => computeMetrics(sandboxState), [sandboxState]);

  // ---- Chart data ----------------------------------------------------------
  const chartData = useMemo(() => {
    const baseline = baselineMetrics.projection;
    const sandbox = sandboxMetrics.projection;
    return {
      labels: baseline.map((_: unknown, i: number) => `M${i + 1}`),
      baseline: baseline.map((p: { netWorth: number }) => p.netWorth),
      sandbox: sandbox.map((p: { netWorth: number }) => p.netWorth),
    };
  }, [baselineMetrics.projection, sandboxMetrics.projection]);

  // ---- Changes summary -----------------------------------------------------
  const changesSummary = useMemo(() => {
    const baselineIds = {
      incomes: new Set(financialState.incomes.map((i) => i.id)),
      expenses: new Set(financialState.expenses.map((i) => i.id)),
      debts: new Set(financialState.debts.map((i) => i.id)),
      assets: new Set(financialState.assets.map((i) => i.id)),
    };

    let added = 0;
    let removed = 0;
    let modified = 0;

    // Count added items
    for (const inc of sandboxState.incomes) {
      if (!baselineIds.incomes.has(inc.id)) added++;
      else {
        const orig = financialState.incomes.find((o) => o.id === inc.id);
        if (orig && JSON.stringify(orig) !== JSON.stringify(inc)) modified++;
      }
    }
    for (const exp of sandboxState.expenses) {
      if (!baselineIds.expenses.has(exp.id)) added++;
      else {
        const orig = financialState.expenses.find((o) => o.id === exp.id);
        if (orig && JSON.stringify(orig) !== JSON.stringify(exp)) modified++;
      }
    }
    for (const dbt of sandboxState.debts) {
      if (!baselineIds.debts.has(dbt.id)) added++;
      else {
        const orig = financialState.debts.find((o) => o.id === dbt.id);
        if (orig && JSON.stringify(orig) !== JSON.stringify(dbt)) modified++;
      }
    }
    for (const ast of sandboxState.assets) {
      if (!baselineIds.assets.has(ast.id)) added++;
      else {
        const orig = financialState.assets.find((o) => o.id === ast.id);
        if (orig && JSON.stringify(orig) !== JSON.stringify(ast)) modified++;
      }
    }

    // Count removed
    for (const id of baselineIds.incomes) if (!sandboxState.incomes.find((i) => i.id === id)) removed++;
    for (const id of baselineIds.expenses) if (!sandboxState.expenses.find((i) => i.id === id)) removed++;
    for (const id of baselineIds.debts) if (!sandboxState.debts.find((i) => i.id === id)) removed++;
    for (const id of baselineIds.assets) if (!sandboxState.assets.find((i) => i.id === id)) removed++;

    return { added, removed, modified };
  }, [sandboxState, financialState]);

  // ---- Impact text ---------------------------------------------------------
  const impactText = useMemo(() => {
    const cashDiff = sandboxMetrics.freeCashFlow - baselineMetrics.freeCashFlow;
    const nwDiff = sandboxMetrics.netWorth - baselineMetrics.netWorth;
    const parts: string[] = [];
    if (Math.abs(cashDiff) > 0) {
      parts.push(
        `${cashDiff > 0 ? "+" : ""}${formatCurrency(cashDiff)}/mo cash flow`
      );
    }
    if (Math.abs(nwDiff) > 0) {
      parts.push(
        `${nwDiff > 0 ? "+" : ""}${formatCurrency(nwDiff)} net worth`
      );
    }
    if (parts.length === 0) return "No changes from baseline";
    return parts.join(" | ");
  }, [sandboxMetrics, baselineMetrics]);

  const isPositiveImpact = sandboxMetrics.freeCashFlow >= baselineMetrics.freeCashFlow;

  // ---- Mutation helpers ----------------------------------------------------
  function updateIncome(id: string, field: string, value: string | number) {
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      incomes: prev.incomes.map((inc) =>
        inc.id === id ? { ...inc, [field]: value } : inc
      ),
    }));
  }

  function updateExpense(id: string, field: string, value: string | number) {
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      expenses: prev.expenses.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp
      ),
    }));
  }

  function updateDebt(id: string, field: string, value: string | number | null) {
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      debts: prev.debts.map((dbt) =>
        dbt.id === id ? { ...dbt, [field]: value } : dbt
      ),
    }));
  }

  function updateAsset(id: string, field: string, value: string | number) {
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      assets: prev.assets.map((ast) =>
        ast.id === id ? { ...ast, [field]: value } : ast
      ),
    }));
  }

  function removeItem(category: keyof FinancialState, id: string) {
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      [category]: (prev[category] as { id: string }[]).filter((item) => item.id !== id),
    }));
  }

  function addIncome() {
    const id = genId();
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      incomes: [
        ...prev.incomes,
        { id, name: "New Income", amount: 0, frequency: "monthly", taxRate: 0 },
      ],
    }));
    setExpandedItems((prev) => new Set(prev).add(id));
  }

  function addExpense() {
    const id = genId();
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      expenses: [
        ...prev.expenses,
        { id, name: "New Expense", amount: 0, frequency: "monthly", category: "other", isFixed: false },
      ],
    }));
    setExpandedItems((prev) => new Set(prev).add(id));
  }

  function addDebt() {
    const id = genId();
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      debts: [
        ...prev.debts,
        { id, name: "New Debt", balance: 0, interestRate: 0, minimumPayment: 0, type: "personal", originalLoan: null, loanTermMonths: null },
      ],
    }));
    setExpandedItems((prev) => new Set(prev).add(id));
  }

  function addAsset() {
    const id = genId();
    setSaved(false);
    setSandboxState((prev) => ({
      ...prev,
      assets: [
        ...prev.assets,
        { id, name: "New Asset", value: 0, type: "savings", growthRate: 0, monthlyContribution: 0 },
      ],
    }));
    setExpandedItems((prev) => new Set(prev).add(id));
  }

  // ---- Save / Reset --------------------------------------------------------
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/scenarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: scenario.id,
          snapshotData: sandboxState,
        }),
      });
      if (!res.ok) throw new Error("Failed to save scenario");
      setSaved(true);
      router.refresh();
    } catch {
      alert("Failed to save scenario. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSandboxState(JSON.parse(JSON.stringify(financialState)));
    setSaved(false);
  }

  // ---- Is item modified? ---------------------------------------------------
  function isModified(category: keyof FinancialState, id: string): boolean {
    if (isNew(id)) return false;
    const baseline = (financialState[category] as { id: string }[]).find((i) => i.id === id);
    const current = (sandboxState[category] as { id: string }[]).find((i) => i.id === id);
    if (!baseline || !current) return false;
    return JSON.stringify(baseline) !== JSON.stringify(current);
  }

  function itemBorderClass(category: keyof FinancialState, id: string): string {
    if (isNew(id)) return "border-l-4 border-l-green-500";
    if (isModified(category, id)) return "border-l-4 border-l-blue-500";
    return "border-l-4 border-l-transparent";
  }

  // ---- 5yr net worth -------------------------------------------------------
  const baseline5yr =
    baselineMetrics.projection.length > 0
      ? baselineMetrics.projection[baselineMetrics.projection.length - 1].netWorth
      : baselineMetrics.netWorth;
  const sandbox5yr =
    sandboxMetrics.projection.length > 0
      ? sandboxMetrics.projection[sandboxMetrics.projection.length - 1].netWorth
      : sandboxMetrics.netWorth;

  // ---- Total debt ----------------------------------------------------------
  const baselineTotalDebt = financialState.debts.reduce((s, d) => s + d.balance, 0);
  const sandboxTotalDebt = sandboxState.debts.reduce((s, d) => s + d.balance, 0);

  // ---- Monthly outflow -----------------------------------------------------
  const baselineOutflow = baselineMetrics.expenses + baselineMetrics.debtPayments;
  const sandboxOutflow = sandboxMetrics.expenses + sandboxMetrics.debtPayments;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Top bar ---- */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/scenarios" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{scenario.name}</h1>
              {scenario.description && (
                <p className="text-xs text-muted-foreground">{scenario.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || saved}>
              {saved ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ---- Budget Overview ---- */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <Card>
          <CardContent className="p-4">
            <BudgetBar
              income={sandboxMetrics.netIncome}
              expenses={sandboxMetrics.expenses}
              debtPayments={sandboxMetrics.debtPayments}
              contributions={sandboxMetrics.totalContributions}
            />
          </CardContent>
        </Card>
      </div>

      {/* ---- Main grid ---- */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* ================================================================
              LEFT COLUMN: Sandbox Editor
              ================================================================ */}
          <div className="space-y-4">
            {/* ---- Income Section ---- */}
            <SandboxSection
              title="Income"
              icon={<DollarSign className="h-4 w-4" />}
              count={sandboxState.incomes.length}
              total={sandboxMetrics.netIncome}
              isOpen={openSections.income}
              onToggle={() => toggleSection("income")}
              onAdd={addIncome}
            >
              {sandboxState.incomes.map((inc) => (
                <div
                  key={inc.id}
                  className={`rounded-md border bg-card p-3 ${itemBorderClass("incomes", inc.id)}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground"
                      onClick={() => toggleItem(inc.id)}
                    >
                      {expandedItems.has(inc.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {inc.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600">
                        {formatCurrency(inc.amount)}
                      </span>
                      <button
                        onClick={() => removeItem("incomes", inc.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedItems.has(inc.id) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={inc.name}
                          onChange={(e) => updateIncome(inc.id, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <NumericInput
                          value={inc.amount}
                          onValueChange={(v) => updateIncome(inc.id, "amount", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={inc.frequency}
                          onValueChange={(v: string | null) => {
                            if (v) updateIncome(inc.id, "frequency", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOME_FREQUENCIES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tax Rate (%)</Label>
                        <NumericInput
                          value={inc.taxRate}
                          onValueChange={(v) => updateIncome(inc.id, "taxRate", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sandboxState.incomes.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No income sources</p>
              )}
            </SandboxSection>

            {/* ---- Expenses Section ---- */}
            <SandboxSection
              title="Expenses"
              icon={<Receipt className="h-4 w-4" />}
              count={sandboxState.expenses.length}
              total={sandboxMetrics.expenses}
              isOpen={openSections.expenses}
              onToggle={() => toggleSection("expenses")}
              onAdd={addExpense}
            >
              {sandboxState.expenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`rounded-md border bg-card p-3 ${itemBorderClass("expenses", exp.id)}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground"
                      onClick={() => toggleItem(exp.id)}
                    >
                      {expandedItems.has(exp.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {exp.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-600">
                        {formatCurrency(exp.amount)}
                      </span>
                      <button
                        onClick={() => removeItem("expenses", exp.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedItems.has(exp.id) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={exp.name}
                          onChange={(e) => updateExpense(exp.id, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <NumericInput
                          value={exp.amount}
                          onValueChange={(v) => updateExpense(exp.id, "amount", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={exp.frequency}
                          onValueChange={(v: string | null) => {
                            if (v) updateExpense(exp.id, "frequency", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOME_FREQUENCIES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select
                          value={exp.category}
                          onValueChange={(v: string | null) => {
                            if (v) updateExpense(exp.id, "category", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c.charAt(0).toUpperCase() + c.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sandboxState.expenses.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No expenses</p>
              )}
            </SandboxSection>

            {/* ---- Debts Section ---- */}
            <SandboxSection
              title="Debts"
              icon={<CreditCard className="h-4 w-4" />}
              count={sandboxState.debts.length}
              total={sandboxTotalDebt}
              isOpen={openSections.debts}
              onToggle={() => toggleSection("debts")}
              onAdd={addDebt}
            >
              {sandboxState.debts.map((dbt) => (
                <div
                  key={dbt.id}
                  className={`rounded-md border bg-card p-3 ${itemBorderClass("debts", dbt.id)}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground"
                      onClick={() => toggleItem(dbt.id)}
                    >
                      {expandedItems.has(dbt.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {dbt.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-600">
                        {formatCurrency(dbt.balance)}
                      </span>
                      <button
                        onClick={() => removeItem("debts", dbt.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Loan progress bar (shown when collapsed and has original loan) */}
                  {!expandedItems.has(dbt.id) && dbt.originalLoan && dbt.originalLoan > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${dbt.originalLoan > 0 ? Math.min(100, Math.max(0, ((dbt.originalLoan - dbt.balance) / dbt.originalLoan) * 100)) : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {dbt.originalLoan > 0 ? Math.round(((dbt.originalLoan - dbt.balance) / dbt.originalLoan) * 100) : 0}% paid off
                        {dbt.loanTermMonths ? ` \u00b7 ${dbt.loanTermMonths}mo term` : ""}
                      </p>
                    </div>
                  )}
                  {expandedItems.has(dbt.id) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={dbt.name}
                          onChange={(e) => updateDebt(dbt.id, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Balance</Label>
                        <NumericInput
                          value={dbt.balance}
                          onValueChange={(v) => updateDebt(dbt.id, "balance", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Interest Rate (%)</Label>
                        <NumericInput
                          value={dbt.interestRate}
                          onValueChange={(v) => updateDebt(dbt.id, "interestRate", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Monthly Payment</Label>
                        <NumericInput
                          value={dbt.minimumPayment}
                          onValueChange={(v) => updateDebt(dbt.id, "minimumPayment", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={dbt.type}
                          onValueChange={(v: string | null) => {
                            if (v) updateDebt(dbt.id, "type", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEBT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Optional loan details */}
                      <div>
                        <Label className="text-xs">Original Loan ($)</Label>
                        <Input
                          type="number"
                          value={dbt.originalLoan ?? ""}
                          onChange={(e) => updateDebt(dbt.id, "originalLoan", e.target.value ? Number(e.target.value) : null)}
                          placeholder="Optional"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Loan Term (months)</Label>
                        <Input
                          type="number"
                          value={dbt.loanTermMonths ?? ""}
                          onChange={(e) => updateDebt(dbt.id, "loanTermMonths", e.target.value ? Number(e.target.value) : null)}
                          placeholder="Optional"
                          className="h-8 text-sm"
                        />
                      </div>
                      {/* Loan progress bar in expanded view */}
                      {dbt.originalLoan && dbt.originalLoan > 0 && (
                        <div className="col-span-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, ((dbt.originalLoan - dbt.balance) / dbt.originalLoan) * 100))}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatCurrency(dbt.originalLoan - dbt.balance)} of {formatCurrency(dbt.originalLoan)} paid ({Math.round(((dbt.originalLoan - dbt.balance) / dbt.originalLoan) * 100)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {sandboxState.debts.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No debts</p>
              )}
            </SandboxSection>

            {/* ---- Assets Section ---- */}
            <SandboxSection
              title="Assets"
              icon={<Landmark className="h-4 w-4" />}
              count={sandboxState.assets.length}
              total={sandboxState.assets.reduce((s, a) => s + a.value, 0)}
              isOpen={openSections.assets}
              onToggle={() => toggleSection("assets")}
              onAdd={addAsset}
            >
              {sandboxState.assets.map((ast) => (
                <div
                  key={ast.id}
                  className={`rounded-md border bg-card p-3 ${itemBorderClass("assets", ast.id)}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground"
                      onClick={() => toggleItem(ast.id)}
                    >
                      {expandedItems.has(ast.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {ast.name}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600">
                        {formatCurrency(ast.value)}
                      </span>
                      <button
                        onClick={() => removeItem("assets", ast.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedItems.has(ast.id) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={ast.name}
                          onChange={(e) => updateAsset(ast.id, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Value</Label>
                        <NumericInput
                          value={ast.value}
                          onValueChange={(v) => updateAsset(ast.id, "value", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Growth Rate (%)</Label>
                        <NumericInput
                          value={ast.growthRate}
                          onValueChange={(v) => updateAsset(ast.id, "growthRate", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Monthly Contribution</Label>
                        <NumericInput
                          value={ast.monthlyContribution}
                          onValueChange={(v) => updateAsset(ast.id, "monthlyContribution", v)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={ast.type}
                          onValueChange={(v: string | null) => {
                            if (v) updateAsset(ast.id, "type", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sandboxState.assets.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No assets</p>
              )}
            </SandboxSection>
          </div>

          {/* ================================================================
              RIGHT COLUMN: Live Comparison (sticky)
              ================================================================ */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* ---- Impact Banner ---- */}
            <Card
              className={`border-0 ${
                isPositiveImpact
                  ? "bg-green-50 dark:bg-green-950/30"
                  : "bg-red-50 dark:bg-red-950/30"
              }`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`rounded-full p-2 ${
                    isPositiveImpact
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {isPositiveImpact ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isPositiveImpact ? "Positive Impact" : "Negative Impact"}
                  </p>
                  <p className="text-xs text-muted-foreground">{impactText}</p>
                </div>
              </CardContent>
            </Card>

            {/* ---- Key Metrics Grid ---- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Cash Flow"
                  baseline={baselineMetrics.freeCashFlow}
                  sandbox={sandboxMetrics.freeCashFlow}
                />
                <MetricCard
                  label="Net Worth"
                  baseline={baselineMetrics.netWorth}
                  sandbox={sandboxMetrics.netWorth}
                />
                <MetricCard
                  label="Savings Rate"
                  baseline={baselineMetrics.savingsRate}
                  sandbox={sandboxMetrics.savingsRate}
                  isPercent
                />
                <MetricCard
                  label="Total Debt"
                  baseline={baselineTotalDebt}
                  sandbox={sandboxTotalDebt}
                  invert
                />
                <MetricCard
                  label="Monthly Outflow"
                  baseline={baselineOutflow}
                  sandbox={sandboxOutflow}
                  invert
                />
                <MetricCard
                  label="5yr Net Worth"
                  baseline={baseline5yr}
                  sandbox={sandbox5yr}
                />
              </CardContent>
            </Card>

            {/* ---- Projection Chart ---- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Net Worth Projection (5yr)</CardTitle>
              </CardHeader>
              <CardContent>
                <ComparisonChart
                  baselineData={baselineMetrics.projection}
                  scenarioData={sandboxMetrics.projection}
                  scenarioName={scenario.name}
                />
              </CardContent>
            </Card>

            {/* ---- Debt Payoff Changes ---- */}
            {(sandboxState.debts.length > 0 || financialState.debts.length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Debt Payoff Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sandboxState.debts.map((dbt) => {
                    const baselineDebt = baselineMetrics.debtPayoffs.find(
                      (d) => d.debtId === dbt.id
                    );
                    const sandboxDebt = sandboxMetrics.debtPayoffs.find(
                      (d) => d.debtId === dbt.id
                    );
                    const baselineMonths = baselineDebt?.monthsToPayoff ?? null;
                    const sandboxMonths = sandboxDebt?.monthsToPayoff ?? null;

                    return (
                      <div
                        key={dbt.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-xs font-medium">{dbt.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {baselineMonths != null ? formatMonths(baselineMonths) : "N/A"}
                          </span>
                          <span className="text-muted-foreground">&rarr;</span>
                          <span className="font-medium">
                            {sandboxMonths != null ? formatMonths(sandboxMonths) : "N/A"}
                          </span>
                          {baselineMonths != null && sandboxMonths != null && (
                            <Badge
                              variant={sandboxMonths < baselineMonths ? "default" : "destructive"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {sandboxMonths < baselineMonths ? "-" : "+"}
                              {Math.abs(sandboxMonths - baselineMonths)}mo
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sandboxState.debts.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No debts to track</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ---- Changes Summary ---- */}
            <Card>
              <CardContent className="flex items-center justify-center gap-4 p-4">
                {changesSummary.modified > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground">
                      {changesSummary.modified} modified
                    </span>
                  </div>
                )}
                {changesSummary.added > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">
                      {changesSummary.added} added
                    </span>
                  </div>
                )}
                {changesSummary.removed > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-xs text-muted-foreground">
                      {changesSummary.removed} removed
                    </span>
                  </div>
                )}
                {changesSummary.modified === 0 &&
                  changesSummary.added === 0 &&
                  changesSummary.removed === 0 && (
                    <span className="text-xs text-muted-foreground">No changes from baseline</span>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function SandboxSection({
  title,
  icon,
  count,
  total,
  isOpen,
  onToggle,
  onAdd,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-semibold hover:text-foreground"
            onClick={onToggle}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="flex items-center gap-1.5">
              {icon}
              {title}
            </span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {count}
            </Badge>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {formatCurrency(total)}
            </span>
          </button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAdd}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      {isOpen && <CardContent className="space-y-2 pt-0">{children}</CardContent>}
    </Card>
  );
}

function MetricCard({
  label,
  baseline,
  sandbox,
  invert = false,
  isPercent = false,
}: {
  label: string;
  baseline: number;
  sandbox: number;
  invert?: boolean;
  isPercent?: boolean;
}) {
  const diff = sandbox - baseline;
  const positive = invert ? diff < 0 : diff > 0;
  const negative = invert ? diff > 0 : diff < 0;
  const neutral = diff === 0;

  const format = isPercent
    ? (v: number) => `${v.toFixed(1)}%`
    : (v: number) => formatCurrency(v);

  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xs text-muted-foreground">{format(baseline)}</span>
        <span className="text-[10px] text-muted-foreground">&rarr;</span>
        <span className="text-sm font-semibold">{format(sandbox)}</span>
      </div>
      {!neutral && (
        <div className="mt-0.5">
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${
              positive
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {positive ? "+" : ""}
            {isPercent ? `${diff.toFixed(1)}%` : formatCurrency(diff)}
          </Badge>
        </div>
      )}
    </div>
  );
}
