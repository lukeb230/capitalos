"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileText,
  Check,
  ChevronRight,
  Trash2,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  X,
  Link,
  RefreshCw,
  Building2,
  Unlink,
  ReceiptText,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { parseCSV, DEFAULT_ACCOUNT_TYPE, DEFAULT_ACCOUNT_LABEL } from "@/lib/checkin/csv-parser";
import { parsePDF } from "@/lib/checkin/pdf-parser";
import { autoCategory } from "@/lib/checkin/category-mapper";
import type {
  AccountType,
  NormalizedTransaction,
  ParseResult,
  WizardStep,
  CheckinGrade,
} from "@/lib/checkin/types";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface Props {
  budget: Record<string, number>;
  pastCheckins: {
    id: string;
    month: number;
    year: number;
    totalIncome: number;
    totalExpenses: number;
    overallGrade: string;
    expensesByCategory: string;
    gradeDetails: string;
    createdAt: string;
  }[];
}

const CATEGORIES = [
  "housing",
  "transport",
  "food",
  "utilities",
  "subscriptions",
  "entertainment",
  "insurance",
  "shopping",
  "health",
  "personal",
  "education",
  "pets",
  "transfers",
  "other",
];

const STEP_LABELS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "grade", label: "Grade" },
  { key: "suggestions", label: "Suggestions" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-emerald-600";
    case "B":
      return "text-blue-600";
    case "C":
      return "text-amber-600";
    case "D":
      return "text-orange-600";
    case "F":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "C":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "D":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "F":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-muted";
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CheckinWizard({ budget, pastCheckins }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  const [files, setFiles] = useState<{ name: string; result: ParseResult; accountType: AccountType; accountLabel: string }[]>(
    []
  );
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [grades, setGrades] = useState<CheckinGrade | null>(null);
  const [suggestions, setSuggestions] = useState<{
    summary: string;
    categoryInsights: {
      category: string;
      grade: string;
      insight: string;
      suggestion: string;
    }[];
    topActions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // History expansion
  const [expandedCheckin, setExpandedCheckin] = useState<string | null>(null);

  // Track manually-edited transaction IDs so AI categorization doesn't overwrite them
  const [manualEdits, setManualEdits] = useState<Set<string>>(new Set());

  // Drag state
  const [dragging, setDragging] = useState(false);

  // Transaction viewer state
  const [txViewerOpen, setTxViewerOpen] = useState(false);
  const [txViewerData, setTxViewerData] = useState<{ id: string; date: string; description: string; amount: number; isIncome: boolean; category: string; excluded: boolean }[]>([]);
  const [txViewerLoading, setTxViewerLoading] = useState(false);
  const [txFilterCategory, setTxFilterCategory] = useState("all");
  const [txFilterSearch, setTxFilterSearch] = useState("");

  async function openTransactionViewer() {
    setTxViewerOpen(true);
    setTxViewerLoading(true);
    try {
      const res = await fetch("/api/transactions?days=90");
      const data = await res.json();
      if (Array.isArray(data)) setTxViewerData(data);
    } catch {
      alert("Failed to load transactions.");
    } finally {
      setTxViewerLoading(false);
    }
  }

  async function updateTransactionCategory(txId: string, newCategory: string) {
    try {
      await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, category: newCategory }),
      });
      setTxViewerData((prev) => prev.map((t) => t.id === txId ? { ...t, category: newCategory } : t));
    } catch {
      alert("Failed to update category.");
    }
  }

  // Plaid state
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidItems, setPlaidItems] = useState<
    { id: string; institutionName: string; lastSynced: string | null; isActive: boolean; accounts: { id: string; name: string; type: string; subtype: string | null; mask: string | null; balanceCurrent: number | null }[] }[]
  >([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; modified: number; removed: number } | null>(null);

  // Load connected accounts on mount
  useEffect(() => {
    fetch("/api/plaid/accounts").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setPlaidItems(data);
    }).catch(() => {});
  }, []);

  // Create Plaid link token
  async function initPlaidLink() {
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.linkToken) setPlaidLinkToken(data.linkToken);
    } catch {
      alert("Failed to initialize bank connection. Check your Plaid API keys.");
    }
  }

  // Handle Plaid Link success
  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: { institution?: { institution_id: string; name: string } | null }) => {
    try {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: publicToken,
          institution: metadata.institution,
        }),
      });
      // Refresh account list
      const res = await fetch("/api/plaid/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setPlaidItems(data);
      setPlaidLinkToken(null);
    } catch {
      alert("Failed to connect bank account.");
    }
  }, []);

  const plaidConfig = {
    token: plaidLinkToken,
    onSuccess: onPlaidSuccess,
  };

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink(plaidConfig as Parameters<typeof usePlaidLink>[0]);

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (plaidLinkToken && plaidReady) openPlaidLink();
  }, [plaidLinkToken, plaidReady, openPlaidLink]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ added: data.added, modified: data.modified, removed: data.removed });
        // Also refresh balances
        await fetch("/api/plaid/balances", { method: "POST" });
        await fetch("/api/plaid/investments", { method: "POST" });
        // Refresh account list for updated balances
        const accountsRes = await fetch("/api/plaid/accounts");
        const accountsData = await accountsRes.json();
        if (Array.isArray(accountsData)) setPlaidItems(accountsData);
      }
    } catch {
      alert("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(itemId: string) {
    try {
      const res = await fetch(`/api/plaid/accounts?itemId=${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setPlaidItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch {
      alert("Failed to disconnect account.");
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const activeTransactions = transactions.filter((t) => !t.excluded);
  const totalIncome = activeTransactions
    .filter((t) => t.isIncome)
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = activeTransactions
    .filter((t) => !t.isIncome)
    .reduce((s, t) => s + t.amount, 0);

  const expensesByCategory: Record<string, number> = {};
  activeTransactions
    .filter((t) => !t.isIncome)
    .forEach((t) => {
      expensesByCategory[t.category] =
        (expensesByCategory[t.category] || 0) + t.amount;
    });

  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  function autoDetectMonth(result: ParseResult) {
    if (result.transactions.length > 0) {
      const monthCounts: Record<string, number> = {};
      result.transactions.forEach((t) => {
        const d = new Date(t.date);
        const key = `${d.getMonth() + 1}-${d.getFullYear()}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });
      const best = Object.entries(monthCounts).sort(
        (a, b) => b[1] - a[1]
      )[0];
      if (best) {
        const [m, y] = best[0].split("-").map(Number);
        setSelectedMonth(m);
        setSelectedYear(y);
      }
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const MAX_FILE_SIZE = 10_000_000; // 10MB
    const filesToProcess = Array.from(fileList).filter((file) => {
      const name = file.name.toLowerCase();
      if (!(name.endsWith(".pdf") || name.endsWith(".csv"))) return false;
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" is too large (${(file.size / 1_000_000).toFixed(1)}MB). Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    for (const file of filesToProcess) {
      const isCSV = file.name.toLowerCase().endsWith(".csv");

      if (isCSV) {
        const text = await file.text();
        const result = parseCSV(text);
        setFiles((prev) => [...prev, {
          name: file.name,
          result,
          accountType: DEFAULT_ACCOUNT_TYPE[result.format],
          accountLabel: DEFAULT_ACCOUNT_LABEL[result.format],
        }]);
        autoDetectMonth(result);
      } else {
        // PDF parsing — send to server for text extraction + AI parsing
        setLoading(true);
        try {
          // Read file as base64
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );

          // Send to server API for text extraction + AI parsing
          const aiRes = await fetch("/api/checkin/parse-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfBase64: base64, bankHint: file.name }),
          });
          const aiData = await aiRes.json();

          if (aiData.transactions && aiData.transactions.length > 0) {
            const aiTransactions = aiData.transactions.map((t: { date: string; description: string; amount: number; isIncome: boolean }) => ({
              id: "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
              date: t.date,
              description: t.description,
              amount: Math.abs(t.amount),
              isIncome: t.isIncome,
              category: autoCategory(t.description),
              source: "pdf" as const,
              excluded: false,
              accountType: "checking" as AccountType,
              accountLabel: "PDF Statement",
            }));
            aiTransactions.sort((a: NormalizedTransaction, b: NormalizedTransaction) => a.date.localeCompare(b.date));
            const aiResult: ParseResult = {
              format: "usaa",
              formatLabel: "PDF (AI parsed)",
              transactions: aiTransactions,
              errors: [],
              dateRange: aiTransactions.length > 0
                ? { from: aiTransactions[0].date, to: aiTransactions[aiTransactions.length - 1].date }
                : null,
            };
            setFiles((prev) => [...prev, { name: file.name, result: aiResult, accountType: "checking", accountLabel: "PDF Statement" }]);
            autoDetectMonth(aiResult);
          } else {
            setFiles((prev) => [...prev, {
              name: file.name,
              result: {
                format: "unknown",
                formatLabel: "PDF",
                transactions: [],
                errors: [aiData.error || "No transactions found in PDF"],
                dateRange: null,
              },
              accountType: "checking",
              accountLabel: "PDF Statement",
            }]);
          }
        } catch (err) {
          setFiles((prev) => [...prev, {
            name: file.name,
            result: {
              format: "unknown",
              formatLabel: "PDF Error",
              transactions: [],
              errors: [`Failed to parse PDF: ${err instanceof Error ? err.message : "Unknown error"}`],
              dateRange: null,
            },
            accountType: "checking",
            accountLabel: "PDF Statement",
          }]);
        } finally {
          setLoading(false);
        }
      }
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function continueToReview() {
    // Apply account type/label from file settings to each transaction
    const merged = files.flatMap((f) =>
      f.result.transactions.map((t) => ({
        ...t,
        accountType: f.accountType,
        accountLabel: f.accountLabel,
      }))
    );

    // Auto-exclude inter-account transfers when both checking and credit card are present
    const hasChecking = files.some((f) => f.accountType === "checking");
    const hasCreditCard = files.some((f) => f.accountType === "credit_card");
    const TRANSFER_PATTERNS = [
      /amex/i, /american express/i, /card payment/i, /credit card payment/i,
      /payment.*thank/i, /autopay/i, /online payment/i, /payment received/i,
      /chase credit/i, /navy fed.*credit/i, /nfcu.*payment/i,
    ];

    const processed = merged.map((t) => {
      if (hasChecking && hasCreditCard && t.accountType === "checking" && !t.isIncome) {
        // Check if this checking transaction looks like a credit card payment
        const isTransfer = TRANSFER_PATTERNS.some((p) => p.test(t.description));
        if (isTransfer) {
          return { ...t, excluded: true, category: "transfers" };
        }
      }
      return t;
    });

    setTransactions(processed);
    setStep("review");

    // AI categorization — run in background after showing review
    try {
      const descriptions = merged.map((t) => t.description);
      const res = await fetch("/api/checkin/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptions }),
      });
      const data = await res.json();
      if (data.categories && Object.keys(data.categories).length > 0) {
        setTransactions((prev) =>
          prev.map((t) => {
            // Skip transactions the user has manually edited
            if (manualEdits.has(t.id)) return t;
            const aiCat = data.categories[t.description];
            // Only override if AI found a category and current is "other"
            if (aiCat && (t.category === "other" || !t.category)) {
              return { ...t, category: aiCat };
            }
            return t;
          })
        );
      }
    } catch {
      // AI categorization failed silently — keyword categories remain
    }
  }

  async function loadPlaidTransactions() {
    setLoading(true);
    setFiles([]);
    try {
      // Sync first to get latest transactions
      await fetch("/api/plaid/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });

      // Fetch transactions for selected month
      const res = await fetch(`/api/plaid/transactions?month=${selectedMonth}&year=${selectedYear}`);
      const plaidTxns = await res.json();

      if (!Array.isArray(plaidTxns) || plaidTxns.length === 0) {
        alert(`No Plaid transactions found for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}. Try syncing first or selecting a different month.`);
        setLoading(false);
        return;
      }

      // Auto-exclude transfers and inter-account payments
      const TRANSFER_PATTERNS = [
        /amex/i, /american express/i, /card payment/i, /credit card payment/i,
        /payment.*thank/i, /autopay/i, /online payment/i, /payment received/i,
        /chase credit/i, /navy fed.*credit/i, /nfcu.*payment/i,
        /transfer/i, /xfer/i, /payment to/i, /payment from/i,
        /usaa.*transfer/i, /internal transfer/i,
      ];

      const hasChecking = plaidTxns.some((t: NormalizedTransaction) => t.accountType === "checking");
      const hasCreditCard = plaidTxns.some((t: NormalizedTransaction) => t.accountType === "credit_card");

      const processed = plaidTxns.map((t: NormalizedTransaction) => {
        // Already categorized as transfer by Plaid — auto-exclude
        if (t.category === "transfers") {
          return { ...t, excluded: true };
        }

        // Checking → credit card payment detection
        if (hasChecking && hasCreditCard) {
          const isCheckingType = t.accountType === "checking";
          if (isCheckingType && !t.isIncome) {
            const isTransfer = TRANSFER_PATTERNS.some((p) => p.test(t.description));
            if (isTransfer) {
              return { ...t, excluded: true, category: "transfers" };
            }
          }
          // Credit card "payment received" — the other side of the transfer
          if (t.accountType === "credit_card" && t.isIncome) {
            const isPayment = TRANSFER_PATTERNS.some((p) => p.test(t.description));
            if (isPayment) {
              return { ...t, excluded: true, category: "transfers" };
            }
          }
        }

        return t;
      });

      setTransactions(processed);
      setStep("review");

      // AI categorization for "other" categories
      try {
        const descriptions = plaidTxns.map((t: { description: string }) => t.description);
        const catRes = await fetch("/api/checkin/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptions }),
        });
        const catData = await catRes.json();
        if (catData.categories && Object.keys(catData.categories).length > 0) {
          setTransactions((prev) =>
            prev.map((t) => {
              if (manualEdits.has(t.id)) return t;
              const aiCat = catData.categories[t.description];
              if (aiCat && (t.category === "other" || !t.category)) {
                return { ...t, category: aiCat };
              }
              return t;
            })
          );
        }
      } catch {
        // AI categorization failed silently
      }
    } catch {
      alert("Failed to load Plaid transactions.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Review helpers
  // ---------------------------------------------------------------------------

  function updateTransaction(
    index: number,
    updates: Partial<NormalizedTransaction>
  ) {
    setTransactions((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        // Track manual category edits so AI doesn't overwrite them
        if (updates.category) {
          setManualEdits((s) => new Set(s).add(t.id));
        }
        return { ...t, ...updates };
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Grade step
  // ---------------------------------------------------------------------------

  async function confirmAndGrade() {
    setStep("grade");
    setLoading(true);
    try {
      const res = await fetch("/api/checkin/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expensesByCategory, budget }),
      });
      const data = await res.json();
      setGrades(data);
    } catch (err) {
      console.error("Grade error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Convert grades to flat map for storage and API consumption
  // ---------------------------------------------------------------------------

  const gradeDetailsMap: Record<string, { budgeted: number; actual: number; grade: string; diff: number }> = {};
  if (grades) {
    for (const cat of grades.categories) {
      gradeDetailsMap[cat.category] = {
        budgeted: cat.budgeted,
        actual: cat.actual,
        grade: cat.grade,
        diff: cat.diff,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Suggestions step
  // ---------------------------------------------------------------------------

  async function getSuggestions() {
    setStep("suggestions");
    setLoading(true);
    try {
      const res = await fetch("/api/checkin/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          gradeDetails: gradeDetailsMap,
          expensesByCategory,
          totalIncome,
          totalExpenses,
        }),
      });
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error("Suggestions error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function saveCheckin() {
    setLoading(true);
    try {
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          totalIncome,
          totalExpenses,
          overallGrade: grades?.overallGrade ?? "",
          expensesByCategory,
          gradeDetails: gradeDetailsMap,
          transactions: activeTransactions,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete checkin
  // ---------------------------------------------------------------------------

  async function deleteCheckin(id: string) {
    if (!confirm("Delete this check-in and all its transactions?")) return;
    try {
      const res = await fetch(`/api/checkin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Failed to delete check-in. Please try again.");
    }
  }

  // ---------------------------------------------------------------------------
  // Render: Step indicator
  // ---------------------------------------------------------------------------

  function renderStepIndicator() {
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEP_LABELS.map((s, i) => {
          const isCompleted = i < stepIndex;
          const isCurrent = i === stepIndex;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium border ${
                    isCompleted
                      ? "bg-primary text-primary-foreground border-primary"
                      : isCurrent
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    isCurrent
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Upload step
  // ---------------------------------------------------------------------------

  function renderUpload() {
    const hasTransactions = files.some((f) => f.result.transactions.length > 0);

    return (
      <div className="space-y-6">
        {/* Connected Bank Accounts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Connected Accounts</CardTitle>
              </div>
              <div className="flex gap-2">
                {plaidItems.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                    <RefreshCw className={`h-3 w-3 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync Now"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={initPlaidLink}>
                  <Link className="h-3 w-3 mr-1.5" />
                  Connect Bank
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {plaidItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No banks connected. Connect a bank account to auto-sync transactions.
              </p>
            ) : (
              <div className="space-y-3">
                {plaidItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{item.institutionName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.lastSynced
                            ? `Last synced: ${new Date(item.lastSynced).toLocaleString()}`
                            : "Never synced"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDisconnect(item.id)}>
                        <Unlink className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.accounts.map((acc) => (
                        <Badge key={acc.id} variant="secondary" className="text-[10px]">
                          {acc.name} {acc.mask ? `****${acc.mask}` : ""} {acc.balanceCurrent != null ? `(${formatCurrency(Math.abs(acc.balanceCurrent))})` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {syncResult && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    Synced: {syncResult.added} added, {syncResult.modified} modified, {syncResult.removed} removed
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">
            Drop CSV or PDF statements here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload one file per account (bank, credit card, etc.)
          </p>
        </div>

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((f, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{f.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {f.result.format && (
                            <Badge variant="secondary" className="text-xs">
                              {f.result.formatLabel}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {f.result.transactions.length} transactions
                          </span>
                          {f.result.transactions.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {fmtDate(f.result.transactions[0].date)} &ndash;{" "}
                              {fmtDate(
                                f.result.transactions[
                                  f.result.transactions.length - 1
                                ].date
                              )}
                            </span>
                          )}
                        </div>
                        {/* Account type selector */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Account type:</span>
                          <Select
                            value={f.accountType}
                            onValueChange={(v: string | null) => {
                              if (!v) return;
                              setFiles((prev) => prev.map((file, idx) =>
                                idx === i ? { ...file, accountType: v as AccountType } : file
                              ));
                            }}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checking">Checking</SelectItem>
                              <SelectItem value="credit_card">Credit Card</SelectItem>
                              <SelectItem value="savings">Savings</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-7 w-[160px] text-xs"
                            placeholder="Account label"
                            value={f.accountLabel}
                            onChange={(e) => {
                              setFiles((prev) => prev.map((file, idx) =>
                                idx === i ? { ...file, accountLabel: e.target.value } : file
                              ));
                            }}
                          />
                        </div>
                        {f.result.errors && f.result.errors.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {f.result.errors.length} warning(s)
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Remove file"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Month/year selection — always visible */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Check-in for:</span>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v: string | null) => {
              if (v) setSelectedMonth(Number(v));
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedYear)}
            onValueChange={(v: string | null) => {
              if (v) setSelectedYear(Number(v));
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                selectedYear - 1,
                selectedYear,
                selectedYear + 1,
              ].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Continue options */}
        <div className="flex items-center justify-between">
          {plaidItems.length > 0 && (
            <Button variant="outline" onClick={loadPlaidTransactions} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Use Plaid Transactions
            </Button>
          )}
          <div className={plaidItems.length === 0 ? "ml-auto" : ""}>
            <Button disabled={!hasTransactions} onClick={continueToReview}>
              {hasTransactions ? "Continue with Statements" : "Upload Statements to Continue"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Review step
  // ---------------------------------------------------------------------------

  function renderReview() {
    const net = totalIncome - totalExpenses;

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Income</p>
              <p className="text-xl font-semibold text-emerald-600">
                {formatCurrency(totalIncome)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Total Expenses
              </p>
              <p className="text-xl font-semibold text-red-600">
                {formatCurrency(totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Net</p>
              <p
                className={`text-xl font-semibold ${
                  net >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              >
                {formatCurrency(net)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions grouped by account */}
        {(() => {
          const accountGroups = new Map<string, { accountType: AccountType; transactions: { tx: NormalizedTransaction; globalIndex: number }[] }>();
          transactions.forEach((t, i) => {
            const key = t.accountLabel || "Unknown";
            if (!accountGroups.has(key)) {
              accountGroups.set(key, { accountType: t.accountType, transactions: [] });
            }
            accountGroups.get(key)!.transactions.push({ tx: t, globalIndex: i });
          });

          return Array.from(accountGroups.entries()).map(([label, group]) => {
            const activeTxs = group.transactions.filter((g) => !g.tx.excluded);
            const groupIncome = activeTxs.filter((g) => g.tx.isIncome).reduce((s, g) => s + g.tx.amount, 0);
            const groupExpenses = activeTxs.filter((g) => !g.tx.isIncome).reduce((s, g) => s + g.tx.amount, 0);
            const excludedCount = group.transactions.filter((g) => g.tx.excluded).length;

            return (
              <Card key={label}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {label}
                      <Badge variant="secondary" className="text-xs font-normal">
                        {group.accountType === "credit_card" ? "Credit Card" : capitalize(group.accountType)}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {groupIncome > 0 && <span className="text-emerald-600">+{formatCurrency(groupIncome)}</span>}
                      <span className="text-red-600">-{formatCurrency(groupExpenses)}</span>
                      {excludedCount > 0 && <span>({excludedCount} excluded)</span>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[110px] text-right">Amount</TableHead>
                          <TableHead className="w-[160px]">Category</TableHead>
                          <TableHead className="w-[70px] text-center">Exclude</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.transactions.map(({ tx: t, globalIndex: gi }) => (
                          <TableRow
                            key={gi}
                            className={t.excluded ? "opacity-50" : undefined}
                          >
                            <TableCell className="text-xs">
                              <span className={t.excluded ? "line-through" : ""}>
                                {fmtDate(t.date)}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-sm max-w-[240px] truncate"
                              title={t.description}
                            >
                              <span className={t.excluded ? "line-through" : ""}>
                                {t.description.length > 40
                                  ? t.description.slice(0, 40) + "..."
                                  : t.description}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              <span
                                className={
                                  t.excluded
                                    ? "line-through text-muted-foreground"
                                    : t.isIncome
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }
                              >
                                {t.isIncome ? "+" : "-"}
                                {formatCurrency(t.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {!t.isIncome && (
                                <Select
                                  value={t.category}
                                  onValueChange={(v: string | null) => {
                                    if (v) updateTransaction(gi, { category: v });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {capitalize(c)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {t.isIncome && (
                                <Select
                                  value={t.category || "income"}
                                  onValueChange={(v: string | null) => {
                                    if (v) updateTransaction(gi, { category: v });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue>{capitalize(t.category === "other" ? "income" : t.category || "income")}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="transfers">Transfer</SelectItem>
                                    <SelectItem value="refund">Refund</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={t.excluded ?? false}
                                onChange={(e) =>
                                  updateTransaction(gi, {
                                    excluded: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-border"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          });
        })()}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button onClick={confirmAndGrade}>
            Confirm &amp; Grade
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Grade step
  // ---------------------------------------------------------------------------

  function renderGrade() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Analyzing your spending...
          </p>
        </div>
      );
    }

    if (!grades) return null;

    const totalBudgeted = Object.values(budget).reduce((s, v) => s + v, 0);
    const totalActual = totalExpenses;
    const totalDiff = totalActual - totalBudgeted;

    return (
      <div className="space-y-6">
        {/* Overall grade */}
        <Card className="border-2">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Overall Grade</p>
            <div
              className={`inline-flex items-center justify-center h-20 w-20 rounded-full text-4xl font-bold border-2 ${gradeBg(
                grades.overallGrade
              )}`}
            >
              {grades.overallGrade}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Budgeted: </span>
                <span className="font-medium">
                  {formatCurrency(totalBudgeted)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Actual: </span>
                <span className="font-medium">
                  {formatCurrency(totalActual)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Diff: </span>
                <span
                  className={`font-medium ${
                    totalDiff > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {totalDiff > 0 ? "+" : ""}
                  {formatCurrency(totalDiff)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category grades */}
        <div className="grid gap-4 sm:grid-cols-2">
          {grades.categories?.map((cat) => {
            const budgeted = budget[cat.category] ?? 0;
            const actual = expensesByCategory[cat.category] ?? 0;
            const diff = actual - budgeted;
            const ratio = budgeted > 0 ? Math.min(actual / budgeted, 1.5) : 0;
            const pct = Math.round(ratio * 100);

            return (
              <Card key={cat.category}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {capitalize(cat.category)}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold border ${gradeBg(
                        cat.grade
                      )}`}
                    >
                      {cat.grade}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Budget: {formatCurrency(budgeted)}</span>
                    <span>Actual: {formatCurrency(actual)}</span>
                    <span
                      className={
                        diff > 0 ? "text-red-600" : "text-emerald-600"
                      }
                    >
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ratio > 1
                          ? "bg-red-500"
                          : ratio > 0.8
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {pct > 100 && (
                    <p className="text-xs text-red-600 mt-1">{pct}% of budget</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep("review")}>
            Back
          </Button>
          <Button onClick={getSuggestions}>
            <Sparkles className="h-4 w-4 mr-1" />
            Get AI Suggestions
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Suggestions step
  // ---------------------------------------------------------------------------

  function renderSuggestions() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Generating personalized suggestions...
          </p>
        </div>
      );
    }

    if (saved) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle className="h-12 w-12 text-emerald-600" />
          <p className="text-lg font-medium">Check-in Saved!</p>
          <p className="text-sm text-muted-foreground">
            Your {MONTH_NAMES[selectedMonth - 1]} {selectedYear} check-in has
            been recorded.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setStep("upload");
              setFiles([]);
              setTransactions([]);
              setGrades(null);
              setSuggestions(null);
              setSaved(false);
            }}
          >
            Start New Check-in
          </Button>
        </div>
      );
    }

    if (!suggestions) return null;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{suggestions.summary}</p>
            </div>
          </CardContent>
        </Card>

        {/* Category insights */}
        <div className="grid gap-4 sm:grid-cols-2">
          {suggestions.categoryInsights.map((ci) => (
            <Card key={ci.category}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">
                    {capitalize(ci.category)}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold border ${gradeBg(
                      ci.grade
                    )}`}
                  >
                    {ci.grade}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {ci.insight}
                </p>
                <p className="text-xs font-medium text-primary">
                  {ci.suggestion}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Top actions */}
        {suggestions.topActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="space-y-2">
                {suggestions.topActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{action}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep("grade")}>
            Back
          </Button>
          <Button onClick={saveCheckin} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Check-in
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: History
  // ---------------------------------------------------------------------------

  function renderHistory() {
    if (pastCheckins.length === 0) return null;

    return (
      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="text-base">Past Check-ins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {pastCheckins.map((ci) => {
              const isExpanded = expandedCheckin === ci.id;
              let parsedExpenses: Record<string, number> = {};
              let parsedGrades: CheckinGrade | null = null;
              try {
                let exp = JSON.parse(ci.expensesByCategory);
                if (typeof exp === "string") exp = JSON.parse(exp);
                parsedExpenses = exp;
              } catch {}
              try {
                let gd = JSON.parse(ci.gradeDetails);
                if (typeof gd === "string") gd = JSON.parse(gd);
                parsedGrades = gd;
              } catch {}

              return (
                <div key={ci.id}>
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedCheckin(isExpanded ? null : ci.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {MONTH_NAMES[ci.month - 1]} {ci.year}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold border ${gradeBg(
                          ci.overallGrade
                        )}`}
                      >
                        {ci.overallGrade}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(ci.totalExpenses)} spent
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(ci.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Delete check-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCheckin(ci.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Income: </span>
                          <span className="font-medium text-emerald-600">
                            {formatCurrency(ci.totalIncome)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Expenses:{" "}
                          </span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(ci.totalExpenses)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net: </span>
                          <span
                            className={`font-medium ${
                              ci.totalIncome - ci.totalExpenses >= 0
                                ? "text-blue-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(
                              ci.totalIncome - ci.totalExpenses
                            )}
                          </span>
                        </div>
                      </div>
                      {Object.keys(parsedExpenses).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(parsedExpenses).map(([cat, amt]) => (
                            <div
                              key={cat}
                              className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
                            >
                              <span className="text-muted-foreground">
                                {capitalize(cat)}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(amt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {parsedGrades?.categories && (
                        <div className="flex flex-wrap gap-2">
                          {parsedGrades.categories.map((c) => (
                            <Badge
                              key={c.category}
                              variant="outline"
                              className={gradeBg(c.grade)}
                            >
                              {capitalize(c.category)}: {c.grade}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const filteredTxViewer = txViewerData.filter((t) => {
    if (txFilterCategory !== "all" && t.category !== txFilterCategory) return false;
    if (txFilterSearch && !t.description.toLowerCase().includes(txFilterSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with View Transactions button */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button variant="outline" size="sm" onClick={openTransactionViewer}>
          <ReceiptText className="h-3.5 w-3.5 mr-1.5" />
          View Transactions
        </Button>
      </div>

      {renderStepIndicator()}

      {step === "upload" && renderUpload()}
      {step === "review" && renderReview()}
      {step === "grade" && renderGrade()}
      {step === "suggestions" && renderSuggestions()}

      {renderHistory()}

      {/* Transaction Viewer Dialog */}
      <Dialog open={txViewerOpen} onOpenChange={setTxViewerOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Recent Transactions (last 90 days)</DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex gap-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={txFilterSearch}
                onChange={(e) => setTxFilterSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={txFilterCategory} onValueChange={(v: string | null) => { if (v) setTxFilterCategory(v); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction list */}
          <div className="overflow-y-auto flex-1">
            {txViewerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTxViewer.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                {txViewerData.length === 0 ? "No transactions in the last 90 days." : "No transactions match your filters."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px] text-right">Amount</TableHead>
                    <TableHead className="w-[150px]">Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTxViewer.slice(0, 500).map((t) => (
                    <TableRow key={t.id} className={t.excluded ? "opacity-40" : ""}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell className={`text-sm text-right font-medium ${t.isIncome ? "text-emerald-600" : ""}`}>
                        {t.isIncome ? "+" : "-"}{formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.category}
                          onValueChange={(v: string | null) => {
                            if (v) updateTransactionCategory(t.id, v);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Showing {Math.min(filteredTxViewer.length, 500)} of {filteredTxViewer.length} transactions
            {txFilterCategory !== "all" || txFilterSearch ? ` (filtered from ${txViewerData.length} total)` : ""}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
