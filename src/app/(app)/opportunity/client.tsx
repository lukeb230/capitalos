"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Clock,
  Coffee,
  Car,
  ShoppingBag,
  Utensils,
  CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface ExpenseItem {
  name: string;
  amount: number;
  category: string;
}

interface OpportunityClientProps {
  cashFlow: number;
  expenses: ExpenseItem[];
}

function calculateFutureValue(
  monthlyAmount: number,
  years: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return monthlyAmount * months;
  return monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function generateGrowthData(
  monthlyAmount: number,
  years: number,
  annualRate: number
) {
  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = years * 12;
  const data: { month: number; value: number; contributed: number }[] = [];

  // Sample at reasonable intervals to keep the chart performant
  const step = Math.max(1, Math.floor(totalMonths / 120));

  for (let m = 0; m <= totalMonths; m += step) {
    const value =
      monthlyRate === 0
        ? monthlyAmount * m
        : monthlyAmount * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate);
    data.push({
      month: m,
      value: Math.round(value),
      contributed: monthlyAmount * m,
    });
  }

  // Ensure we include the final month
  if (data[data.length - 1]?.month !== totalMonths) {
    const value =
      monthlyRate === 0
        ? monthlyAmount * totalMonths
        : monthlyAmount *
          ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
    data.push({
      month: totalMonths,
      value: Math.round(value),
      contributed: monthlyAmount * totalMonths,
    });
  }

  return data;
}

const PRESETS = [
  { label: "$5/day Coffee", amount: 150, icon: Coffee },
  { label: "$100/mo Subscriptions", amount: 100, icon: CreditCard },
  { label: "$300/mo Dining Out", amount: 300, icon: Utensils },
  { label: "$500/mo Car Payment", amount: 500, icon: Car },
  { label: "$200/mo Shopping", amount: 200, icon: ShoppingBag },
];

export function OpportunityClient({ cashFlow, expenses }: OpportunityClientProps) {
  const [monthlyAmount, setMonthlyAmount] = useState(150);
  const [years, setYears] = useState(30);
  const [annualRate, setAnnualRate] = useState(8);

  const futureValue = useMemo(
    () => calculateFutureValue(monthlyAmount, years, annualRate),
    [monthlyAmount, years, annualRate]
  );

  const totalContributed = monthlyAmount * years * 12;
  const growthAmount = futureValue - totalContributed;

  const chartData = useMemo(
    () => generateGrowthData(monthlyAmount, years, annualRate),
    [monthlyAmount, years, annualRate]
  );

  // Expense opportunity cost analysis
  const expenseAnalysis = useMemo(() => {
    return expenses
      .map((e) => ({
        name: e.name,
        category: e.category,
        monthly: e.amount,
        cost10yr: calculateFutureValue(e.amount, 10, annualRate),
        cost20yr: calculateFutureValue(e.amount, 20, annualRate),
        cost30yr: calculateFutureValue(e.amount, 30, annualRate),
      }))
      .sort((a, b) => b.cost30yr - a.cost30yr);
  }, [expenses, annualRate]);

  const totals = useMemo(() => {
    return {
      monthly: expenseAnalysis.reduce((s, e) => s + e.monthly, 0),
      cost10yr: expenseAnalysis.reduce((s, e) => s + e.cost10yr, 0),
      cost20yr: expenseAnalysis.reduce((s, e) => s + e.cost20yr, 0),
      cost30yr: expenseAnalysis.reduce((s, e) => s + e.cost30yr, 0),
    };
  }, [expenseAnalysis]);

  function getCostBadge(cost30yr: number) {
    if (cost30yr >= 100_000) {
      return <Badge variant="destructive">{formatCurrency(cost30yr)}</Badge>;
    }
    if (cost30yr >= 50_000) {
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
          {formatCurrency(cost30yr)}
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500 text-white hover:bg-green-600">
        {formatCurrency(cost30yr)}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Opportunity Cost Calculator
        </h1>
        <p className="text-muted-foreground mt-1">
          Every dollar you spend today could be worth much more tomorrow. See the
          true cost of your spending habits.
        </p>
      </div>

      {/* Preset Quick Buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <Button
              key={preset.label}
              variant={monthlyAmount === preset.amount ? "default" : "outline"}
              size="sm"
              onClick={() => setMonthlyAmount(preset.amount)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {preset.label}
            </Button>
          );
        })}
      </div>

      {/* Custom Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Custom Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="monthly-amount">Monthly Amount ($)</Label>
              <Input
                id="monthly-amount"
                type="number"
                min={0}
                value={monthlyAmount}
                onChange={(e) =>
                  setMonthlyAmount(Math.max(0, Number(e.target.value)))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-horizon">
                Time Horizon: {years} years
              </Label>
              <Input
                id="time-horizon"
                type="range"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual-return">Annual Return (%)</Label>
              <Input
                id="annual-return"
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={annualRate}
                onChange={(e) =>
                  setAnnualRate(Math.max(0, Number(e.target.value)))
                }
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-2">Based on historical stock market averages. Actual returns may vary.</p>

          {/* Big Result */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              If you invested{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(monthlyAmount)}/mo
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {years} years
              </span>{" "}
              at{" "}
              <span className="font-semibold text-foreground">
                {annualRate}% return
              </span>
              , you&apos;d have:
            </p>
            <p className="text-5xl font-extrabold tracking-tight text-primary">
              {formatCurrency(futureValue)}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatCurrency(totalContributed)} contributed
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {formatCurrency(growthAmount)} growth
              </span>
            </div>
          </div>

          {/* Growth Chart */}
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="contributedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--muted-foreground))"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--muted-foreground))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m) =>
                    m === 0 ? "Now" : `${Math.round(m / 12)}yr`
                  }
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `$${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `$${(v / 1_000).toFixed(0)}K`
                        : `$${v}`
                  }
                  className="text-xs"
                  width={60}
                />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString()}`]}
                  labelFormatter={(m) =>
                    `Year ${(Number(m) / 12).toFixed(1)}`
                  }
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                <Area
                  type="monotone"
                  dataKey="contributed"
                  stroke="hsl(var(--muted-foreground))"
                  fill="url(#contributedGradient)"
                  strokeWidth={2}
                  name="Contributed (Principal)"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="url(#growthGradient)"
                  strokeWidth={2}
                  name="Portfolio Value (Principal + Growth)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            <span className="font-medium">Contributed (Principal)</span> = total amount you would have invested · <span className="font-medium">Portfolio Value</span> = principal + compound investment growth
          </p>
        </CardContent>
      </Card>

      {/* Expense Opportunity Cost Analysis */}
      {expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Your Expenses: True Opportunity Cost
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              What each of your recurring expenses would be worth if invested at{" "}
              {annualRate}% annual return instead.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead className="text-right">Monthly Cost</TableHead>
                    <TableHead className="text-right">10yr Cost</TableHead>
                    <TableHead className="text-right">20yr Cost</TableHead>
                    <TableHead className="text-right">30yr Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseAnalysis.map((expense) => (
                    <TableRow key={expense.name}>
                      <TableCell className="font-medium">
                        {expense.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {expense.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(expense.monthly)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(expense.cost10yr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(expense.cost20yr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {getCostBadge(expense.cost30yr)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.monthly)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.cost10yr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.cost20yr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {getCostBadge(totals.cost30yr)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
