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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { calculateInvestmentGrowth } from "@/lib/engine/calculator";

interface Asset {
  id: string;
  name: string;
  value: number;
  type: string;
  growthRate: number;
  monthlyContribution: number;
}

interface PlaidAccountRef {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  linkedAssetId: string | null;
}

const assetTypes = ["savings", "investment", "property", "vehicle", "other"];

export function AssetsClient({ items, plaidAccounts }: { items: Asset[]; plaidAccounts: PlaidAccountRef[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({ name: "", value: "", type: "savings", growthRate: "0", monthlyContribution: "0", linkedPlaidAccountId: "" });

  const totalValue = items.reduce((sum, a) => sum + a.value, 0);

  function openNew() {
    setEditing(null);
    setForm({ name: "", value: "", type: "savings", growthRate: "0", monthlyContribution: "0", linkedPlaidAccountId: "" });
    setOpen(true);
  }

  function openEdit(item: Asset) {
    setEditing(item);
    const linked = plaidAccounts.find((p) => p.linkedAssetId === item.id);
    setForm({
      name: item.name,
      value: String(item.value),
      type: item.type,
      growthRate: String(item.growthRate),
      monthlyContribution: String(item.monthlyContribution),
      linkedPlaidAccountId: linked?.id || "",
    });
    setOpen(true);
  }

  async function handleSave() {
    const value = parseFloat(form.value);
    const growthRate = parseFloat(form.growthRate);
    if (!form.name.trim() || isNaN(value) || value < 0 || isNaN(growthRate)) return;
    const data = {
      name: form.name,
      value,
      type: form.type,
      growthRate,
      monthlyContribution: parseFloat(form.monthlyContribution) || 0,
    };
    try {
      const res = editing
        ? await fetch("/api/assets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) })
        : await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      const assetId = editing?.id || saved.id;

      // Handle Plaid account linking
      if (assetId && plaidAccounts.length > 0) {
        // Unlink any previously linked account
        const prevLinked = plaidAccounts.find((p) => p.linkedAssetId === assetId);
        if (prevLinked && prevLinked.id !== form.linkedPlaidAccountId) {
          await fetch("/api/plaid/accounts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plaidAccountId: prevLinked.id, linkedAssetId: null }),
          });
        }
        // Link the new one
        if (form.linkedPlaidAccountId) {
          await fetch("/api/plaid/accounts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plaidAccountId: form.linkedPlaidAccountId, linkedAssetId: assetId }),
          });
        }
      }

      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to save asset. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Failed to delete asset. Please try again.");
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total value: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Asset
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Savings Account" />
              </div>
              <div>
                <Label>Current Value ($)</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="12000" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: string | null) => { if (v) setForm({ ...form, type: v }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Annual Growth Rate (%)</Label>
                  <Input type="number" step="0.1" value={form.growthRate} onChange={(e) => setForm({ ...form, growthRate: e.target.value })} placeholder="7" />
                </div>
                <div>
                  <Label>Monthly Contribution ($)</Label>
                  <Input type="number" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} placeholder="500" />
                </div>
              </div>
              {plaidAccounts.length > 0 && (
                <div className="border-t pt-4">
                  <Label>Linked Plaid Account</Label>
                  <Select value={form.linkedPlaidAccountId || "none"} onValueChange={(v: string | null) => { if (v) setForm({ ...form, linkedPlaidAccountId: v === "none" ? "" : v }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (manual)</SelectItem>
                      {plaidAccounts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.mask ? `****${p.mask}` : ""} ({p.subtype || p.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Link to auto-update this asset&apos;s value when you sync.</p>
                </div>
              )}
              <Button className="w-full" onClick={handleSave} disabled={!form.name || !form.value}>
                {editing ? "Update" : "Add"} Asset
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
                <TableHead>Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Growth Rate</TableHead>
                <TableHead>Monthly Contrib.</TableHead>
                <TableHead>5yr Projection</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No assets tracked. Click "Add Asset" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const projected = calculateInvestmentGrowth(item.value, item.monthlyContribution, item.growthRate, 5);
                  const isPlaidLinked = plaidAccounts.some((p) => p.linkedAssetId === item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.name}
                        {isPlaidLinked && <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-[10px] border-emerald-200 hover:bg-emerald-100">Plaid</Badge>}
                      </TableCell>
                      <TableCell className="text-green-600">{formatCurrency(item.value)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{item.type}</Badge></TableCell>
                      <TableCell>{formatPercent(item.growthRate)}</TableCell>
                      <TableCell>{item.monthlyContribution > 0 ? `${formatCurrency(item.monthlyContribution)}/mo` : <span className="text-muted-foreground">--</span>}</TableCell>
                      <TableCell className="text-blue-600">{formatCurrency(projected)}</TableCell>
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
