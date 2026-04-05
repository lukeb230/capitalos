"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const formatCurrency = (v: number) => `$${(v / 1000).toFixed(0)}k`;

interface Props {
  baselineData: { label: string; netWorth: number }[];
  scenarioData: { label: string; netWorth: number }[];
  scenarioName: string;
}

export function ComparisonChart({ baselineData, scenarioData, scenarioName }: Props) {
  if (baselineData.length === 0 && scenarioData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
        No data available for comparison
      </div>
    );
  }

  const maxLen = Math.max(baselineData.length, scenarioData.length);
  const merged = Array.from({ length: maxLen }, (_, i) => ({
    label: baselineData[i]?.label ?? scenarioData[i]?.label ?? `M${i}`,
    baseline: baselineData[i]?.netWorth ?? null,
    scenario: scenarioData[i]?.netWorth ?? null,
  }));

  return (
    <div style={{ width: "100%", height: 350 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={merged} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
        <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#6b7280" strokeWidth={2} dot={false} connectNulls={false} />
        <Line type="monotone" dataKey="scenario" name={scenarioName} stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
