"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const formatCurrency = (v: number) => `$${(v / 1000).toFixed(0)}k`;

interface DataPoint {
  label: string;
  netWorth: number;
}

export function NetWorthHistoryChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        Complete at least 2 monthly check-ins to see your net worth history
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tickFormatter={formatCurrency} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            formatter={(v) => [`$${Number(v).toLocaleString()}`]}
            contentStyle={{
              backgroundColor: "hsl(var(--card) / 1)",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              opacity: 1,
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
