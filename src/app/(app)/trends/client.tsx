"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface CheckinData {
  id: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  overallGrade: string;
  expensesByCategory: Record<string, number>;
  gradeDetails: Record<string, { budgeted: number; actual: number; grade: string }>;
}

interface Props {
  checkins: CheckinData[];
}

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month]} '${String(year).slice(2)}`;
}

function gradeBg(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-emerald-100 text-emerald-700";
    case "B":
      return "bg-blue-100 text-blue-700";
    case "C":
      return "bg-amber-100 text-amber-700";
    case "D":
      return "bg-orange-100 text-orange-700";
    case "F":
      return "bg-red-100 text-red-700";
    default:
      return "bg-muted";
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  housing: "#3b82f6",
  transport: "#f59e0b",
  food: "#22c55e",
  utilities: "#8b5cf6",
  subscriptions: "#ec4899",
  entertainment: "#f97316",
  insurance: "#14b8a6",
  shopping: "#6366f1",
  health: "#06b6d4",
  personal: "#a855f7",
  education: "#84cc16",
  pets: "#f43f5e",
  transfers: "#94a3b8",
  other: "#6b7280",
};

export function TrendsClient({ checkins, budget }: Props & { budget: Record<string, number> }) {
  const sorted = [...checkins].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  );

  // Hooks must be called before any conditional returns
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(Math.max(0, sorted.length - 1));
  const selectedCheckin = sorted[selectedMonthIdx] ?? null;

  if (sorted.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spending Trends</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your spending patterns over time
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No monthly check-ins yet. Complete your first check-in to start
              tracking trends.
            </p>
            <Link
              href="/checkin"
              className="inline-block mt-4 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Go to Check-in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Summary calculations
  const totalMonths = sorted.length;
  const avgSpending =
    sorted.reduce((sum, c) => sum + c.totalExpenses, 0) / totalMonths;

  const bestMonth = sorted.reduce((best, c) =>
    c.totalExpenses < best.totalExpenses ? c : best
  );
  const worstMonth = sorted.reduce((worst, c) =>
    c.totalExpenses > worst.totalExpenses ? c : worst
  );

  // Line chart data
  const lineData = sorted.map((c) => ({
    label: monthLabel(c.month, c.year),
    totalExpenses: c.totalExpenses,
    totalIncome: c.totalIncome,
  }));

  // Gather all categories across all months
  const allCategories = new Set<string>();
  sorted.forEach((c) => {
    Object.keys(c.expensesByCategory).forEach((cat) => allCategories.add(cat));
  });
  const categories = Array.from(allCategories);

  // Stacked bar chart data
  const barData = sorted.map((c) => {
    const entry: Record<string, string | number> = {
      label: monthLabel(c.month, c.year),
    };
    categories.forEach((cat) => {
      entry[cat] = c.expensesByCategory[cat] ?? 0;
    });
    return entry;
  });

  // Month-over-month changes
  const changes = sorted.slice(1).map((c, i) => {
    const prev = sorted[i];
    const changeDollar = c.totalExpenses - prev.totalExpenses;
    const changePercent =
      prev.totalExpenses !== 0
        ? (changeDollar / prev.totalExpenses) * 100
        : 0;
    return {
      label: monthLabel(c.month, c.year),
      totalExpenses: c.totalExpenses,
      changeDollar,
      changePercent,
      increased: changeDollar > 0,
    };
  });

  // Category comparison (last 2 months)
  const lastTwo = sorted.slice(-2);
  const showComparison = lastTwo.length === 2;
  let comparisonRows: {
    category: string;
    prev: number;
    curr: number;
    changeDollar: number;
    changePercent: number;
  }[] = [];

  if (showComparison) {
    const [prevMonth, currMonth] = lastTwo;
    const compCategories = new Set<string>([
      ...Object.keys(prevMonth.expensesByCategory),
      ...Object.keys(currMonth.expensesByCategory),
    ]);
    comparisonRows = Array.from(compCategories).map((cat) => {
      const prev = prevMonth.expensesByCategory[cat] ?? 0;
      const curr = currMonth.expensesByCategory[cat] ?? 0;
      const changeDollar = curr - prev;
      const changePercent = prev !== 0 ? (changeDollar / prev) * 100 : 0;
      return { category: cat, prev, curr, changeDollar, changePercent };
    });
    comparisonRows.sort((a, b) => a.category.localeCompare(b.category));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Spending Trends</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your spending patterns over time
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Months Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMonths}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(avgSpending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Best Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {monthLabel(bestMonth.month, bestMonth.year)}
            </p>
            <Badge className={`mt-1 ${gradeBg(bestMonth.overallGrade)}`}>
              {bestMonth.overallGrade}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Worst Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {monthLabel(worstMonth.month, worstMonth.year)}
            </p>
            <Badge className={`mt-1 ${gradeBg(worstMonth.overallGrade)}`}>
              {worstMonth.overallGrade}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Total Spending Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Total Spending Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v) => [formatCurrency(Number(v))]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalIncome"
                stroke="#22c55e"
                name="Income"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="totalExpenses"
                stroke="#ef4444"
                name="Expenses"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Spending Breakdown — Cycle Between Months */}
      {selectedCheckin && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Actual Spending */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Actual Spending</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonthIdx((i) => Math.max(0, i - 1))} disabled={selectedMonthIdx === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[70px] text-center">
                    {monthLabel(selectedCheckin.month, selectedCheckin.year)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonthIdx((i) => Math.min(sorted.length - 1, i + 1))} disabled={selectedMonthIdx === sorted.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(selectedCheckin.totalExpenses)} total
                {selectedCheckin.overallGrade && (
                  <Badge className={`ml-2 text-[10px] ${gradeBg(selectedCheckin.overallGrade)}`}>
                    {selectedCheckin.overallGrade}
                  </Badge>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(selectedCheckin.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const pct = selectedCheckin.totalExpenses > 0
                    ? (amount / selectedCheckin.totalExpenses) * 100
                    : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] || "#6b7280" }} />
                          <span className="text-sm capitalize">{category}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-medium w-20 text-right">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: CATEGORY_COLORS[category] || "#6b7280" }} />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(selectedCheckin.expensesByCategory).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No spending data</p>
              )}
            </CardContent>
          </Card>

          {/* Budget Target */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget Target</CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(Object.values(budget).reduce((s, v) => s + v, 0))} budgeted/mo
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(budget)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const totalBudget = Object.values(budget).reduce((s, v) => s + v, 0);
                  const pct = totalBudget > 0 ? (amount / totalBudget) * 100 : 0;
                  const actual = selectedCheckin.expensesByCategory[category] || 0;
                  const diff = actual - amount;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] || "#6b7280" }} />
                          <span className="text-sm capitalize">{category}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {actual > 0 && (
                            <span className={`text-xs font-medium ${diff > 0 ? "text-red-500" : "text-emerald-600"}`}>
                              {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                            </span>
                          )}
                          <span className="text-sm font-medium w-20 text-right">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden relative">
                        <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                        {actual > 0 && (
                          <div
                            className="absolute top-0 h-full rounded-full opacity-60"
                            style={{
                              width: `${Math.min(100, (actual / (Object.values(budget).reduce((s, v) => s + v, 0) || 1)) * 100)}%`,
                              backgroundColor: diff > 0 ? "#ef4444" : "#22c55e",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              {Object.keys(budget).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No budget set. Add expenses to define your budget.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Month-over-Month Change Table */}
      {changes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Month-over-Month Change</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Spending</TableHead>
                  <TableHead className="text-right">Change ($)</TableHead>
                  <TableHead className="text-right">Change (%)</TableHead>
                  <TableHead className="text-center">Direction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.totalExpenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        row.increased ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {row.changeDollar >= 0 ? "+" : ""}
                      {formatCurrency(row.changeDollar)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        row.increased ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {row.changePercent >= 0 ? "+" : ""}
                      {row.changePercent.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {row.increased ? (
                        <ArrowUpRight className="inline h-5 w-5 text-red-600" />
                      ) : (
                        <ArrowDownRight className="inline h-5 w-5 text-green-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown Comparison */}
      {showComparison && (
        <Card>
          <CardHeader>
            <CardTitle>
              Category Breakdown: {monthLabel(lastTwo[0].month, lastTwo[0].year)}{" "}
              vs {monthLabel(lastTwo[1].month, lastTwo[1].year)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">
                    {monthLabel(lastTwo[0].month, lastTwo[0].year)}
                  </TableHead>
                  <TableHead className="text-right">
                    {monthLabel(lastTwo[1].month, lastTwo[1].year)}
                  </TableHead>
                  <TableHead className="text-right">Change ($)</TableHead>
                  <TableHead className="text-right">Change (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => {
                  const increased = row.changeDollar > 0;
                  const changed = row.changeDollar !== 0;
                  return (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium capitalize">
                        {row.category}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.prev)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.curr)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          changed
                            ? increased
                              ? "text-red-600"
                              : "text-green-600"
                            : ""
                        }`}
                      >
                        {row.changeDollar >= 0 ? "+" : ""}
                        {formatCurrency(row.changeDollar)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          changed
                            ? increased
                              ? "text-red-600"
                              : "text-green-600"
                            : ""
                        }`}
                      >
                        {row.prev === 0 && row.curr > 0
                          ? "New"
                          : `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Grade History */}
      <Card>
        <CardHeader>
          <CardTitle>Grade History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {sorted.map((c) => (
              <div key={c.id} className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {monthLabel(c.month, c.year)}
                </p>
                <Badge className={`text-sm px-3 py-1 ${gradeBg(c.overallGrade)}`}>
                  {c.overallGrade}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
