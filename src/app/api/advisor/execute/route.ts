import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfileIdFromRequest } from "@/lib/profile";

interface ScenarioChangeData {
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface ProposedAction {
  operation: "create" | "update" | "delete";
  entityType: "income" | "expense" | "debt" | "asset" | "goal" | "scenario";
  id?: string;
  data?: Record<string, unknown>;
  description?: string;
}

const prismaModels: Record<string, keyof typeof prisma> = {
  income: "income",
  expense: "expense",
  debt: "debt",
  asset: "asset",
  goal: "goal",
};

export async function POST(req: Request) {
  let profileId;
  try { profileId = await getActiveProfileIdFromRequest(req); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auth error" }, { status: 401 });
  }
  let reqBody;
  try { reqBody = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { actions } = reqBody as { actions: ProposedAction[] };

  if (!actions || actions.length === 0) {
    return NextResponse.json({ success: false, error: "No actions provided" });
  }

  const results: { action: ProposedAction; success: boolean; error?: string }[] = [];

  for (const action of actions) {
    try {
      // Handle scenario creation specially
      if (action.entityType === "scenario" && action.operation === "create" && action.data) {
        const changes = (action.data.changes as ScenarioChangeData[]) || [];
        await prisma.scenario.create({
          data: {
            profileId,
            name: (action.data.name as string) || "AI-Generated Scenario",
            description: (action.data.description as string) || "",
            isBaseline: false,
            changes: {
              create: changes.map((c) => ({
                entityType: c.entityType,
                entityId: c.entityId,
                field: c.field,
                oldValue: c.oldValue,
                newValue: c.newValue,
              })),
            },
          },
        });
        results.push({ action, success: true });
        continue;
      }

      const modelName = prismaModels[action.entityType];
      if (!modelName) {
        results.push({ action, success: false, error: `Unknown entity type: ${action.entityType}` });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = prisma[modelName] as any;

      // Whitelist allowed fields per entity type to prevent injection
      const ALLOWED_FIELDS: Record<string, string[]> = {
        income: ["name", "amount", "frequency", "taxRate"],
        expense: ["name", "amount", "frequency", "category", "isFixed"],
        debt: ["name", "balance", "interestRate", "minimumPayment", "type", "originalLoan", "loanTermMonths"],
        asset: ["name", "value", "type", "growthRate", "monthlyContribution"],
        goal: ["name", "targetAmount", "currentAmount", "targetDate", "priority", "type"],
      };

      if (action.operation === "create") {
        const allowed = ALLOWED_FIELDS[action.entityType] || [];
        const createData: Record<string, unknown> = { profileId };
        for (const field of allowed) {
          if (action.data && action.data[field] !== undefined) createData[field] = action.data[field];
        }
        // Handle goal targetDate conversion
        if (action.entityType === "goal" && createData.targetDate) {
          createData.targetDate = new Date(createData.targetDate as string);
        }
        await model.create({ data: createData });
        results.push({ action, success: true });
      } else if (action.operation === "update" && action.id) {
        // Verify the record belongs to this profile
        const existing = await model.findFirst({ where: { id: action.id, profileId } });
        if (!existing) {
          results.push({ action, success: false, error: "Record not found or not owned by this profile" });
          continue;
        }
        // Filter update data through the same whitelist as create
        const allowed = ALLOWED_FIELDS[action.entityType] || [];
        const updateData: Record<string, unknown> = {};
        for (const field of allowed) {
          if (action.data && action.data[field] !== undefined) updateData[field] = action.data[field];
        }
        if (action.entityType === "goal" && updateData.targetDate) {
          updateData.targetDate = new Date(updateData.targetDate as string);
        }
        await model.update({ where: { id: action.id }, data: updateData });
        results.push({ action, success: true });
      } else if (action.operation === "delete" && action.id) {
        const existing = await model.findFirst({ where: { id: action.id, profileId } });
        if (!existing) {
          results.push({ action, success: false, error: "Record not found or not owned by this profile" });
          continue;
        }
        await model.delete({ where: { id: action.id } });
        results.push({ action, success: true });
      } else {
        results.push({ action, success: false, error: "Invalid operation or missing id" });
      }
    } catch (error) {
      results.push({
        action,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const allSuccess = results.every((r) => r.success);
  return NextResponse.json({
    success: allSuccess,
    results,
    appliedCount: results.filter((r) => r.success).length,
    totalCount: results.length,
  });
}
