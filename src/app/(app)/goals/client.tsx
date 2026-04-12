"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Pencil,
  Trash2,
  Target,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  CreditCard,
  Landmark,
  PiggyBank,
  Flame,
  Zap,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  calculateFINumber,
  calculateCoastFINumber,
  calculateYearsToFI,
} from "@/lib/engine/calculator";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { GoalProjection, DebtPayoffResult, DebtInput } from "@/lib/engine/types";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: number;
  type: string;
  linkedAssetId?: string | null;
  linkedDebtId?: string | null;
}

interface FIData {
  annualExpenses: number;
  currentInvestments: number;
  monthlyContributions: number;
  defaultGrowthRate: number;
  profileCurrentAge: number | null;
  profileRetirementAge: number;
}

interface AssetItem {
  id: string;
  name: string;
  value: number;
  type: string;
}

interface Props {
  items: Goal[];
  projections: GoalProjection[];
  cashFlow: number;
  debtPayoffs: DebtPayoffResult[];
  debts: DebtInput[];
  assets: AssetItem[];
  autoTrackedAmounts: Record<string, number>;
  fiData: FIData;
}

const goalTypes = [
  { value: "emergency_fund", label: "Emergency Fund", icon: Shield },
  { value: "net_worth", label: "Net Worth Target", icon: TrendingUp },
  { value: "retirement", label: "Retirement", icon: Landmark },
  { value: "purchase", label: "Savings for Purchase", icon: PiggyBank },
  { value: "debt_free", label: "Pay Off Debt", icon: CreditCard },
  { value: "custom", label: "Custom Goal", icon: Target },
];

function typeLabel(type: string): string {
  return goalTypes.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeIcon(type: string) {
  return goalTypes.find((t) => t.value === type)?.icon ?? Target;
}

const AUTO_TRACKED_TYPES = ["net_worth", "debt_free", "emergency_fund", "retirement", "purchase"];

export function GoalsClient({ items, projections, cashFlow, debtPayoffs, debts, assets, autoTrackedAmounts, fiData }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState({
    name: "", targetAmount: "", currentAmount: "0", targetDate: "", priority: "1", type: "custom",
    linkedAssetId: "", linkedDebtId: "",
  });

  const onTrackCount = projections.filter((p) => p.onTrack).length;
  const behindCount = projections.filter((p) => !p.onTrack).length;

  // FI Calculator state
  const [fiInputs, setFiInputs] = useState({
    currentAge: String(fiData.profileCurrentAge ?? 30),
    retirementAge: String(fiData.profileRetirementAge ?? 60),
    returnRate: String(fiData.defaultGrowthRate || 8),
    withdrawalRate: "4",
  });

  const fiCalc = useMemo(() => {
    const currentAge = parseInt(fiInputs.currentAge) || 30;
    const retirementAge = parseInt(fiInputs.retirementAge) || 60;
    const returnRate = parseFloat(fiInputs.returnRate) || 8;
    const withdrawalRate = parseFloat(fiInputs.withdrawalRate) || 4;
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);

    const fiNumber = calculateFINumber(fiData.annualExpenses, withdrawalRate);
    const coastFINumber = calculateCoastFINumber(fiNumber, returnRate, yearsToRetirement);
    const yearsToFI = calculateYearsToFI(
      fiData.currentInvestments,
      fiData.monthlyContributions,
      returnRate,
      fiNumber
    );
    const coastFIGap = coastFINumber - fiData.currentInvestments;
    const isCoastFI = fiData.currentInvestments >= coastFINumber;

    // Generate chart data: project portfolio growth year by year
    const monthlyRate = returnRate / 100 / 12;
    const fiYearsCapped = isFinite(yearsToFI) ? Math.ceil(yearsToFI) + 5 : 0;
    const chartYears = Math.min(Math.max(yearsToRetirement, fiYearsCapped), 50);
    const chartData: { year: number; age: number; portfolio: number; fiTarget: number; coastLine: number }[] = [];
    let value = fiData.currentInvestments;

    for (let y = 0; y <= chartYears; y++) {
      chartData.push({
        year: y,
        age: currentAge + y,
        portfolio: Math.round(value),
        fiTarget: fiNumber,
        coastLine: Math.round(calculateCoastFINumber(fiNumber, returnRate, Math.max(0, yearsToRetirement - y))),
      });
      // Grow for 12 months
      for (let m = 0; m < 12; m++) {
        value = value * (1 + monthlyRate) + fiData.monthlyContributions;
      }
    }

    return { fiNumber, coastFINumber, yearsToFI, coastFIGap, isCoastFI, chartData, yearsToRetirement };
  }, [fiInputs, fiData]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", targetAmount: "", currentAmount: "0", targetDate: "", priority: "1", type: "custom", linkedAssetId: "", linkedDebtId: "" });
    setOpen(true);
  }

  function openEdit(item: Goal) {
    setEditing(item);
    setForm({
      name: item.name,
      targetAmount: String(item.targetAmount),
      currentAmount: String(item.currentAmount),
      targetDate: new Date(item.targetDate).toISOString().split("T")[0],
      priority: String(item.priority),
      type: item.type,
      linkedAssetId: item.linkedAssetId ?? "",
      linkedDebtId: item.linkedDebtId ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    const targetAmount = parseFloat(form.targetAmount);
    const currentAmount = parseFloat(form.currentAmount);
    const priority = parseInt(form.priority);
    const isAutoTracked = AUTO_TRACKED_TYPES.includes(form.type);
    if (!form.name.trim() || isNaN(targetAmount) || targetAmount < 0 || (!isAutoTracked && isNaN(currentAmount)) || !form.targetDate) return;
    const data: Record<string, unknown> = {
      name: form.name,
      targetAmount,
      targetDate: new Date(form.targetDate).toISOString(),
      priority: isNaN(priority) ? 1 : priority,
      type: form.type,
      linkedAssetId: form.linkedAssetId || null,
      linkedDebtId: form.linkedDebtId || null,
    };
    if (!isAutoTracked && !form.linkedAssetId && !form.linkedDebtId) {
      data.currentAmount = currentAmount;
    }
    try {
      const res = editing
        ? await fetch("/api/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) })
        : await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to save");
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to save goal. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Failed to delete goal. Please try again.");
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} goal{items.length !== 1 ? "s" : ""} tracked
            {onTrackCount > 0 && <span className="text-emerald-600"> \u00b7 {onTrackCount} on track</span>}
            {behindCount > 0 && <span className="text-amber-500"> \u00b7 {behindCount} behind</span>}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Goal
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: string | null) => { if (v) setForm({ ...form, type: v }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {goalTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Goal Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === "debt_free" ? "e.g. Pay off Audi loan" : "e.g. 25K Emergency Fund"} />
              </div>
              <div>
                <Label>{form.type === "debt_free" ? "Debt Balance ($)" : "Target Amount ($)"}</Label>
                <Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} placeholder={form.type === "debt_free" ? "15000" : "25000"} />
              </div>

              {/* Link to asset or debt */}
              {form.type === "debt_free" ? (
                <div>
                  <Label>Track From Debt</Label>
                  <Select value={form.linkedDebtId || "_auto"} onValueChange={(v: string | null) => setForm({ ...form, linkedDebtId: v === "_auto" ? "" : (v ?? ""), linkedAssetId: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_auto">Auto-detect by name</SelectItem>
                      {debts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({formatCurrency(d.balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Progress auto-updates from the linked debt balance.</p>
                </div>
              ) : AUTO_TRACKED_TYPES.includes(form.type) ? (
                <div>
                  <Label>Track From Asset</Label>
                  <Select value={form.linkedAssetId || "_auto"} onValueChange={(v: string | null) => setForm({ ...form, linkedAssetId: v === "_auto" ? "" : (v ?? ""), linkedDebtId: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_auto">
                        {form.type === "net_worth" ? "All assets & debts (net worth)" :
                         form.type === "emergency_fund" || form.type === "purchase" ? "All savings & checking" :
                         form.type === "retirement" ? "All investment accounts" : "Auto"}
                      </SelectItem>
                      {assets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.value)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Progress auto-updates from the linked asset value.</p>
                </div>
              ) : (
                <div>
                  <Label>Track Progress</Label>
                  <Select
                    value={form.linkedAssetId ? `asset:${form.linkedAssetId}` : form.linkedDebtId ? `debt:${form.linkedDebtId}` : "_manual"}
                    onValueChange={(v: string | null) => {
                      if (!v || v === "_manual") {
                        setForm({ ...form, linkedAssetId: "", linkedDebtId: "" });
                      } else if (v.startsWith("asset:")) {
                        setForm({ ...form, linkedAssetId: v.slice(6), linkedDebtId: "" });
                      } else if (v.startsWith("debt:")) {
                        setForm({ ...form, linkedDebtId: v.slice(5), linkedAssetId: "" });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_manual">Manual</SelectItem>
                      {assets.length > 0 && assets.map((a) => (
                        <SelectItem key={a.id} value={`asset:${a.id}`}>{a.name} ({formatCurrency(a.value)})</SelectItem>
                      ))}
                      {debts.length > 0 && debts.map((d) => (
                        <SelectItem key={d.id} value={`debt:${d.id}`}>{d.name} ({formatCurrency(d.balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!form.linkedAssetId && !form.linkedDebtId && (
                    <div className="mt-2">
                      <Label>Current Progress ($)</Label>
                      <Input type="number" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} placeholder="0" />
                    </div>
                  )}
                  {(form.linkedAssetId || form.linkedDebtId) && (
                    <p className="text-xs text-muted-foreground mt-1">Progress auto-updates from the linked account.</p>
                  )}
                </div>
              )}
              <div>
                <Label>Target Date</Label>
                <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              </div>
              <div>
                <Label>Priority (1 = highest)</Label>
                <Input type="number" min="1" max="10" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleSave} disabled={!form.name || !form.targetAmount || !form.targetDate}>
                {editing ? "Update" : "Add"} Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onTrackCount}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{behindCount}</p>
                <p className="text-xs text-muted-foreground">Needs Attention</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(cashFlow)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground">Free After Contributions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goal Cards */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="text-center text-muted-foreground py-16">
            <Target className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium mb-1">No goals yet</p>
            <p className="text-sm mb-4">Set financial targets to track your progress toward life milestones.</p>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => {
            const proj = projections[idx];
            const currentAmount = autoTrackedAmounts[item.id] ?? item.currentAmount;
            const pct = item.targetAmount > 0 ? Math.min(100, (currentAmount / item.targetAmount) * 100) : 0;
            const remaining = item.targetAmount - currentAmount;
            const daysLeft = Math.max(0, Math.ceil((new Date(item.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const Icon = typeIcon(item.type);
            const isDebtGoal = item.type === "debt_free";

            return (
              <Card key={item.id} className={`relative overflow-hidden ${proj?.onTrack ? "" : "border-amber-200 dark:border-amber-900"}`}>
                {/* Status indicator strip */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${proj?.onTrack ? "bg-emerald-500" : "bg-amber-500"}`} />

                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-1.5 ${proj?.onTrack ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                        <Icon className={`h-4 w-4 ${proj?.onTrack ? "text-emerald-600" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{item.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{typeLabel(item.type)}</Badge>
                          {item.linkedAssetId && (() => {
                            const a = assets.find((x) => x.id === item.linkedAssetId);
                            return a ? <Badge variant="secondary" className="text-[10px]">{a.name}</Badge> : null;
                          })()}
                          {item.linkedDebtId && (() => {
                            const d = debts.find((x) => x.id === item.linkedDebtId);
                            return d ? <Badge variant="secondary" className="text-[10px]">{d.name}</Badge> : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{formatCurrency(currentAmount)}</span>
                      <span className="text-muted-foreground">{formatCurrency(item.targetAmount)}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% complete</span>
                      <span className="text-[10px] text-muted-foreground">{formatCurrency(remaining)} left</span>
                    </div>
                  </div>

                  {/* Projection details */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Target
                      </div>
                      <span className="text-xs font-medium">{new Date(item.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    </div>

                    {proj && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Est. Completion
                          </div>
                          <span className="text-xs font-medium">{proj.estimatedDate === "Never" ? "Not achievable" : proj.estimatedDate}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            Monthly Needed
                          </div>
                          <span className="text-xs font-medium">{formatCurrency(proj.monthlySavingsNeeded)}/mo</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Target className="h-3 w-3" />
                            Status
                          </div>
                          <Badge variant={proj.onTrack ? "default" : "destructive"} className="text-[10px]">
                            {proj.onTrack ? "On Track" : `${daysLeft > 0 ? "Behind Schedule" : "Past Due"}`}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Time remaining */}
                  <div className="text-center">
                    <p className="text-lg font-bold">{daysLeft > 0 ? daysLeft : 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days Remaining</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Financial Independence Section */}
      <div className="border-t pt-8 mt-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold tracking-tight">Financial Independence</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Project when your investments can sustain your lifestyle
          </p>
        </div>

        {/* FI Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Current Age</Label>
            <Input
              type="number"
              value={fiInputs.currentAge}
              onChange={(e) => setFiInputs({ ...fiInputs, currentAge: e.target.value })}
              min="18"
              max="80"
            />
          </div>
          <div>
            <Label className="text-xs">Retirement Age</Label>
            <Input
              type="number"
              value={fiInputs.retirementAge}
              onChange={(e) => setFiInputs({ ...fiInputs, retirementAge: e.target.value })}
              min="30"
              max="90"
            />
          </div>
          <div>
            <Label className="text-xs">Return Rate (%)</Label>
            <Input
              type="number"
              value={fiInputs.returnRate}
              onChange={(e) => setFiInputs({ ...fiInputs, returnRate: e.target.value })}
              step="0.5"
              min="0"
              max="20"
            />
          </div>
          <div>
            <Label className="text-xs">Withdrawal Rate (%)</Label>
            <Input
              type="number"
              value={fiInputs.withdrawalRate}
              onChange={(e) => setFiInputs({ ...fiInputs, withdrawalRate: e.target.value })}
              step="0.5"
              min="1"
              max="10"
            />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">Projections based on your current investment contributions. Additional free surplus is not included.</p>

        {/* FI Metric Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-1.5">
                  <Target className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-xs text-muted-foreground">FI Number</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(fiCalc.fiNumber)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatCurrency(fiData.annualExpenses)}/yr x {Math.round(100 / (parseFloat(fiInputs.withdrawalRate) || 4))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-1.5">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs text-muted-foreground">Years to FI</p>
              </div>
              <p className="text-2xl font-bold">
                {fiCalc.yearsToFI === Infinity ? "N/A" : fiCalc.yearsToFI === 0 ? "Done!" : `${fiCalc.yearsToFI} yrs`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {fiCalc.yearsToFI !== Infinity && fiCalc.yearsToFI > 0
                  ? `Age ${Math.round((parseInt(fiInputs.currentAge) || 30) + fiCalc.yearsToFI)}`
                  : fiCalc.yearsToFI === 0 ? "Already FI!" : "Increase contributions"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-1.5">
                  <Zap className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-xs text-muted-foreground">Coast FI Number</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(fiCalc.coastFINumber)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Needed today to coast for {fiCalc.yearsToRetirement} yrs
              </p>
            </CardContent>
          </Card>

          <Card className={fiCalc.isCoastFI ? "border-emerald-200 dark:border-emerald-900" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`rounded-lg p-1.5 ${fiCalc.isCoastFI ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                  {fiCalc.isCoastFI
                    ? <CheckCircle className="h-4 w-4 text-emerald-600" />
                    : <AlertCircle className="h-4 w-4 text-amber-600" />}
                </div>
                <p className="text-xs text-muted-foreground">Coast Status</p>
              </div>
              <p className="text-2xl font-bold">
                {fiCalc.isCoastFI ? "Coasting!" : formatCurrency(Math.abs(fiCalc.coastFIGap))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {fiCalc.isCoastFI
                  ? `${formatCurrency(fiData.currentInvestments - fiCalc.coastFINumber)} ahead`
                  : "Still needed to coast"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FI Projection Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Investment Growth Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fiCalc.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}`}
                    label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "portfolio" ? "Portfolio" : name === "fiTarget" ? "FI Target" : "Coast FI Needed",
                    ]}
                    labelFormatter={(label) => `Age ${label}`}
                  />
                  <ReferenceLine
                    y={fiCalc.fiNumber}
                    stroke="#f97316"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={{ value: "FI Target", position: "right", fontSize: 10, fill: "#f97316" }}
                  />
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="portfolio"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#portfolioGradient)"
                    name="portfolio"
                  />
                  <Area
                    type="monotone"
                    dataKey="coastLine"
                    stroke="#a855f7"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    fill="none"
                    name="coastLine"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                Portfolio Growth
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-orange-500 rounded" style={{ borderTop: "2px dashed #f97316" }} />
                FI Target
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-purple-500 rounded" style={{ borderTop: "1px dashed #a855f7" }} />
                Coast FI Needed
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
