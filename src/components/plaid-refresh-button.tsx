"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Refreshes Plaid-synced data: pulls the latest account balances (which also
// auto-updates any linked assets/debts) and fetches new transactions since
// the last sync cursor. Usable from both the desktop Electron client and the
// hosted PWA — they share this codebase and both hit the same Neon Postgres.
export function PlaidRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setStatus(null);
    try {
      const [balRes, syncRes] = await Promise.all([
        fetch("/api/plaid/balances", { method: "POST" }),
        fetch("/api/plaid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ]);

      // Both endpoints return 404 when no Plaid items are connected — treat
      // that as "nothing to refresh" rather than an error.
      if (balRes.status === 404 && syncRes.status === 404) {
        setStatus("No Plaid accounts connected");
        return;
      }

      if (!balRes.ok && balRes.status !== 404) {
        const err = await balRes.json().catch(() => ({}));
        throw new Error(err.error || `Balances failed (${balRes.status})`);
      }
      if (!syncRes.ok && syncRes.status !== 404) {
        const err = await syncRes.json().catch(() => ({}));
        throw new Error(err.error || `Sync failed (${syncRes.status})`);
      }

      const sync =
        syncRes.status === 200
          ? ((await syncRes.json()) as {
              added: number;
              modified: number;
              removed: number;
            })
          : { added: 0, modified: 0, removed: 0 };
      const bal =
        balRes.status === 200
          ? ((await balRes.json()) as { updatedAccounts: number })
          : { updatedAccounts: 0 };

      const parts: string[] = [];
      if (sync.added) parts.push(`${sync.added} new`);
      if (sync.modified) parts.push(`${sync.modified} updated`);
      if (sync.removed) parts.push(`${sync.removed} removed`);
      if (bal.updatedAccounts)
        parts.push(`${bal.updatedAccounts} linked balance(s)`);
      setStatus(parts.length > 0 ? parts.join(", ") : "Up to date");

      // Refresh server components so the dashboard reflects the new data.
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setLoading(false);
      // Clear status after a few seconds so the button label returns to normal
      setTimeout(() => setStatus(null), 4000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={loading}
      title="Refresh Plaid balances and transactions"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
      />
      {loading ? "Refreshing…" : status ?? "Refresh"}
    </Button>
  );
}
