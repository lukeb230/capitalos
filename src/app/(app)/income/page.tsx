import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { IncomeClient } from "./client";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const profileId = await getActiveProfileId();
  const items = await prisma.income.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });
  return <IncomeClient items={JSON.parse(JSON.stringify(items))} />;
}
