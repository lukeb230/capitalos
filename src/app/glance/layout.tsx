import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CapitalOS Glance",
  description: "Quick financial snapshot",
  manifest: "/manifest-glance.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Glance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
