export default function GlanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div
        className="max-w-lg mx-auto px-4 pb-8"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        {children}
      </div>
    </main>
  );
}
