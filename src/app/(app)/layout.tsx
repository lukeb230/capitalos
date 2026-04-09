import { Sidebar } from "@/components/layout/sidebar";
import { getActiveProfile } from "@/lib/profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();

  return (
    <>
      <Sidebar profileName={profile.name} avatarColor={profile.avatarColor} />
      <main className="lg:ml-64 min-h-screen">
        <div
          className="p-6 md:p-8 max-w-7xl mx-auto"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 3.5rem))" }}
        >
          {children}
        </div>
      </main>
    </>
  );
}
