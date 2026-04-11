import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";
import { budgetToExpenseInputs } from "@/lib/budget/helpers";
import {
  calculateMonthlyCashFlow,
  calculateMonthlyNetIncome,
  calculateMonthlyExpenses,
  calculateMonthlyDebtPayments,
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalDebts,
  calculateEmergencyFundMonths,
  calculateSavingsRate,
  calculateDebtPayoff,
  toMonthly,
} from "@/lib/engine/calculator";

export async function POST(req: Request) {
  let profileId;
  try { profileId = await getActiveProfileIdFromRequest(req); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auth error" }, { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { message, history } = body;

  if (!message || typeof message !== "string" || message.length > 10000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  if (history && (!Array.isArray(history) || history.length > 50)) {
    return NextResponse.json({ error: "Invalid history" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      role: "assistant",
      content: null,
      structured: {
        summary: "AI advisor is not configured yet.",
        tradeoffs: ["Add an ANTHROPIC_API_KEY environment variable to enable the AI advisor."],
        nextStep: "Add ANTHROPIC_API_KEY=your-key-here to the .env file and restart the app.",
      },
    });
  }

  const [incomes, budgetCategories, debts, assets, goals] = await Promise.all([
    prisma.income.findMany({ where: { profileId } }),
    prisma.budgetCategory.findMany({ where: { profileId } }),
    prisma.debt.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.goal.findMany({ where: { profileId } }),
  ]);

  const incomeInputs = incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount, frequency: i.frequency, taxRate: i.taxRate, isNetInput: i.isNetInput }));
  const expenseInputs = budgetToExpenseInputs(budgetCategories);
  const debtInputs = debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, interestRate: d.interestRate, minimumPayment: d.minimumPayment, type: d.type, originalLoan: d.originalLoan, loanTermMonths: d.loanTermMonths }));
  const assetInputs = assets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type, growthRate: a.growthRate, monthlyContribution: a.monthlyContribution }));

  const netIncome = calculateMonthlyNetIncome(incomeInputs);
  const totalExpenses = calculateMonthlyExpenses(expenseInputs);
  const debtPayments = calculateMonthlyDebtPayments(debtInputs);
  const cashFlow = calculateMonthlyCashFlow(incomeInputs, expenseInputs, debtInputs, assetInputs);
  const netWorth = calculateNetWorth(assetInputs, debtInputs);
  const totalAssets = calculateTotalAssets(assetInputs);
  const totalDebts = calculateTotalDebts(debtInputs);
  const emergencyMonths = calculateEmergencyFundMonths(assetInputs, expenseInputs);
  const savingsRate = calculateSavingsRate(incomeInputs, expenseInputs, debtInputs, assetInputs);
  const debtPayoffs = debtInputs.map((d) => calculateDebtPayoff(d));

  const financialContext = `
USER'S FINANCIAL SNAPSHOT:
- Monthly Net Income: $${netIncome.toFixed(0)}
- Monthly Expenses: $${totalExpenses.toFixed(0)}
- Monthly Debt Payments: $${debtPayments.toFixed(0)}
- Monthly Free Cash Flow: $${cashFlow.toFixed(0)}
- Savings Rate: ${savingsRate}%
- Net Worth: $${netWorth.toFixed(0)}
- Total Assets: $${totalAssets.toFixed(0)}
- Total Debts: $${totalDebts.toFixed(0)}
- Emergency Fund: ${emergencyMonths} months of expenses

INCOME SOURCES (with IDs for actions):
${incomes.map((i) => `- [id:${i.id}] ${i.name}: $${toMonthly(i.amount, i.frequency).toFixed(0)}/mo (stored as $${i.amount} ${i.frequency}, ${i.taxRate}% tax)`).join("\n")}

EXPENSES (with IDs for actions):
${expenseInputs.map((e) => `- [id:${e.id}] ${e.name}: $${toMonthly(e.amount, e.frequency).toFixed(0)}/mo (stored as $${e.amount} ${e.frequency}, ${e.category}, ${e.isFixed ? "fixed" : "variable"})`).join("\n")}

DEBTS (with IDs for actions):
${debtInputs.map((d) => {
  const payoff = debtPayoffs.find((p) => p.debtId === d.id);
  const loanInfo = d.originalLoan ? `, original loan $${d.originalLoan}` : "";
  const termInfo = d.loanTermMonths ? `, ${d.loanTermMonths}mo term` : "";
  const payoffTime = payoff ? (payoff.monthsToPayoff === Infinity ? "Never" : `${payoff.monthsToPayoff} months`) : "?";
  return `- [id:${d.id}] ${d.name}: $${d.balance} balance, ${d.interestRate}% APR, $${d.minimumPayment}/mo, payoff in ${payoffTime}${loanInfo}${termInfo}`;
}).join("\n")}

ASSETS (with IDs for actions):
${assets.map((a) => `- [id:${a.id}] ${a.name}: $${a.value} (${a.type}, ${a.growthRate}% growth, $${a.monthlyContribution}/mo contribution)`).join("\n")}

GOALS (with IDs for actions):
${goals.map((g) => `- [id:${g.id}] ${g.name}: $${g.currentAmount}/$${g.targetAmount} (${g.type}, target: ${g.targetDate.toISOString().split("T")[0]})`).join("\n")}
`.trim();

  const systemPrompt = `You are a personal finance advisor inside a financial planning app called CapitalOS. You have access to the user's complete financial data shown below.

${financialContext}

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact structure:
{
  "summary": "A 1-2 sentence direct answer to their question",
  "tradeoffs": ["Key tradeoff or consideration 1", "Key tradeoff 2"],
  "nextStep": "One specific actionable recommendation",
  "proposedActions": []
}

PROPOSED ACTIONS:
When the user asks you to make changes (e.g. "add a $200 expense", "increase my 401k contribution", "set a new goal"), include a "proposedActions" array. Each action is an object:

For CREATING new records:
{ "operation": "create", "entityType": "budgetCategory", "data": { "category": "subscriptions", "monthlyAmount": 15, "isFixed": true } }
{ "operation": "create", "entityType": "income", "data": { "name": "Side gig", "amount": 500, "frequency": "monthly", "taxRate": 25 } }
{ "operation": "create", "entityType": "debt", "data": { "name": "Car Loan", "balance": 25000, "interestRate": 5.9, "minimumPayment": 450, "type": "auto" } }
{ "operation": "create", "entityType": "asset", "data": { "name": "Roth IRA", "value": 5000, "type": "investment", "growthRate": 8, "monthlyContribution": 500 } }
{ "operation": "create", "entityType": "goal", "data": { "name": "Emergency Fund", "targetAmount": 25000, "currentAmount": 5000, "targetDate": "2027-12-31", "priority": 1, "type": "emergency_fund" } }

For UPDATING existing records (use the entity ID from the data above):
{ "operation": "update", "entityType": "debt", "id": "the-id", "data": { "minimumPayment": 500 }, "description": "Increase credit card payment from $120 to $500/mo" }
{ "operation": "update", "entityType": "asset", "id": "the-id", "data": { "monthlyContribution": 750 }, "description": "Increase 401(k) contribution to $750/mo" }

For DELETING records:
{ "operation": "delete", "entityType": "budgetCategory", "id": "the-id", "description": "Remove subscriptions budget" }

For CREATING SCENARIOS (natural language scenario creation):
When the user describes a life change like "What if I move to Austin and take a $90K job?" or "Create a scenario where I buy a $30K car", create a scenario with multiple changes:
{ "operation": "create", "entityType": "scenario", "data": { "name": "Move to Austin", "description": "Take $90K job, lower rent to $1,200", "changes": [
  { "entityType": "income", "entityId": "the-salary-id", "field": "amount", "oldValue": "3269.23", "newValue": "3461.54" },
  { "entityType": "expense", "entityId": "the-housing-budget-id", "field": "amount", "oldValue": "1800", "newValue": "1200" }
] } }

Use real entity IDs from the data above. Calculate reasonable new values (e.g. $90K/yr biweekly = $3461.54). The scenario will appear in the Scenarios page for comparison.

IMPORTANT RULES FOR ACTIONS:
- ALWAYS include a human-readable "description" field for update and delete actions
- Only include proposedActions when the user explicitly asks to make a change or says something like "do it", "go ahead", "make that change", "add that", "update it", or describes a what-if scenario
- If the user is just asking a question (e.g. "should I increase my contribution?"), give advice but do NOT propose actions
- The user will see the proposed actions and must confirm before they are applied
- Keep proposedActions as an empty array [] when no changes are requested
- Use real IDs from the data above when updating or deleting
- For scenario creation, include ALL the changes that the life decision would involve

GUIDELINES:
- Be specific with dollar amounts and timeframes using the actual data above
- Be direct and concise
- Reference their actual numbers by name
- Keep tradeoffs to 2-4 bullet points max`;

  const messages = [
    ...(history || []).map((h: { role: string; content: string }) => ({
      role: h.role,
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", error);
      return NextResponse.json({
        role: "assistant",
        content: null,
        structured: {
          summary: "Sorry, I encountered an error connecting to the AI service.",
          tradeoffs: [`API returned status ${response.status}`],
          nextStep: "Try again in a moment, or check that your API key is valid.",
        },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const structured = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          role: "assistant",
          content: text,
          structured: {
            summary: structured.summary || text,
            tradeoffs: structured.tradeoffs || [],
            nextStep: structured.nextStep || "",
            proposedActions: structured.proposedActions || [],
          },
        });
      }
    } catch {
      // Fall through to plain text
    }

    return NextResponse.json({
      role: "assistant",
      content: text,
      structured: {
        summary: text,
        tradeoffs: [],
        nextStep: "",
        proposedActions: [],
      },
    });
  } catch (error) {
    console.error("Advisor error:", error);
    return NextResponse.json({
      role: "assistant",
      content: null,
      structured: {
        summary: "An unexpected error occurred.",
        tradeoffs: [],
        nextStep: "Please try again.",
        proposedActions: [],
      },
    });
  }
}
