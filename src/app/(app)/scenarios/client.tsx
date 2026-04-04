"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  GitBranch,
  ArrowRight,
  Star,
  Copy,
  Home,
  Car,
  Briefcase,
  CreditCard,
  TrendingUp,
  LayoutGrid,
  BookTemplate,
} from "lucide-react";

interface ScenarioChange {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  isBaseline: boolean;
  changes: ScenarioChange[];
  createdAt: string;
}

const presets = [
  { name: "Change Rent", description: "What if rent goes up or down?", icon: Home },
  { name: "Add Side Income", description: "What if you pick up a part-time job?", icon: Briefcase },
  { name: "New Car Payment", description: "What if you buy or sell a car?", icon: Car },
  { name: "Aggressive Debt Payoff", description: "What if you double debt payments?", icon: CreditCard },
  { name: "Increase Investments", description: "What if you invest more monthly?", icon: TrendingUp },
];

export function ScenariosClient({ scenarios }: { scenarios: Scenario[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  async function handleCreate(name?: string, description?: string) {
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || form.name,
          description: description || form.description,
          isBaseline: false,
        }),
      });
      if (!res.ok) throw new Error("Failed to create scenario");
      setOpen(false);
      setForm({ name: "", description: "" });
      router.refresh();
    } catch {
      alert("Failed to create scenario. Please try again.");
    }
  }

  async function handleDuplicate(scenario: Scenario) {
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${scenario.name} (Copy)`,
          description: scenario.description,
          isBaseline: false,
          changes: scenario.changes.map((c) => ({
            entityType: c.entityType,
            entityId: c.entityId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to duplicate scenario");
      router.refresh();
    } catch {
      alert("Failed to duplicate scenario. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/scenarios?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete scenario");
      router.refresh();
    } catch {
      alert("Failed to delete scenario. Please try again.");
    }
  }

  const baseline = scenarios.find((s) => s.isBaseline);
  const others = scenarios.filter((s) => !s.isBaseline);

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scenario Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Model life decisions and see their financial impact instantly
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/scenarios/templates">
            <Button variant="outline" size="sm">
              <BookTemplate className="h-4 w-4 mr-1.5" /> Templates
            </Button>
          </Link>
          {others.length >= 2 && (
            <Link href="/scenarios/compare">
              <Button variant="outline" size="sm">
                <LayoutGrid className="h-4 w-4 mr-1.5" /> Compare
              </Button>
            </Link>
          )}
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Scenario
          </Button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Scenario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Move to a cheaper apartment"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What life decision are you modeling?"
                />
              </div>
              <Button className="w-full" onClick={() => handleCreate()} disabled={!form.name}>
                Create Scenario
              </Button>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-3">Or start from a template:</p>
                <div className="grid grid-cols-1 gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleCreate(p.name, p.description)}
                      className="flex items-center gap-3 p-2.5 rounded-lg border text-left hover:bg-accent transition-colors"
                    >
                      <p.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Baseline */}
      {baseline && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/80 to-white dark:from-blue-950/20 dark:to-card dark:border-blue-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">{baseline.name}</CardTitle>
                <Badge>Baseline</Badge>
              </div>
              <Link href={`/scenarios/${baseline.id}`}>
                <Button variant="outline" size="sm">
                  View <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {baseline.description || "Your current financial state — all scenarios compare against this."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scenario cards */}
      {others.length === 0 ? (
        <Card>
          <CardContent className="text-center text-muted-foreground py-12">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium mb-1">No scenarios yet</p>
            <p className="text-sm">Create your first scenario to start exploring what-if decisions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((s) => (
            <Card key={s.id} className="group hover:border-foreground/20 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDuplicate(s)}
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(s.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {s.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {s.changes.length} change{s.changes.length !== 1 ? "s" : ""}
                  </Badge>
                  <Link href={`/scenarios/${s.id}`}>
                    <Button variant="outline" size="sm">
                      Edit & Compare <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
