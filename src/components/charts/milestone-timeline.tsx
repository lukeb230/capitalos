"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const formatCurrency = (v: number) => `$${(v / 1000).toFixed(0)}k`;

interface GoalData {
  name: string;
  currentAmount: number;
  targetAmount: number;
  onTrack: boolean;
}

export function MilestoneTimeline({ goals }: { goals: GoalData[] }) {
  const data = goals.map((g) => ({
    name: g.name,
    current: g.currentAmount,
    remaining: Math.max(0, g.targetAmount - g.currentAmount),
    onTrack: g.onTrack,
  }));

  return (
    <div style={{ width: "100%", height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis dataKey="name" type="category" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={75} />
        <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`]} />
        <Bar dataKey="current" name="Current" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.onTrack ? "#22c55e" : "#f59e0b"} />
          ))}
        </Bar>
        <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
