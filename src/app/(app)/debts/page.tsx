import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { DebtsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const profileId = await getActiveProfileId();
  const [items, plaidAccounts] = await Promise.all([
    prisma.debt.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } }),
    prisma.plaidAccount.findMany({
      where: {
        plaidItem: { profileId, isActive: true },
        type: { in: ["credit", "loan"] },
      },
      select: { id: true, name: true, mask: true, type: true, subtype: true, linkedDebtId: true },
    }),
  ]);
  return (
    <DebtsClient
      items={JSON.parse(JSON.stringify(items))}
      plaidAccounts={JSON.parse(JSON.stringify(plaidAccounts))}
    />
  );
}
