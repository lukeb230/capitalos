"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface WaterfallItem {
  name: string;
  amount: number;
  type: "income" | "expense" | "debt" | "surplus";
}

interface Props {
  items: WaterfallItem[];
}

export function WaterfallChart({ items }: Props) {
  // Build waterfall data using range bars [bottom, top]
  // This ensures bars align perfectly with the Y-axis
  let running = 0;
  const data = items.map((item) => {
    if (item.type === "income") {
      const bottom = running;
      running += item.amount;
      return {
        name: item.name,
        range: [bottom, running] as [number, number],
        amount: item.amount,
        fill: "#22c55e",
        type: item.type,
      };
    }

    if (item.type === "surplus") {
      return {
        name: item.name,
        range: [0, Math.max(0, running)] as [number, number],
        amount: running,
        fill: running >= 0 ? "#3b82f6" : "#ef4444",
        type: item.type,
      };
    }

    // Expenses and debts: bar drops from current running total
    const top = running;
    running += item.amount; // item.amount is negative
    return {
      name: item.name,
      range: [running, top] as [number, number], // [bottom, top]
      amount: item.amount,
      fill: item.type === "debt" ? "#f97316" : "#ef4444",
      type: item.type,
    };
  });

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="name"
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            formatter={(_value, _name, props) => {
              const p = props?.payload as { amount?: number; type?: string } | undefined;
              const amt = p?.amount ?? 0;
              if (p?.type === "surplus") return [`$${Math.abs(amt).toLocaleString()}`, "Remaining"];
              const prefix = amt >= 0 ? "+" : "";
              return [`${prefix}$${Math.abs(amt).toLocaleString()}`, p?.type ?? ""];
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="range" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
