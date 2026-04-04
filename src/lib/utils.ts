import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (!isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyExact(value: number): string {
  if (!isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  if (!isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

export function formatMonths(months: number): string {
  if (months === Infinity) return "Never";
  if (months < 0) return "Achieved";
  const years = Math.floor(months / 12);
  const remaining = Math.round(months % 12);
  if (years === 0) return `${remaining}mo`;
  if (remaining === 0) return `${years}yr`;
  return `${years}yr ${remaining}mo`;
}
