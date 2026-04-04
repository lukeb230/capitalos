import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { ScenariosClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const profileId = await getActiveProfileId();
  const scenarios = await prisma.scenario.findMany({
    where: { profileId },
    include: { changes: true },
    orderBy: { createdAt: "desc" },
  });
  return <ScenariosClient scenarios={JSON.parse(JSON.stringify(scenarios))} />;
}
