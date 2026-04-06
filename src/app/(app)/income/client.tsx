"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  taxRate: number;
  startDate: string;
  endDate: string | null;
}

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "annual": return amount / 12;
    case "biweekly": return (amount * 26) / 12;
    case "weekly": return (amount * 52) / 12;
    default: return amount;
  }
}

export function IncomeClient({ items }: { items: Income[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", frequency: "monthly", taxRate: "22", inputType: "gross" as "gross" | "net" });

  const totalMonthlyGross = items.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const totalMonthlyNet = items.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency) * (1 - i.taxRate / 100), 0);

  function openNew() {
    setEditing(null);
    setForm({ name: "", amount: "", frequency: "monthly", taxRate: "22", inputType: "gross" });
    setOpen(true);
  }

  function openEdit(item: Income) {
    setEditing(item);
    setForm({
      name: item.name,
      amount: String(item.amount),
      frequency: item.frequency,
      taxRate: String(item.taxRate),
      inputType: item.taxRate === 0 ? "net" : "gross",
    });
    setOpen(true);
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    const taxRate = form.inputType === "net" ? 0 : parseFloat(form.taxRate);
    if (!form.name.trim() || isNaN(amount) || amount < 0) return;
    const data = {
      name: form.name,
      amount,
      frequency: form.frequency,
      taxRate: isNaN(taxRate) ? 0 : taxRate,
    };
    try {
      const res = editing
        ? await fetch("/api/income", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) })
        : await fetch("/api/income", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to save");
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to save income. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/income?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Failed to delete income. Please try again.");
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatCurrency(totalMonthlyNet)}/mo after tax ({formatCurrency(totalMonthlyGross)} gross)
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Income
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Income</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Salary" />
              </div>
              <div>
                <Label>Amount Type</Label>
                <Select value={form.inputType} onValueChange={(v: string | null) => { if (v) setForm({ ...form, inputType: v as "gross" | "net", taxRate: v === "net" ? "0" : form.taxRate === "0" ? "22" : form.taxRate }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross (before tax)</SelectItem>
                    <SelectItem value="net">Net (after tax)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.inputType === "gross" ? "Gross Amount ($)" : "Net Amount ($)"}</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" />
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
              {form.inputType === "gross" && (
                <div>
                  <Label>Tax Rate (%)</Label>
                  <Input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} placeholder="22" />
                </div>
              )}
              <Button className="w-full" onClick={handleSave} disabled={!form.name || !form.amount}>
                {editing ? "Update" : "Add"} Income
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
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead>Monthly (Net)</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No income sources. Click "Add Income" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatCurrency(item.amount)}</TableCell>
                    <TableCell><Badge variant="secondary">{item.frequency}</Badge></TableCell>
                    <TableCell>{item.taxRate}%</TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(toMonthly(item.amount, item.frequency) * (1 - item.taxRate / 100))}
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
