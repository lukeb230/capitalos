import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = localFont({
  src: "../../public/fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../../public/fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CapitalOS",
  description:
    "Model major life choices and see exact effects on your finances",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CapitalOS",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Drag bars for Electron window — two strips that avoid content areas */}
        {/* Left strip: over sidebar header (next to traffic lights) */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "260px",
            height: "38px",
            // @ts-expect-error -- Electron-specific CSS property
            WebkitAppRegion: "drag",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        />
        {/* Right strip: over main content top bar (empty space only) */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "260px",
            right: 0,
            height: "12px",
            // @ts-expect-error -- Electron-specific CSS property
            WebkitAppRegion: "drag",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        />
        <PwaRegister />
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
