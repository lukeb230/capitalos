import { prisma } from "@/lib/db";
import { ProfilesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "asc" } });
  return <ProfilesClient profiles={JSON.parse(JSON.stringify(profiles))} />;
}
