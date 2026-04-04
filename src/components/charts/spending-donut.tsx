"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SpendingCategory {
  name: string;
  amount: number;
  color: string;
}

interface Props {
  categories: SpendingCategory[];
  totalIncome: number;
  totalOutflow: number;
  surplus: number;
}

const COLORS: Record<string, string> = {
  Housing: "#3b82f6",
  Transport: "#f59e0b",
  Food: "#22c55e",
  Utilities: "#8b5cf6",
  Subscriptions: "#ec4899",
  Entertainment: "#f97316",
  Insurance: "#14b8a6",
  Other: "#6b7280",
  "Debt Payments": "#ef4444",
  Contributions: "#06b6d4",
  Surplus: "#10b981",
};

function getColor(name: string): string {
  return COLORS[name] || COLORS.Other;
}

export function SpendingDonut({ categories, totalIncome, totalOutflow, surplus }: Props) {
  // Outer ring: spending breakdown
  const outerData = [
    ...categories.map((c) => ({ ...c, color: c.color || getColor(c.name) })),
    ...(surplus > 0 ? [{ name: "Surplus", amount: surplus, color: COLORS.Surplus }] : []),
  ];

  // Inner ring: income vs outflow
  const innerData = [
    { name: "Spending", amount: totalOutflow, color: "#ef4444" },
    ...(surplus > 0 ? [{ name: "Surplus", amount: surplus, color: "#10b981" }] : []),
  ];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: "100%", height: 280 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Inner ring: income utilization */}
            <Pie
              data={innerData}
              dataKey="amount"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={72}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {innerData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>

            {/* Outer ring: category breakdown */}
            <Pie
              data={outerData}
              dataKey="amount"
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={110}
              strokeWidth={2}
              stroke="hsl(var(--background))"
              paddingAngle={1}
            >
              {outerData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-bold">{formatCurrency(totalOutflow)}</p>
          <p className="text-[10px] text-muted-foreground">of {formatCurrency(totalIncome)}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 mt-2 w-full max-w-md">
        {outerData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground truncate">{item.name}</span>
            <span className="text-xs font-medium ml-auto">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
