"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: { type: string; value: number }[];
  total: number;
}

const TYPE_COLORS: Record<string, string> = {
  Savings: "#3b82f6",
  Investment: "#22c55e",
  Property: "#8b5cf6",
  Vehicle: "#f59e0b",
  Other: "#6b7280",
};

export function AssetDonut({ data, total }: Props) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: "100%", height: 220 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              dataKey="value"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--background))"
              paddingAngle={2}
            >
              {sorted.map((entry, i) => (
                <Cell key={i} fill={TYPE_COLORS[entry.type] || TYPE_COLORS.Other} />
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
          <p className="text-[10px] text-muted-foreground">Total Assets</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {sorted.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[item.type] || TYPE_COLORS.Other }} />
            <span className="text-xs text-muted-foreground">{item.type}</span>
            <span className="text-xs font-medium">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
