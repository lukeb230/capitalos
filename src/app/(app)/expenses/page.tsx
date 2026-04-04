import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { ExpensesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const profileId = await getActiveProfileId();
  const items = await prisma.expense.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
  return <ExpensesClient items={JSON.parse(JSON.stringify(items))} />;
}
