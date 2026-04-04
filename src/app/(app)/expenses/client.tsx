"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Home, Car, Utensils, Zap, Tv, ShoppingBag, Shield, Fuel } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  isFixed: boolean;
}

const categories = [
  "housing", "transport", "food", "utilities",
  "subscriptions", "entertainment", "insurance", "other",
];

const presets = [
  { name: "Rent/Mortgage", category: "housing", isFixed: true, icon: Home },
  { name: "Utilities", category: "utilities", isFixed: true, icon: Zap },
  { name: "Car Insurance", category: "insurance", isFixed: true, icon: Shield },
  { name: "Gas/Fuel", category: "transport", isFixed: false, icon: Fuel },
  { name: "Groceries", category: "food", isFixed: false, icon: ShoppingBag },
  { name: "Dining Out", category: "food", isFixed: false, icon: Utensils },
  { name: "Subscriptions", category: "subscriptions", isFixed: true, icon: Tv },
  { name: "Car Payment", category: "transport", isFixed: true, icon: Car },
];

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "annual": return amount / 12;
    case "biweekly": return (amount * 26) / 12;
    case "weekly": return (amount * 52) / 12;
    default: return amount;
  }
}

export function ExpensesClient({ items }: { items: Expense[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    name: "", amount: "", frequency: "monthly", category: "other", isFixed: "false",
  });

  const totalMonthly = items.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const fixedTotal = items.filter((e) => e.isFixed).reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const variableTotal = totalMonthly - fixedTotal;

  function openNew() {
    setEditing(null);
    setForm({ name: "", amount: "", frequency: "monthly", category: "other", isFixed: "false" });
    setOpen(true);
  }

  function openFromPreset(preset: typeof presets[0]) {
    setEditing(null);
    setForm({
      name: preset.name,
      amount: "",
      frequency: "monthly",
      category: preset.category,
      isFixed: String(preset.isFixed),
    });
    setOpen(true);
  }

  function openEdit(item: Expense) {
    setEditing(item);
    setForm({
      name: item.name,
      amount: String(item.amount),
      frequency: item.frequency,
      category: item.category,
      isFixed: String(item.isFixed),
    });
    setOpen(true);
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amount) || amount < 0) return;
    const data = {
      name: form.name,
      amount,
      frequency: form.frequency,
      category: form.category,
      isFixed: form.isFixed === "true",
    };
    try {
      const res = editing
        ? await fetch("/api/expenses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) })
        : await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to save");
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to save expense. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Failed to delete expense. Please try again.");
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total: {formatCurrency(totalMonthly)}/mo ({formatCurrency(fixedTotal)} fixed, {formatCurrency(variableTotal)} variable)
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Expense
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Quick presets — only show when adding, not editing */}
              {!editing && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setForm({ ...form, name: p.name, category: p.category, isFixed: String(p.isFixed) })}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                          form.name === p.name ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                        }`}
                      >
                        <p.icon className="h-3 w-3" />
                        {p.name}
                        <Badge variant={p.isFixed ? "default" : "outline"} className="text-[9px] px-1 py-0 ml-0.5">
                          {p.isFixed ? "F" : "V"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rent" />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1800" />
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v: string | null) => { if (v) setForm({ ...form, frequency: v }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v: string | null) => { if (v) setForm({ ...form, category: v }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.isFixed} onValueChange={(v: string | null) => { if (v) setForm({ ...form, isFixed: v }); }}>
                  <SelectTrigger><SelectValue>{form.isFixed === "true" ? "Fixed" : "Variable"}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Fixed</SelectItem>
                    <SelectItem value="false">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={!form.name || !form.amount}>
                {editing ? "Update" : "Add"} Expense
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No expenses tracked. Click "Add Expense" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatCurrency(item.amount)}</TableCell>
                    <TableCell><Badge variant="secondary">{item.frequency}</Badge></TableCell>
                    <TableCell className="capitalize">{item.category}</TableCell>
                    <TableCell>
                      <Badge variant={item.isFixed ? "default" : "outline"}>
                        {item.isFixed ? "Fixed" : "Variable"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-red-500">
                      {formatCurrency(toMonthly(item.amount, item.frequency))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
