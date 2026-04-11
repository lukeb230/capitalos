import { NextResponse } from "next/server";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { projectMonthly } from "@/lib/engine/projections";
import { calculateMonthlyCashFlow, calculateNetWorth, calculateDebtPayoff, calculateEmergencyFundMonths } from "@/lib/engine/calculator";
import { compareScenarios } from "@/lib/engine/scenarios";
import type { FinancialState, ScenarioChangeInput } from "@/lib/engine/types";

export async function POST(req: Request) {
  try { await getActiveProfileIdFromRequest(req); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { state, scenarioChanges, months = 60 } = body as {
    state: FinancialState;
    scenarioChanges?: ScenarioChangeInput[];
    months?: number;
  };

  if (!state || !Array.isArray(state.incomes) || !Array.isArray(state.expenses)
      || !Array.isArray(state.debts) || !Array.isArray(state.assets) || !Array.isArray(state.goals)) {
    return NextResponse.json({ error: "Invalid financial state" }, { status: 400 });
  }
  if (typeof months !== "number" || months < 1 || months > 600) {
    return NextResponse.json({ error: "months must be 1-600" }, { status: 400 });
  }

  const cashFlow = calculateMonthlyCashFlow(state.incomes, state.expenses, state.debts, state.assets);
  const netWorth = calculateNetWorth(state.assets, state.debts);
  const projections = projectMonthly(state, months);
  const debtPayoffs = state.debts.map((d) => calculateDebtPayoff(d));
  const emergencyMonths = calculateEmergencyFundMonths(state.assets, state.expenses);

  let comparison = null;
  if (scenarioChanges && scenarioChanges.length > 0) {
    comparison = compareScenarios(state, scenarioChanges, months);
  }

  return NextResponse.json({
    cashFlow,
    netWorth,
    projections,
    debtPayoffs,
    emergencyMonths,
    comparison,
  });
}
