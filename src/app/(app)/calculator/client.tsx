"use client";

import { useState } from "react";
import {
  Calculator,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface CalculatorClientProps {
  monthlyIncome: number;
  cashFlow: number;
  netWorth: number;
  monthlyExpenses: number;
  monthlyDebtPayments: number;
  goalCount: number;
}

interface CalculationResult {
  verdict: "YES" | "TIGHT" | "NO";
  newCashFlow: number;
  cashFlowImpact: number;
  monthsToSave: number | null;
  totalCostWithInterest: number | null;
  monthsToPayoff: number | null;
  newSavingsRate: number;
  oldSavingsRate: number;
  goalDelayMonths: number | null;
  netWorthImpact: number;
}

const PRESETS = [
  { label: "$30K Car", name: "New Car", cost: 30000, payment: 550, rate: 6.5 },
  { label: "$300K House", name: "House Down Payment", cost: 300000, payment: 2200, rate: 7.0 },
  { label: "$1,200 Laptop", name: "Laptop", cost: 1200, payment: 0, rate: 0 },
  { label: "$50/mo Gym", name: "Gym Membership", cost: 600, payment: 50, rate: 0 },
  { label: "$200/mo Car Insurance", name: "Car Insurance", cost: 2400, payment: 200, rate: 0 },
];

export function CalculatorClient({
  monthlyIncome,
  cashFlow,
  netWorth,
  monthlyExpenses,
  monthlyDebtPayments,
  goalCount,
}: CalculatorClientProps) {
  const [itemName, setItemName] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [mode, setMode] = useState<"full" | "finance">("full");
  const [result, setResult] = useState<CalculationResult | null>(null);

  const oldSavingsRate =
    monthlyIncome > 0
      ? Math.round((Math.max(0, cashFlow) / monthlyIncome) * 1000) / 10
      : 0;

  function calculate() {
    const cost = parseFloat(totalCost) || 0;
    const payment = parseFloat(monthlyPayment) || 0;
    const rate = parseFloat(interestRate) || 0;

    if (cost <= 0 && payment <= 0) return;

    if (mode === "full") {
      // Pay in full -- impact is on net worth, not monthly cash flow
      const monthsToSave = cashFlow > 0 ? Math.ceil(cost / cashFlow) : Infinity;
      const newCashFlow = cashFlow; // no ongoing monthly impact
      const savingsRate = oldSavingsRate; // unchanged monthly

      setResult({
        verdict: cashFlow > 0 && monthsToSave <= 3 ? "YES" : cashFlow > 0 && monthsToSave <= 12 ? "TIGHT" : "NO",
        newCashFlow,
        cashFlowImpact: 0,
        monthsToSave: monthsToSave === Infinity ? null : monthsToSave,
        totalCostWithInterest: null,
        monthsToPayoff: null,
        newSavingsRate: savingsRate,
        oldSavingsRate,
        goalDelayMonths: cashFlow > 0 ? Math.ceil(cost / cashFlow) : null,
        netWorthImpact: -cost,
      });
    } else {
      // Finance it
      const monthlyRate = rate / 100 / 12;
      let monthsToPayoff: number;
      let totalCostWithInterest: number;

      if (payment <= 0) return;

      if (rate > 0 && monthlyRate > 0) {
        // Standard amortization: n = -ln(1 - (PV * r / PMT)) / ln(1 + r)
        const x = 1 - (cost * monthlyRate) / payment;
        if (x <= 0) {
          // Payment doesn't cover interest
          monthsToPayoff = Infinity;
          totalCostWithInterest = Infinity;
        } else {
          monthsToPayoff = Math.ceil(-Math.log(x) / Math.log(1 + monthlyRate));
          totalCostWithInterest = payment * monthsToPayoff;
        }
      } else {
        // No interest
        monthsToPayoff = Math.ceil(cost / payment);
        totalCostWithInterest = cost;
      }

      const newCashFlow = cashFlow - payment;
      const newSavingsRate =
        monthlyIncome > 0
          ? Math.round((Math.max(0, newCashFlow) / monthlyIncome) * 1000) / 10
          : 0;

      let verdict: "YES" | "TIGHT" | "NO";
      if (newCashFlow > cashFlow * 0.3) {
        verdict = "YES";
      } else if (newCashFlow > 0) {
        verdict = "TIGHT";
      } else {
        verdict = "NO";
      }

      // Goal delay: rough estimate based on reduced surplus
      let goalDelayMonths: number | null = null;
      if (goalCount > 0 && cashFlow > 0 && newCashFlow > 0) {
        // If surplus shrinks, goals take proportionally longer
        const ratio = cashFlow / newCashFlow;
        // Average delay per goal in months (assume 12-month average timeline)
        goalDelayMonths = Math.round((ratio - 1) * 12);
        if (goalDelayMonths <= 0) goalDelayMonths = null;
      } else if (goalCount > 0 && newCashFlow <= 0) {
        goalDelayMonths = Infinity;
      }

      setResult({
        verdict,
        newCashFlow,
        cashFlowImpact: -payment,
        monthsToSave: null,
        totalCostWithInterest: totalCostWithInterest === Infinity ? null : totalCostWithInterest,
        monthsToPayoff: monthsToPayoff === Infinity ? null : monthsToPayoff,
        newSavingsRate,
        oldSavingsRate,
        goalDelayMonths,
        netWorthImpact: -(totalCostWithInterest === Infinity ? cost : totalCostWithInterest),
      });
    }
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setItemName(preset.name);
    setTotalCost(preset.cost.toString());
    if (preset.payment > 0) {
      setMode("finance");
      setMonthlyPayment(preset.payment.toString());
      setInterestRate(preset.rate.toString());
    } else {
      setMode("full");
      setMonthlyPayment("");
      setInterestRate("");
    }
    setResult(null);
  }

  function reset() {
    setItemName("");
    setTotalCost("");
    setMonthlyPayment("");
    setInterestRate("");
    setResult(null);
  }

  const verdictConfig = {
    YES: { color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle, label: "Yes, you can afford this!" },
    TIGHT: { color: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertTriangle, label: "It's tight -- proceed with caution" },
    NO: { color: "bg-red-100 text-red-800 border-red-300", icon: TrendingDown, label: "No, this would strain your finances" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Can I Afford This?
          </h1>
          <p className="text-muted-foreground mt-1">
            See how a purchase would impact your finances before you commit.
          </p>
        </div>
      </div>

      {/* Current Financial Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Monthly Income</p>
            <p className="text-lg font-semibold">{formatCurrency(monthlyIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Monthly Cash Flow</p>
            <p className={`text-lg font-semibold ${cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(cashFlow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className="text-lg font-semibold">{formatCurrency(netWorth)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Savings Rate</p>
            <p className="text-lg font-semibold">{oldSavingsRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Quick Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">What do you want to buy?</Label>
              <Input
                id="item-name"
                placeholder="e.g. New Car, Laptop, Gym Membership"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-cost">Total Cost ($)</Label>
              <Input
                id="total-cost"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "full" ? "default" : "outline"}
              size="sm"
              onClick={() => { setMode("full"); setResult(null); }}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Pay in Full
            </Button>
            <Button
              variant={mode === "finance" ? "default" : "outline"}
              size="sm"
              onClick={() => { setMode("finance"); setResult(null); }}
            >
              <Clock className="h-4 w-4 mr-1" />
              Finance It
            </Button>
          </div>

          {mode === "finance" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly-payment">Monthly Payment (if financed) ($)</Label>
                <Input
                  id="monthly-payment"
                  type="number"
                  min="0"
                  step="10"
                  placeholder="0"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interest-rate">Interest Rate (if financed) (%)</Label>
                <Input
                  id="interest-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={calculate} className="flex-1">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate
            </Button>
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Verdict Banner */}
          <Card className={`border-2 ${verdictConfig[result.verdict].color}`}>
            <CardContent className="py-5 px-6 flex items-center gap-3">
              {(() => {
                const Icon = verdictConfig[result.verdict].icon;
                return <Icon className="h-8 w-8 flex-shrink-0" />;
              })()}
              <div>
                <p className="text-xl font-bold">{verdictConfig[result.verdict].label}</p>
                <p className="text-sm mt-0.5">
                  {itemName ? `"${itemName}" for ${formatCurrency(parseFloat(totalCost) || 0)}` : `${formatCurrency(parseFloat(totalCost) || 0)} purchase`}
                  {mode === "finance" ? " (financed)" : " (pay in full)"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cash Flow Impact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  {result.cashFlowImpact < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  Monthly Cash Flow After
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${result.newCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(result.newCashFlow)}
                </p>
                {result.cashFlowImpact !== 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {formatCurrency(result.cashFlowImpact)}/mo impact
                  </p>
                )}
                {result.cashFlowImpact === 0 && mode === "full" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No ongoing monthly impact
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Savings Rate Impact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Savings Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{result.newSavingsRate}%</p>
                  {result.newSavingsRate !== result.oldSavingsRate && (
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      was {result.oldSavingsRate}%
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.newSavingsRate >= 20
                    ? "Healthy savings rate maintained"
                    : result.newSavingsRate >= 10
                      ? "Below recommended 20% target"
                      : "Critically low savings rate"}
                </p>
              </CardContent>
            </Card>

            {/* Net Worth Impact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Net Worth Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(result.netWorthImpact)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  New net worth: {formatCurrency(netWorth + result.netWorthImpact)}
                </p>
              </CardContent>
            </Card>

            {/* Mode-specific cards */}
            {mode === "full" && result.monthsToSave !== null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Time to Save
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {result.monthsToSave >= 12
                      ? `${Math.floor(result.monthsToSave / 12)}yr ${result.monthsToSave % 12}mo`
                      : `${result.monthsToSave} month${result.monthsToSave !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Saving {formatCurrency(cashFlow)}/mo from cash flow
                  </p>
                </CardContent>
              </Card>
            )}

            {mode === "finance" && result.monthsToPayoff !== null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Payoff Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {result.monthsToPayoff >= 12
                      ? `${Math.floor(result.monthsToPayoff / 12)}yr ${result.monthsToPayoff % 12}mo`
                      : `${result.monthsToPayoff} month${result.monthsToPayoff !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    at {formatCurrency(parseFloat(monthlyPayment) || 0)}/mo
                  </p>
                </CardContent>
              </Card>
            )}

            {mode === "finance" && result.totalCostWithInterest !== null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Total Cost with Interest
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(result.totalCostWithInterest)}
                  </p>
                  {result.totalCostWithInterest > (parseFloat(totalCost) || 0) && (
                    <p className="text-sm text-red-500 mt-1">
                      {formatCurrency(result.totalCostWithInterest - (parseFloat(totalCost) || 0))} in interest
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Goal Delay */}
            {goalCount > 0 && result.goalDelayMonths !== null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Goal Delay Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">
                    {result.goalDelayMonths === Infinity
                      ? "Goals stalled"
                      : `~${result.goalDelayMonths} month${result.goalDelayMonths !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.goalDelayMonths === Infinity
                      ? "No surplus left to fund goals"
                      : result.cashFlowImpact === 0
                      ? "Savings diverted to this purchase"
                      : `Ongoing reduced surplus across ${goalCount} goal${goalCount !== 1 ? "s" : ""}`}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
