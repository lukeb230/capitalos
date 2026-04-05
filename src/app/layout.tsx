import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  description: "Model major life choices and see exact effects on your finances",
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
        {/* Invisible drag bar for Electron window — sits above all content */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "38px",
            // @ts-expect-error -- Electron-specific CSS property
            WebkitAppRegion: "drag",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        />
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
