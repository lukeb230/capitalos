"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  CreditCard,
  Landmark,
  Target,
  GitBranch,
  Bot,
  Wallet,
  Menu,
  X,
  Users,
  Calculator,
  TrendingDown,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Income", href: "/income", icon: DollarSign },
  { name: "Budget", href: "/budget", icon: Wallet },
  { name: "Debts", href: "/debts", icon: CreditCard },
  { name: "Assets", href: "/assets", icon: Landmark },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Spending Trends", href: "/trends", icon: BarChart3 },
  { name: "Scenarios", href: "/scenarios", icon: GitBranch },
  { name: "Afford It?", href: "/calculator", icon: Calculator },
  { name: "Opportunity Cost", href: "/opportunity", icon: TrendingDown },
  { name: "Monthly Check-in", href: "/checkin", icon: ClipboardCheck },
  { name: "AI Advisor", href: "/advisor", icon: Bot },
];

interface SidebarProps {
  profileName: string;
  avatarColor: string;
}

export function Sidebar({ profileName, avatarColor }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = profileName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile hamburger — respects iOS safe-area so it isn't hidden under
          the status bar in standalone PWA mode. */}
      <button
        className="fixed left-4 z-50 lg:hidden rounded-md bg-card p-2 shadow-md border"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r flex flex-col transition-transform duration-200",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Spacer for macOS Electron traffic lights AND iOS safe-area inset */}
        <div
          className="flex-shrink-0"
          style={{ height: "max(2.5rem, env(safe-area-inset-top))" }}
        />

        {/* Profile section */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profileName}</p>
              <p className="text-[10px] text-muted-foreground">CapitalOS</p>
            </div>
          </div>
          <Link
            href="/profiles"
            className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Users className="h-3 w-3" />
            Switch Profile
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Your data per profile
          </p>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
