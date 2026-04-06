"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  DollarSign,
  CreditCard,
  Landmark,
  Target,
  Check,
  Sparkles,
  Receipt,
  Building2,
  Link,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePlaidLink } from "react-plaid-link";
import { calculateFINumber } from "@/lib/engine/calculator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncomeEntry {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  taxRate: number;
}

interface ExpenseEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: string;
  isFixed: boolean;
}

interface DebtEntry {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type: string;
  originalLoan: number | null;
  loanTermMonths: number | null;
}

interface AssetEntry {
  id: string;
  name: string;
  value: number;
  type: string;
  growthRate: number;
  monthlyContribution: number;
}

interface GoalEntry {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  type: string;
  priority: number;
}

interface PlaidConnection {
  id: string;
  institutionName: string;
  accounts: { id: string; name: string; mask: string | null; type: string; subtype: string | null }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Welcome", icon: Sparkles },
  { label: "Connect Bank", icon: Building2 },
  { label: "Income", icon: DollarSign },
  { label: "Expenses", icon: Receipt },
  { label: "Debts", icon: CreditCard },
  { label: "Assets", icon: Landmark },
  { label: "Your Profile", icon: User },
  { label: "Complete", icon: Check },
];

const EXPENSE_SUGGESTIONS = [
  { name: "Rent/Mortgage", category: "housing", amount: 1500, isFixed: true },
  { name: "Utilities", category: "utilities", amount: 200, isFixed: true },
  { name: "Groceries", category: "food", amount: 400, isFixed: false },
  { name: "Insurance", category: "insurance", amount: 300, isFixed: true },
  { name: "Subscriptions", category: "subscriptions", amount: 50, isFixed: true },
  { name: "Dining Out", category: "food", amount: 150, isFixed: false },
  { name: "Gas/Transport", category: "transport", amount: 200, isFixed: false },
];

const DEBT_TYPES = ["mortgage", "student", "credit", "auto", "personal"];
const ASSET_TYPES = ["savings", "checking", "investment", "property", "vehicle", "other"];
const GOAL_TYPES = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "net_worth", label: "Net Worth Target" },
  { value: "retirement", label: "Retirement" },
  { value: "purchase", label: "Savings for Purchase" },
  { value: "debt_free", label: "Pay Off Debt" },
  { value: "custom", label: "Custom Goal" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Data state
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [goals, setGoals] = useState<GoalEntry[]>([]);

  // Profile state
  const [currentAge, setCurrentAge] = useState("");
  const [retirementAge, setRetirementAge] = useState("60");
  const [filingStatus, setFilingStatus] = useState("single");
  const [userState, setUserState] = useState("");

  // Plaid state
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidConnections, setPlaidConnections] = useState<PlaidConnection[]>([]);

  // Form state per step
  const [incomeForm, setIncomeForm] = useState({ name: "", amount: "", frequency: "monthly", taxRate: "22", inputType: "gross" as "gross" | "net" });
  const [expenseForm, setExpenseForm] = useState({ name: "", amount: "", category: "other", frequency: "monthly", isFixed: true });
  const [debtForm, setDebtForm] = useState({ name: "", balance: "", interestRate: "", minimumPayment: "", type: "personal", originalLoan: "", loanTermMonths: "" });
  const [assetForm, setAssetForm] = useState({ name: "", value: "", type: "savings", growthRate: "0", monthlyContribution: "0" });
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", currentAmount: "0", targetDate: "", type: "custom", priority: "1" });

  // ---------------------------------------------------------------------------
  // Plaid
  // ---------------------------------------------------------------------------

  async function initPlaidLink() {
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.linkToken) setPlaidLinkToken(data.linkToken);
    } catch {
      alert("Failed to initialize bank connection. Check your Plaid API keys in Settings.");
    }
  }

  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: { institution?: { institution_id: string; name: string } | null }) => {
    try {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken, institution: metadata.institution }),
      });
      const res = await fetch("/api/plaid/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setPlaidConnections(data);
      setPlaidLinkToken(null);
    } catch {
      alert("Failed to connect bank account.");
    }
  }, []);

  const plaidConfig = { token: plaidLinkToken, onSuccess: onPlaidSuccess };
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink(plaidConfig as Parameters<typeof usePlaidLink>[0]);

  useEffect(() => {
    if (plaidLinkToken && plaidReady) openPlaidLink();
  }, [plaidLinkToken, plaidReady, openPlaidLink]);

  // Load existing Plaid connections on mount
  useEffect(() => {
    fetch("/api/plaid/accounts").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setPlaidConnections(data);
    }).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function toMonthly(amount: number, frequency: string): number {
    switch (frequency) {
      case "annual": return amount / 12;
      case "biweekly": return (amount * 26) / 12;
      case "weekly": return (amount * 52) / 12;
      default: return amount;
    }
  }

  function capitalize(s: string): string {
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---------------------------------------------------------------------------
  // Add handlers
  // ---------------------------------------------------------------------------

  function addIncome() {
    if (!incomeForm.name || !incomeForm.amount) return;
    const taxRate = incomeForm.inputType === "net" ? 0 : (parseFloat(incomeForm.taxRate) || 0);
    setIncomes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: incomeForm.name, amount: parseFloat(incomeForm.amount), frequency: incomeForm.frequency, taxRate },
    ]);
    setIncomeForm({ name: "", amount: "", frequency: "monthly", taxRate: "22", inputType: "gross" });
  }

  function addExpense(suggestion?: (typeof EXPENSE_SUGGESTIONS)[0]) {
    if (suggestion) {
      setExpenses((prev) => [...prev, { id: crypto.randomUUID(), frequency: "monthly", ...suggestion }]);
      return;
    }
    if (!expenseForm.name || !expenseForm.amount) return;
    setExpenses((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: expenseForm.name, amount: parseFloat(expenseForm.amount), category: expenseForm.category, frequency: expenseForm.frequency, isFixed: expenseForm.isFixed },
    ]);
    setExpenseForm({ name: "", amount: "", category: "other", frequency: "monthly", isFixed: true });
  }

  function addDebt() {
    if (!debtForm.name || !debtForm.balance || !debtForm.interestRate || !debtForm.minimumPayment) return;
    setDebts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(), name: debtForm.name, balance: parseFloat(debtForm.balance), interestRate: parseFloat(debtForm.interestRate),
        minimumPayment: parseFloat(debtForm.minimumPayment), type: debtForm.type,
        originalLoan: debtForm.originalLoan ? parseFloat(debtForm.originalLoan) : null,
        loanTermMonths: debtForm.loanTermMonths ? parseInt(debtForm.loanTermMonths) : null,
      },
    ]);
    setDebtForm({ name: "", balance: "", interestRate: "", minimumPayment: "", type: "personal", originalLoan: "", loanTermMonths: "" });
  }

  function addAsset() {
    if (!assetForm.name || !assetForm.value) return;
    setAssets((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: assetForm.name, value: parseFloat(assetForm.value), type: assetForm.type, growthRate: parseFloat(assetForm.growthRate) || 0, monthlyContribution: parseFloat(assetForm.monthlyContribution) || 0 },
    ]);
    setAssetForm({ name: "", value: "", type: "savings", growthRate: "0", monthlyContribution: "0" });
  }

  function addGoal() {
    if (!goalForm.name || !goalForm.targetAmount) return;
    const targetDate = goalForm.targetDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setGoals((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: goalForm.name, targetAmount: parseFloat(goalForm.targetAmount), currentAmount: parseFloat(goalForm.currentAmount) || 0, targetDate, type: goalForm.type, priority: parseInt(goalForm.priority) || 1 },
    ]);
    setGoalForm({ name: "", targetAmount: "", currentAmount: "0", targetDate: "", type: "custom", priority: "1" });
  }

  // ---------------------------------------------------------------------------
  // Save all and redirect
  // ---------------------------------------------------------------------------

  async function handleFinish() {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomes, expenses, debts, assets, goals,
          currentAge: currentAge ? parseInt(currentAge) : null,
          retirementAge: retirementAge ? parseInt(retirementAge) : null,
          filingStatus: filingStatus || null,
          state: userState || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const progressPercent = Math.round((step / (STEPS.length - 1)) * 100);
  const monthlyIncome = incomes.reduce((s, i) => s + toMonthly(i.amount, i.frequency) * (1 - i.taxRate / 100), 0);
  const monthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const monthlyDebtPayments = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalContributions = assets.reduce((s, a) => s + a.monthlyContribution, 0);
  const cashFlow = monthlyIncome - monthlyExpenses - monthlyDebtPayments - totalContributions;
  const annualExpenses = monthlyExpenses * 12;
  const fiNumber = annualExpenses > 0 ? calculateFINumber(annualExpenses, 4) : 0;

  // ---------------------------------------------------------------------------
  // Render step content
  // ---------------------------------------------------------------------------

  function renderStep() {
    switch (step) {
      // === WELCOME ===
      case 0:
        return (
          <div className="text-center py-8 space-y-6 max-w-lg mx-auto">
            <div className="rounded-full bg-primary/10 w-20 h-20 flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Welcome to CapitalOS</h2>
            <p className="text-muted-foreground">
              Let&apos;s set up your financial picture. We&apos;ll walk you through connecting your bank, entering your income, expenses, debts, assets, and goals.
            </p>
            <p className="text-muted-foreground text-sm">
              Every step is optional &mdash; add what you can now and fill in the rest later.
            </p>
          </div>
        );

      // === CONNECT BANK ===
      case 1:
        return (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Connect Your Bank</h2>
              <p className="text-muted-foreground text-sm">
                Link your bank accounts to auto-sync transactions and keep balances up to date. You can also connect banks later from the Check-in page.
              </p>
            </div>

            {plaidConnections.length > 0 && (
              <div className="space-y-3">
                {plaidConnections.map((conn) => (
                  <Card key={conn.id}>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm">{conn.institutionName}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {conn.accounts.map((acc) => (
                          <Badge key={acc.id} variant="secondary" className="text-[10px]">
                            {acc.name} {acc.mask ? `****${acc.mask}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="text-center">
              <Button onClick={initPlaidLink} variant="outline" size="lg">
                <Link className="h-4 w-4 mr-2" />
                {plaidConnections.length > 0 ? "Connect Another Bank" : "Connect Bank"}
              </Button>
            </div>

            {plaidConnections.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Your data stays on your device. Bank connections are powered by Plaid.
              </p>
            )}
          </div>
        );

      // === INCOME ===
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Income Sources</h2>
              <p className="text-muted-foreground text-sm">Add your salary, side income, or any recurring income.</p>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Source Name</Label><Input value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} placeholder="e.g. Salary" /></div>
                  <div>
                    <Label>Amount Type</Label>
                    <Select value={incomeForm.inputType} onValueChange={(v: string | null) => { if (v) setIncomeForm({ ...incomeForm, inputType: v as "gross" | "net", taxRate: v === "net" ? "0" : incomeForm.taxRate === "0" ? "22" : incomeForm.taxRate }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gross">Gross (before tax)</SelectItem>
                        <SelectItem value="net">Net (after tax)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={`grid gap-3 ${incomeForm.inputType === "gross" ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div><Label>{incomeForm.inputType === "gross" ? "Gross Amount ($)" : "Net Amount ($)"}</Label><Input type="number" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="5000" /></div>
                  <div>
                    <Label>Frequency</Label>
                    <Select value={incomeForm.frequency} onValueChange={(v: string | null) => { if (v) setIncomeForm({ ...incomeForm, frequency: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {incomeForm.inputType === "gross" && (
                    <div><Label>Tax Rate (%)</Label><Input type="number" value={incomeForm.taxRate} onChange={(e) => setIncomeForm({ ...incomeForm, taxRate: e.target.value })} placeholder="22" /></div>
                  )}
                </div>
                <Button onClick={addIncome} disabled={!incomeForm.name || !incomeForm.amount} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Income</Button>
              </CardContent>
            </Card>
            {incomes.length > 0 && (
              <div className="space-y-2">
                {incomes.map((i) => (
                  <div key={i.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
                    <div><p className="text-sm font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(i.amount)} / {i.frequency}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setIncomes((prev) => prev.filter((x) => x.id !== i.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-right">Monthly net: <span className="font-medium text-foreground">{formatCurrency(monthlyIncome)}</span></p>
              </div>
            )}
          </div>
        );

      // === EXPENSES ===
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Monthly Expenses</h2>
              <p className="text-muted-foreground text-sm">Add your recurring expenses. Use the quick-add buttons or enter custom ones.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_SUGGESTIONS.filter((s) => !expenses.some((e) => e.name === s.name)).map((s) => (
                <Button key={s.name} variant="outline" size="sm" onClick={() => addExpense(s)}>
                  <Plus className="h-3 w-3 mr-1" /> {s.name} ({formatCurrency(s.amount)})
                </Button>
              ))}
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Expense Name</Label><Input value={expenseForm.name} onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })} placeholder="e.g. Gym membership" /></div>
                  <div><Label>Amount ($)</Label><Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={expenseForm.category} onValueChange={(v: string | null) => { if (v) setExpenseForm({ ...expenseForm, category: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["housing", "transport", "food", "utilities", "subscriptions", "entertainment", "insurance", "shopping", "health", "personal", "education", "other"].map((c) => (
                          <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Select value={expenseForm.frequency} onValueChange={(v: string | null) => { if (v) setExpenseForm({ ...expenseForm, frequency: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => addExpense()} disabled={!expenseForm.name || !expenseForm.amount} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
              </CardContent>
            </Card>
            {expenses.length > 0 && (
              <div className="space-y-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
                    <div><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(e.amount)} / {e.frequency} &middot; {capitalize(e.category)}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setExpenses((prev) => prev.filter((x) => x.id !== e.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-right">Monthly total: <span className="font-medium text-foreground">{formatCurrency(monthlyExpenses)}</span></p>
              </div>
            )}
          </div>
        );

      // === DEBTS ===
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Debts</h2>
              <p className="text-muted-foreground text-sm">Add mortgages, student loans, credit cards, and other debts.</p>
            </div>
            {plaidConnections.length > 0 && (
              <p className="text-xs text-center text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                Tip: After setup, you can link these debts to your bank accounts for automatic balance updates.
              </p>
            )}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} placeholder="e.g. Car Loan" /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={debtForm.type} onValueChange={(v: string | null) => { if (v) setDebtForm({ ...debtForm, type: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEBT_TYPES.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Balance ($)</Label><Input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} placeholder="15000" /></div>
                  <div><Label>Rate (% APR)</Label><Input type="number" step="0.1" value={debtForm.interestRate} onChange={(e) => setDebtForm({ ...debtForm, interestRate: e.target.value })} placeholder="5.5" /></div>
                  <div><Label>Payment ($/mo)</Label><Input type="number" value={debtForm.minimumPayment} onChange={(e) => setDebtForm({ ...debtForm, minimumPayment: e.target.value })} placeholder="350" /></div>
                </div>
                <Button onClick={addDebt} disabled={!debtForm.name || !debtForm.balance || !debtForm.interestRate || !debtForm.minimumPayment} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Debt</Button>
              </CardContent>
            </Card>
            {debts.length > 0 && (
              <div className="space-y-2">
                {debts.map((d) => (
                  <div key={d.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
                    <div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(d.balance)} at {d.interestRate}% &middot; {formatCurrency(d.minimumPayment)}/mo</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setDebts((prev) => prev.filter((x) => x.id !== d.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-right">Total debt: <span className="font-medium text-red-500">{formatCurrency(totalDebt)}</span></p>
              </div>
            )}
          </div>
        );

      // === ASSETS ===
      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Assets</h2>
              <p className="text-muted-foreground text-sm">Add savings accounts, investments, property, and other assets.</p>
            </div>
            {plaidConnections.length > 0 && (
              <p className="text-xs text-center text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                Tip: After setup, you can link these assets to your bank accounts for automatic value updates.
              </p>
            )}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. 401(k)" /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={assetForm.type} onValueChange={(v: string | null) => { if (v) setAssetForm({ ...assetForm, type: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Value ($)</Label><Input type="number" value={assetForm.value} onChange={(e) => setAssetForm({ ...assetForm, value: e.target.value })} placeholder="25000" /></div>
                  <div><Label>Growth (%/yr)</Label><Input type="number" step="0.1" value={assetForm.growthRate} onChange={(e) => setAssetForm({ ...assetForm, growthRate: e.target.value })} placeholder="7" /></div>
                  <div><Label>Contrib. ($/mo)</Label><Input type="number" value={assetForm.monthlyContribution} onChange={(e) => setAssetForm({ ...assetForm, monthlyContribution: e.target.value })} placeholder="500" /></div>
                </div>
                <Button onClick={addAsset} disabled={!assetForm.name || !assetForm.value} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Asset</Button>
              </CardContent>
            </Card>
            {assets.length > 0 && (
              <div className="space-y-2">
                {assets.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
                    <div><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(a.value)} &middot; {capitalize(a.type)} &middot; {a.growthRate}% growth</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-right">Total assets: <span className="font-medium text-green-600">{formatCurrency(totalAssets)}</span></p>
              </div>
            )}
          </div>
        );

      // === YOUR PROFILE (age + goals) ===
      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Your Profile</h2>
              <p className="text-muted-foreground text-sm">Set your age for the Financial Independence calculator and add financial goals.</p>
            </div>

            {/* Age inputs */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Age &amp; Retirement</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Current Age</Label><Input type="number" value={currentAge} onChange={(e) => setCurrentAge(e.target.value)} placeholder="30" min="18" max="80" /></div>
                  <div><Label>Target Retirement Age</Label><Input type="number" value={retirementAge} onChange={(e) => setRetirementAge(e.target.value)} placeholder="60" min="30" max="90" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>Filing Status</Label>
                    <Select value={filingStatus} onValueChange={(v: string | null) => { if (v) setFilingStatus(v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married Filing Jointly</SelectItem>
                        <SelectItem value="head_of_household">Head of Household</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={userState} onChange={(e) => setUserState(e.target.value.toUpperCase().slice(0, 2))} placeholder="e.g. MD" maxLength={2} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Used for tax estimates and the FI calculator.</p>
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Goals</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <p className="text-xs text-muted-foreground">Goals like Net Worth, Emergency Fund, and Debt Payoff will automatically track your progress from your real data.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Goal Name</Label><Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="e.g. $100K Net Worth" /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={goalForm.type} onValueChange={(v: string | null) => { if (v) setGoalForm({ ...goalForm, type: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{GOAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Target ($)</Label><Input type="number" value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} placeholder="100000" /></div>
                  <div><Label>Target Date</Label><Input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })} /></div>
                  <div><Label>Priority</Label><Input type="number" min="1" max="10" value={goalForm.priority} onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })} placeholder="1" /></div>
                </div>
                <Button onClick={addGoal} disabled={!goalForm.name || !goalForm.targetAmount} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Goal</Button>
              </CardContent>
            </Card>

            {goals.length > 0 && (
              <div className="space-y-2">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
                    <div><p className="text-sm font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(g.targetAmount)} &middot; {GOAL_TYPES.find((t) => t.value === g.type)?.label || g.type}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // === COMPLETE ===
      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
              <p className="text-muted-foreground text-sm">Here&apos;s your financial snapshot.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plaidConnections.length > 0 && (
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{plaidConnections.length}</p><p className="text-xs text-muted-foreground">Banks Connected</p></CardContent></Card>
              )}
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{formatCurrency(monthlyIncome)}</p><p className="text-xs text-muted-foreground">Monthly Income</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</p><p className="text-xs text-muted-foreground">Monthly Expenses</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-500">{formatCurrency(totalDebt)}</p><p className="text-xs text-muted-foreground">Total Debt</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{formatCurrency(totalAssets)}</p><p className="text-xs text-muted-foreground">Total Assets</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${cashFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(cashFlow)}</p><p className="text-xs text-muted-foreground">Monthly Cash Flow</p></CardContent></Card>
            </div>

            {fiNumber > 0 && currentAge && (
              <Card className="border-orange-200 dark:border-orange-900">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Your Financial Independence Number</p>
                  <p className="text-3xl font-bold text-orange-600">{formatCurrency(fiNumber)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Track your progress on the Goals page</p>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleFinish} disabled={saving} size="lg" className="w-full">
              {saving ? "Saving..." : <><Sparkles className="w-5 h-5 mr-2" /> Launch Dashboard</>}
            </Button>
          </div>
        );

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const isDataStep = step >= 2 && step <= 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step].label}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />

          {/* Step indicators */}
          <div className="hidden sm:flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`rounded-full w-8 h-8 flex items-center justify-center text-xs ${
                    done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] ${active ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="p-6">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation */}
        {step < 7 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex gap-2">
              {isDataStep && (
                <Button variant="ghost" onClick={() => setStep((s) => s + 1)} className="text-muted-foreground">
                  Skip
                </Button>
              )}
              {step === 1 && (
                <Button variant="ghost" onClick={() => setStep((s) => s + 1)} className="text-muted-foreground">
                  Skip
                </Button>
              )}
              <Button onClick={() => setStep((s) => s + 1)} className="gap-1">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
