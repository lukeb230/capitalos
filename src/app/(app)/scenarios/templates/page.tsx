"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Home,
  Car,
  Heart,
  Briefcase,
  Zap,
  CreditCard,
  TrendingUp,
  MapPin,
  Check,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateChange {
  type: "create_expense" | "create_debt" | "create_asset" | "create_income";
  label: string;
  data: Record<string, string | number | boolean>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  changes: TemplateChange[];
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const templates: Template[] = [
  {
    id: "buy-a-house",
    name: "Buy a House",
    description: "Model the full cost of homeownership vs renting",
    icon: Home,
    color: "text-blue-600 bg-blue-100",
    changes: [
      {
        type: "create_expense",
        label: "Mortgage payment ($2,000/mo)",
        data: { name: "Mortgage Payment", amount: 2000, category: "Housing", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Property tax ($400/mo)",
        data: { name: "Property Tax", amount: 400, category: "Housing", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Home insurance ($150/mo)",
        data: { name: "Home Insurance", amount: 150, category: "Insurance", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Home maintenance ($200/mo)",
        data: { name: "Home Maintenance", amount: 200, category: "Housing", isRecurring: true },
      },
      {
        type: "create_asset",
        label: "Property asset ($350,000 at 3% growth)",
        data: { name: "Home Property", currentValue: 350000, growthRate: 3, type: "PROPERTY" },
      },
    ],
  },
  {
    id: "buy-a-car",
    name: "Buy a Car",
    description: "Model total cost of vehicle ownership including depreciation",
    icon: Car,
    color: "text-green-600 bg-green-100",
    changes: [
      {
        type: "create_debt",
        label: "Car loan ($30,000 at 5.9%, $550/mo)",
        data: { name: "Car Loan", balance: 30000, interestRate: 5.9, minimumPayment: 550, type: "AUTO" },
      },
      {
        type: "create_expense",
        label: "Car insurance increase ($150/mo)",
        data: { name: "Car Insurance", amount: 150, category: "Insurance", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Gas expense ($200/mo)",
        data: { name: "Gas & Fuel", amount: 200, category: "Transportation", isRecurring: true },
      },
      {
        type: "create_asset",
        label: "Vehicle asset ($30,000 at -15% growth)",
        data: { name: "Vehicle", currentValue: 30000, growthRate: -15, type: "VEHICLE" },
      },
    ],
  },
  {
    id: "have-a-baby",
    name: "Have a Baby",
    description: "Model the financial impact of growing your family",
    icon: Heart,
    color: "text-pink-600 bg-pink-100",
    changes: [
      {
        type: "create_expense",
        label: "Childcare expense ($1,500/mo)",
        data: { name: "Childcare / Daycare", amount: 1500, category: "Childcare", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Health insurance increase ($300/mo)",
        data: { name: "Health Insurance Increase", amount: 300, category: "Insurance", isRecurring: true },
      },
      {
        type: "create_expense",
        label: "Baby supplies ($200/mo)",
        data: { name: "Baby Supplies", amount: 200, category: "Childcare", isRecurring: true },
      },
    ],
  },
  {
    id: "career-change",
    name: "Career Change",
    description: "Model switching jobs, taking a pay cut, or getting a raise",
    icon: Briefcase,
    color: "text-amber-600 bg-amber-100",
    changes: [
      {
        type: "create_income",
        label: "New salary income ($5,000/mo)",
        data: { name: "New Job Salary", amount: 5000, category: "Salary", isRecurring: true },
      },
    ],
  },
  {
    id: "start-a-business",
    name: "Start a Business",
    description: "Model leaving your job to start a business",
    icon: Zap,
    color: "text-purple-600 bg-purple-100",
    changes: [
      {
        type: "create_expense",
        label: "Startup costs ($10,000 one-time)",
        data: { name: "Startup Costs", amount: 10000, category: "Business", isRecurring: false },
      },
      {
        type: "create_income",
        label: "Business income ($2,000/mo, growing)",
        data: { name: "Business Revenue", amount: 2000, category: "Business", isRecurring: true },
      },
    ],
  },
  {
    id: "pay-off-debt",
    name: "Pay Off All Debt Aggressively",
    description: "See how fast you can become debt-free by maximizing payments",
    icon: CreditCard,
    color: "text-red-600 bg-red-100",
    changes: [
      {
        type: "create_expense",
        label: "Extra debt payments ($500/mo)",
        data: { name: "Extra Debt Payments", amount: 500, category: "Debt Payoff", isRecurring: true },
      },
    ],
  },
  {
    id: "maximize-retirement",
    name: "Maximize Retirement Savings",
    description: "Model maxing out retirement contributions",
    icon: TrendingUp,
    color: "text-emerald-600 bg-emerald-100",
    changes: [
      {
        type: "create_expense",
        label: "Max 401k/IRA contributions ($1,917/mo)",
        data: { name: "401k/IRA Contributions", amount: 1917, category: "Savings", isRecurring: true },
      },
      {
        type: "create_asset",
        label: "Retirement fund ($0 at 7% growth)",
        data: { name: "Retirement Fund", currentValue: 0, growthRate: 7, type: "INVESTMENT" },
      },
    ],
  },
  {
    id: "move-to-new-city",
    name: "Move to a New City",
    description: "Compare cost of living in a different city",
    icon: MapPin,
    color: "text-indigo-600 bg-indigo-100",
    changes: [
      {
        type: "create_expense",
        label: "New rent ($1,800/mo)",
        data: { name: "New City Rent", amount: 1800, category: "Housing", isRecurring: true },
      },
      {
        type: "create_income",
        label: "Adjusted salary ($6,000/mo)",
        data: { name: "Adjusted Salary", amount: 6000, category: "Salary", isRecurring: true },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const changeTypeLabels: Record<TemplateChange["type"], string> = {
  create_expense: "New Expense",
  create_debt: "New Debt",
  create_asset: "New Asset",
  create_income: "New Income",
};

const changeTypeBadgeColors: Record<TemplateChange["type"], string> = {
  create_expense: "bg-red-100 text-red-700",
  create_debt: "bg-orange-100 text-orange-700",
  create_asset: "bg-blue-100 text-blue-700",
  create_income: "bg-green-100 text-green-700",
};

function apiEndpoint(type: TemplateChange["type"]): string {
  switch (type) {
    case "create_expense":
      return "/api/expenses";
    case "create_debt":
      return "/api/debts";
    case "create_asset":
      return "/api/assets";
    case "create_income":
      return "/api/income";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScenarioTemplatesPage() {
  const router = useRouter();

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedChanges, setEditedChanges] = useState<TemplateChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // ---- open dialog & seed editable values ----
  function openTemplate(template: Template) {
    setSelectedTemplate(template);
    setEditedChanges(template.changes.map((c) => ({ ...c, data: { ...c.data } })));
    setApplied(false);
  }

  // ---- update a single field inside a change ----
  function updateChangeField(index: number, field: string, value: string | number) {
    setEditedChanges((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], data: { ...next[index].data, [field]: value } };
      return next;
    });
  }

  // ---- apply all changes ----
  async function applyTemplate() {
    if (!selectedTemplate) return;
    setApplying(true);

    try {
      for (const change of editedChanges) {
        const res = await fetch(apiEndpoint(change.type), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change.data),
        });
        if (!res.ok) throw new Error(`Failed to apply ${change.type} change`);
      }

      setApplied(true);
      setTimeout(() => {
        setSelectedTemplate(null);
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error("Failed to apply template", err);
    } finally {
      setApplying(false);
    }
  }

  // ---- render ----
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scenarios
        </Link>

        <h1 className="text-3xl font-bold tracking-tight">Scenario Templates</h1>
        <p className="text-muted-foreground">
          Pre-built financial models for major life decisions
        </p>
      </div>

      {/* Template grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className="group flex flex-col hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2.5 ${template.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight">
                      {template.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-4">
                {/* What it creates */}
                <ul className="space-y-1.5 text-sm flex-1">
                  {template.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${changeTypeBadgeColors[change.type]}`}
                      >
                        {changeTypeLabels[change.type]}
                      </Badge>
                      <span className="text-muted-foreground leading-tight">
                        {change.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                  variant="outline"
                  onClick={() => openTemplate(template)}
                >
                  Use Template
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ---- Customize & Apply Dialog ---- */}
      <Dialog
        open={!!selectedTemplate}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {(() => {
                    const Icon = selectedTemplate.icon;
                    return (
                      <div className={`rounded-lg p-2 ${selectedTemplate.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  {selectedTemplate.name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground pt-1">
                  Customize the values below, then apply to your profile.
                </p>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {editedChanges.map((change, i) => (
                  <div key={i} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${changeTypeBadgeColors[change.type]}`}
                      >
                        {changeTypeLabels[change.type]}
                      </Badge>
                      <span className="font-medium text-sm">
                        {change.data.name as string}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Render editable numeric fields */}
                      {Object.entries(change.data).map(([field, value]) => {
                        if (typeof value === "boolean" || field === "name" || field === "type" || field === "category") {
                          return null;
                        }

                        const isAmount = field === "amount" || field === "balance" || field === "currentValue" || field === "minimumPayment";
                        const isRate = field === "interestRate" || field === "growthRate";

                        return (
                          <div key={field} className="space-y-1.5">
                            <Label className="text-xs capitalize text-muted-foreground">
                              {field.replace(/([A-Z])/g, " $1").trim()}
                            </Label>
                            <div className="relative">
                              {isAmount && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                  $
                                </span>
                              )}
                              <Input
                                type="number"
                                value={value as number}
                                className={isAmount ? "pl-7" : ""}
                                onChange={(e) =>
                                  updateChangeField(i, field, parseFloat(e.target.value) || 0)
                                }
                              />
                              {isRate && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                  %
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
                <p className="font-medium">Summary</p>
                <p className="text-muted-foreground">
                  This will create{" "}
                  <span className="font-semibold text-foreground">
                    {editedChanges.length} new record{editedChanges.length !== 1 ? "s" : ""}
                  </span>{" "}
                  in your profile
                  {editedChanges.some((c) => c.data.amount || c.data.minimumPayment) && (
                    <>
                      {" "}totaling{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          editedChanges.reduce(
                            (sum, c) => sum + (typeof c.data.amount === "number" ? c.data.amount : 0) + (typeof c.data.minimumPayment === "number" ? c.data.minimumPayment : 0),
                            0
                          )
                        )}
                        /mo
                      </span>{" "}
                      in new monthly obligations
                    </>
                  )}
                  .
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={applying || applied}
                onClick={applyTemplate}
              >
                {applied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Applied! Redirecting...
                  </>
                ) : applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying Changes...
                  </>
                ) : (
                  "Apply Changes"
                )}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
