import { prisma } from "@/lib/db";
import { getActiveProfileId } from "@/lib/profile";
import { AssetsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const profileId = await getActiveProfileId();
  const [items, plaidAccounts] = await Promise.all([
    prisma.asset.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } }),
    prisma.plaidAccount.findMany({
      where: {
        plaidItem: { profileId, isActive: true },
        type: { in: ["depository", "investment"] },
      },
      select: { id: true, name: true, mask: true, type: true, subtype: true, linkedAssetId: true },
    }),
  ]);
  return (
    <AssetsClient
      items={JSON.parse(JSON.stringify(items))}
      plaidAccounts={JSON.parse(JSON.stringify(plaidAccounts))}
    />
  );
}
