"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BUDGET_CATEGORIES, categoryLabel } from "@/lib/budget/helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetOverrideRow {
  id: string;
  budgetCategoryId: string;
  month: number;
  year: number;
  overrideAmount: number | null;
  rolloverIn: number;
  note: string | null;
}

interface BudgetCategoryRow {
  id: string;
  profileId: string;
  category: string;
  monthlyAmount: number;
  isFixed: boolean;
  rolloverEnabled: boolean;
  overrides: BudgetOverrideRow[];
}

interface InvestmentContribution {
  name: string;
  amount: number;
}

interface Props {
  initialCategories: BudgetCategoryRow[];
  initialActual: Record<string, number>;
  initialMonth: number;
  initialYear: number;
  monthlyNetIncome: number;
  investmentContributions: InvestmentContribution[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pctColor(pct: number): string {
  if (pct > 100) return "text-red-500";
  if (pct >= 80) return "text-amber-500";
  return "text-emerald-600";
}

function progressColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetClient({
  initialCategories,
  initialActual,
  initialMonth,
  initialYear,
  monthlyNetIncome,
  investmentContributions,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] =
    useState<BudgetCategoryRow[]>(initialCategories);
  const [actual, setActual] =
    useState<Record<string, number>>(initialActual);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // Sync local state when server re-renders new props (after router.refresh())
  useEffect(() => { setCategories(initialCategories); }, [initialCategories]);
  useEffect(() => { setActual(initialActual); }, [initialActual]);

  // Navigation loading
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BudgetCategoryRow | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  // Add/edit form
  const [form, setForm] = useState({
    category: "",
    monthlyAmount: "",
    isFixed: "Fixed",
    rolloverEnabled: "Off",
  });

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const rows = useMemo(() => {
    return categories.map((cat) => {
      const override = cat.overrides.find(
        (o) => o.month === month && o.year === year,
      );
      const effective =
        override?.overrideAmount ?? cat.monthlyAmount;
      const rolloverIn =
        cat.rolloverEnabled && override ? override.rolloverIn : 0;
      const budget = effective + rolloverIn;
      const spent = actual[cat.category] ?? 0;
      const remaining = budget - spent;
      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

      return {
        ...cat,
        effective,
        rolloverIn,
        budget,
        spent,
        remaining,
        pct,
      };
    });
  }, [categories, actual, month, year]);

  const totalBudgeted = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const totalPct =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const totalInvestmentContributions = investmentContributions.reduce(
    (s, c) => s + c.amount, 0,
  );

  const unbudgetedCategories = BUDGET_CATEGORIES.filter(
    (c) => !categories.some((cat) => cat.category === c.key),
  );

  // Unaccounted spending: categories with actual transactions but no budget
  const budgetedCategoryKeys = new Set(categories.map((c) => c.category));
  const unaccountedRows = Object.entries(actual)
    .filter(([cat, amt]) => !budgetedCategoryKeys.has(cat) && amt > 0)
    .map(([cat, amt]) => ({ category: cat, spent: amt }))
    .sort((a, b) => b.spent - a.spent);
  const totalUnaccounted = unaccountedRows.reduce((s, r) => s + r.spent, 0);

  // -----------------------------------------------------------------------
  // Month navigation
  // -----------------------------------------------------------------------

  async function navigateMonth(dir: -1 | 1) {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }

    if (!Number.isInteger(m) || !Number.isInteger(y)) return;

    setNavLoading(true);
    setNavError(null);
    setMonth(m);
    setYear(y);

    try {
      const [catRes, actualRes, spendRes] = await Promise.all([
        fetch("/api/budget"),
        fetch(`/api/budget/override?month=${m}&year=${y}`),
        fetch(`/api/transactions?month=${m}&year=${y}&summary=true`),
      ]);

      if (!catRes.ok) throw new Error("Failed to load budget categories");

      const cats: BudgetCategoryRow[] = await catRes.json();

      if (actualRes.ok) {
        const overrides: BudgetOverrideRow[] = await actualRes.json();
        for (const cat of cats) {
          cat.overrides = overrides.filter(
            (o) => o.budgetCategoryId === cat.id,
          );
        }
      }
      setCategories(cats);

      if (spendRes.ok) {
        const data = await spendRes.json();
        setActual(data.byCategory ?? {});
      } else {
        setActual({});
      }
    } catch (e) {
      setNavError(e instanceof Error ? e.message : "Failed to load month data");
    } finally {
      setNavLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  function openAdd() {
    setForm({
      category: unbudgetedCategories[0]?.key ?? "",
      monthlyAmount: "",
      isFixed: "Fixed",
      rolloverEnabled: "Off",
    });
    setAddOpen(true);
  }

  function openEdit(item: BudgetCategoryRow) {
    setEditItem(item);
    setForm({
      category: item.category,
      monthlyAmount: String(item.monthlyAmount),
      isFixed: item.isFixed ? "Fixed" : "Variable",
      rolloverEnabled: item.rolloverEnabled ? "On" : "Off",
    });
  }

  async function handleAdd() {
    const amount = parseFloat(form.monthlyAmount);
    if (!form.category || isNaN(amount) || amount < 0) return;

    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        monthlyAmount: amount,
        isFixed: form.isFixed === "Fixed",
        rolloverEnabled: form.rolloverEnabled === "On",
      }),
    });
    setAddOpen(false);
    router.refresh();
  }

  async function handleUpdate() {
    if (!editItem) return;
    const amount = parseFloat(form.monthlyAmount);
    if (isNaN(amount) || amount < 0) return;

    await fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editItem.id,
        monthlyAmount: amount,
        isFixed: form.isFixed === "Fixed",
        rolloverEnabled: form.rolloverEnabled === "On",
      }),
    });
    setEditItem(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/budget?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function applyTemplate(template: string) {
    await fetch("/api/budget/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, monthlyNetIncome }),
    });
    setTemplateOpen(false);
    router.refresh();
  }

  // Plaid refresh
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
      // Silently fail — data just won't update
    } finally {
      setRefreshing(false);
    }
  }

  async function computeRollover() {
    await fetch("/api/budget/rollover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    router.refresh();
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set monthly spending targets and track progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing…" : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={computeRollover}>
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
            Compute Rollover
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Templates
          </Button>
          <Button size="sm" onClick={openAdd} disabled={unbudgetedCategories.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)} disabled={navLoading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[180px] text-center">
            {navLoading ? "Loading…" : `${MONTH_NAMES[month - 1]} ${year}`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)} disabled={navLoading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {navError && (
          <p className="text-xs text-red-500">{navError}</p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Budgeted</p>
            <p className="text-xl font-bold">{formatCurrency(totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className={`text-xl font-bold ${pctColor(totalPct)}`}>
              {formatCurrency(totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p
              className={`text-xl font-bold ${totalRemaining >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {formatCurrency(Math.abs(totalRemaining))}
              {totalRemaining < 0 && " over"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColor(totalPct)}`}
          style={{ width: `${Math.min(totalPct, 100)}%` }}
        />
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              No budget categories yet. Add categories manually or apply a
              template to get started.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
              <Button variant="outline" onClick={() => setTemplateOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category rows */}
      <div className="space-y-2">
        {rows.map((r) => (
          <Card
            key={r.id}
            className={
              r.pct > 100
                ? "border-red-300 dark:border-red-800"
                : r.pct >= 90
                  ? "border-amber-300 dark:border-amber-800"
                  : ""
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {categoryLabel(r.category)}
                  </span>
                  {r.isFixed && (
                    <Badge variant="secondary" className="text-[10px]">
                      Fixed
                    </Badge>
                  )}
                  {r.rolloverIn > 0 && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600">
                      +{formatCurrency(r.rolloverIn)} rollover
                    </Badge>
                  )}
                  {r.pct > 100 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  {r.pct <= 80 && r.spent > 0 && (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(r)}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(r.id)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
                <span>
                  Budget: <strong className="text-foreground">{formatCurrency(r.budget)}</strong>
                </span>
                <span>
                  Spent:{" "}
                  <strong className={pctColor(r.pct)}>
                    {formatCurrency(r.spent)}
                  </strong>
                </span>
                <span>
                  Left:{" "}
                  <strong
                    className={
                      r.remaining >= 0 ? "text-emerald-600" : "text-red-500"
                    }
                  >
                    {r.remaining >= 0
                      ? formatCurrency(r.remaining)
                      : `-${formatCurrency(Math.abs(r.remaining))}`}
                  </strong>
                </span>
                <span className={`ml-auto font-medium ${pctColor(r.pct)}`}>
                  {r.pct}%
                </span>
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(r.pct)}`}
                  style={{ width: `${Math.min(r.pct, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unaccounted for — spending in categories without a budget */}
      {unaccountedRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Unaccounted For</span>
              <span className="text-amber-600 font-bold">
                {formatCurrency(totalUnaccounted)}
              </span>
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unaccountedRows.map((r) => (
              <Card key={r.category} className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {categoryLabel(r.category)}
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    {formatCurrency(r.spent)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            These transactions fall into categories without a budget. Add them above to track spending.
          </p>
        </div>
      )}

      {/* Bottom cards: unbudgeted income + investment contributions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Unbudgeted income */}
        {totalBudgeted > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Unbudgeted Income</p>
                <p className="text-xs text-muted-foreground">
                  Net income minus budget minus investment contributions
                </p>
              </div>
              <p
                className={`text-lg font-bold ${monthlyNetIncome - totalBudgeted - totalInvestmentContributions >= 0 ? "text-emerald-600" : "text-red-500"}`}
              >
                {formatCurrency(monthlyNetIncome - totalBudgeted - totalInvestmentContributions)}/mo
              </p>
            </CardContent>
          </Card>
        )}

        {/* Investment contributions */}
        {investmentContributions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium">Investment Contributions</p>
                </div>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(
                    investmentContributions.reduce((s, c) => s + c.amount, 0),
                  )}
                  /mo
                </p>
              </div>
              <div className="space-y-1.5">
                {investmentContributions.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-medium">
                      {formatCurrency(c.amount)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Add Category Dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Budget Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v: string | null) => { if (v) setForm({ ...form, category: v }); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {unbudgetedCategories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monthly Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.monthlyAmount}
                onChange={(e) =>
                  setForm({ ...form, monthlyAmount: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.isFixed}
                  onValueChange={(v: string | null) => { if (v) setForm({ ...form, isFixed: v }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                    <SelectItem value="Variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rollover</Label>
                <Select
                  value={form.rolloverEnabled}
                  onValueChange={(v: string | null) => {
                    if (v) setForm({ ...form, rolloverEnabled: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Off">Off</SelectItem>
                    <SelectItem value="On">On</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Edit Category Dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editItem ? categoryLabel(editItem.category) : ""} Budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Monthly Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.monthlyAmount}
                onChange={(e) =>
                  setForm({ ...form, monthlyAmount: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.isFixed}
                  onValueChange={(v: string | null) => { if (v) setForm({ ...form, isFixed: v }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                    <SelectItem value="Variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rollover</Label>
                <Select
                  value={form.rolloverEnabled}
                  onValueChange={(v: string | null) => {
                    if (v) setForm({ ...form, rolloverEnabled: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Off">Off</SelectItem>
                    <SelectItem value="On">On</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Template Dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Budget Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Based on your net income of{" "}
            <strong>{formatCurrency(monthlyNetIncome)}/mo</strong>. This will
            create or update budget categories to match the template
            allocation.
          </p>
          <div className="space-y-3">
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => applyTemplate("50-30-20")}
            >
              <CardContent className="p-4">
                <p className="font-medium text-sm">50 / 30 / 20</p>
                <p className="text-xs text-muted-foreground mt-1">
                  50% Needs ({formatCurrency(monthlyNetIncome * 0.5)}) / 30%
                  Wants ({formatCurrency(monthlyNetIncome * 0.3)}) / 20%
                  Savings ({formatCurrency(monthlyNetIncome * 0.2)})
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => applyTemplate("zero-based")}
            >
              <CardContent className="p-4">
                <p className="font-medium text-sm">Zero-Based</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Every dollar assigned — budget =
                  income. Distribute{" "}
                  {formatCurrency(monthlyNetIncome)} across all categories.
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
