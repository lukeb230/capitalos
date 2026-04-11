/**
 * One-time migration: SQLite export (JSON) → Neon Postgres via Prisma.
 *
 * Prerequisite: Run the SQL export first (see plan for the sqlite3 commands
 * that write /tmp/capitalos-export/*.json). This script reads those JSONs and
 * writes to whatever DATABASE_URL the Prisma client is pointed at.
 *
 * Runs in FK dependency order. Idempotent: uses createMany with
 * skipDuplicates so re-running won't error.
 *
 *   tsx scripts/migrate-sqlite-to-postgres.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const EXPORT_DIR = "/tmp/capitalos-export";
const prisma = new PrismaClient();

type Row = Record<string, unknown>;

function load(table: string): Row[] {
  const path = join(EXPORT_DIR, `${table}.json`);
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw) as Row[];
}

// SQLite stores DateTimes as epoch milliseconds (number) OR ISO strings.
// Convert the listed fields on each row.
function dateFields(row: Row, fields: string[]): Row {
  const out: Row = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === null || v === undefined) continue;
    if (typeof v === "number") {
      out[f] = new Date(v);
    } else if (typeof v === "string") {
      out[f] = new Date(v);
    }
  }
  return out;
}

// SQLite stores Booleans as 0/1 integers.
function boolFields(row: Row, fields: string[]): Row {
  const out: Row = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === null || v === undefined) continue;
    if (typeof v === "number") out[f] = v !== 0;
    else if (typeof v === "boolean") out[f] = v;
  }
  return out;
}

async function migrate() {
  console.log(`Migrating from ${EXPORT_DIR} to ${process.env.DATABASE_URL?.slice(0, 40)}...`);

  // 1. Profile (no FK dependencies)
  const profiles = load("Profile").map((r) =>
    dateFields(r, ["createdAt", "updatedAt"]),
  );
  if (profiles.length) {
    await prisma.profile.createMany({ data: profiles as never, skipDuplicates: true });
    console.log(`Profile: ${profiles.length}`);
  }

  // 2. Income, Expense, Debt, Asset, Goal (depend on Profile)
  const incomes = load("Income")
    .map((r) => dateFields(r, ["startDate", "endDate", "createdAt", "updatedAt"]))
    .map((r) => boolFields(r, ["isNetInput"]));
  if (incomes.length) {
    await prisma.income.createMany({ data: incomes as never, skipDuplicates: true });
    console.log(`Income: ${incomes.length}`);
  }

  // Note: Expense model has been replaced by BudgetCategory.
  // Old expense data is not migrated — budget starts from scratch.

  const debts = load("Debt").map((r) =>
    dateFields(r, ["createdAt", "updatedAt"]),
  );
  if (debts.length) {
    await prisma.debt.createMany({ data: debts as never, skipDuplicates: true });
    console.log(`Debt: ${debts.length}`);
  }

  const assets = load("Asset").map((r) =>
    dateFields(r, ["createdAt", "updatedAt"]),
  );
  if (assets.length) {
    await prisma.asset.createMany({ data: assets as never, skipDuplicates: true });
    console.log(`Asset: ${assets.length}`);
  }

  const goals = load("Goal").map((r) =>
    dateFields(r, ["targetDate", "createdAt", "updatedAt"]),
  );
  if (goals.length) {
    await prisma.goal.createMany({ data: goals as never, skipDuplicates: true });
    console.log(`Goal: ${goals.length}`);
  }

  // 3. Scenario (depends on Profile), then ScenarioChange (depends on Scenario)
  const scenarios = load("Scenario")
    .map((r) => dateFields(r, ["createdAt", "updatedAt"]))
    .map((r) => boolFields(r, ["isBaseline"]));
  if (scenarios.length) {
    await prisma.scenario.createMany({ data: scenarios as never, skipDuplicates: true });
    console.log(`Scenario: ${scenarios.length}`);
  }

  const scenarioChanges = load("ScenarioChange").map((r) =>
    dateFields(r, ["createdAt"]),
  );
  if (scenarioChanges.length) {
    await prisma.scenarioChange.createMany({
      data: scenarioChanges as never,
      skipDuplicates: true,
    });
    console.log(`ScenarioChange: ${scenarioChanges.length}`);
  }

  // 4. PlaidItem (depends on Profile), then PlaidAccount (depends on PlaidItem)
  const plaidItems = load("PlaidItem")
    .map((r) => dateFields(r, ["lastSynced", "consentExpires", "createdAt", "updatedAt"]))
    .map((r) => boolFields(r, ["isActive"]));
  if (plaidItems.length) {
    await prisma.plaidItem.createMany({ data: plaidItems as never, skipDuplicates: true });
    console.log(`PlaidItem: ${plaidItems.length}`);
  }

  const plaidAccounts = load("PlaidAccount").map((r) =>
    dateFields(r, ["createdAt", "updatedAt"]),
  );
  if (plaidAccounts.length) {
    await prisma.plaidAccount.createMany({
      data: plaidAccounts as never,
      skipDuplicates: true,
    });
    console.log(`PlaidAccount: ${plaidAccounts.length}`);
  }

  // 5. MonthlyCheckin (depends on Profile), then Transaction (depends on
  // MonthlyCheckin and PlaidAccount)
  const checkins = load("MonthlyCheckin").map((r) =>
    dateFields(r, ["createdAt", "updatedAt"]),
  );
  if (checkins.length) {
    await prisma.monthlyCheckin.createMany({
      data: checkins as never,
      skipDuplicates: true,
    });
    console.log(`MonthlyCheckin: ${checkins.length}`);
  }

  const transactions = load("Transaction")
    .map((r) => dateFields(r, ["date", "createdAt"]))
    .map((r) => boolFields(r, ["isIncome", "excluded"]));
  if (transactions.length) {
    // createMany has a parameter limit in Postgres; chunk to be safe.
    const chunkSize = 200;
    for (let i = 0; i < transactions.length; i += chunkSize) {
      const chunk = transactions.slice(i, i + chunkSize);
      await prisma.transaction.createMany({
        data: chunk as never,
        skipDuplicates: true,
      });
    }
    console.log(`Transaction: ${transactions.length}`);
  }

  console.log("Migration complete.");
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
