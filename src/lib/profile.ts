import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

const COOKIE_NAME = "decision-profile-id";

export async function getActiveProfileId(): Promise<string> {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(COOKIE_NAME)?.value;

  if (!profileId) {
    redirect("/profiles");
  }

  // Verify profile exists
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) {
    redirect("/profiles");
  }

  return profileId;
}

export async function getActiveProfile() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(COOKIE_NAME)?.value;

  if (!profileId) {
    redirect("/profiles");
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) {
    redirect("/profiles");
  }

  return profile;
}

export async function getActiveProfileIdFromRequest(req: Request): Promise<string> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const profileId = match?.[1];

  if (!profileId) {
    throw new Error("No active profile");
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) {
    throw new Error("Profile not found");
  }

  return profileId;
}
