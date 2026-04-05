"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Format currency for tooltip/axis
const formatCurrency = (v: number) => `$${(v / 1000).toFixed(0)}k`;

export function ProjectionChart({ data }: { data: { label: string; netWorth: number; totalAssetValue: number; totalDebtBalance: number }[] }) {
  return (
    <div style={{ width: "100%", height: 350 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tickFormatter={formatCurrency} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={['dataMin', 'dataMax']} />
        <Tooltip
          formatter={(v) => [`$${Number(v).toLocaleString()}`]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--foreground))",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
        />
        <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
        <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="totalAssetValue" name="Assets" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="totalDebtBalance" name="Debts" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
