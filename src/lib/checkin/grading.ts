import type { CategoryGrade, CheckinGrade } from "./types";

// Grade scale: ratio = actual / budgeted
// A: ≤90% (under budget), B: ≤100% (at budget), C: ≤110% (slightly over)
// D: ≤125% (significantly over), F: >125% (way over)
function letterGrade(ratio: number): string {
  if (ratio <= 0.90) return "A";
  if (ratio <= 1.00) return "B";
  if (ratio <= 1.10) return "C";
  if (ratio <= 1.25) return "D";
  return "F";
}

function gradeToNumber(grade: string): number {
  switch (grade) {
    case "A": return 4;
    case "B": return 3;
    case "C": return 2;
    case "D": return 1;
    default: return 0;
  }
}

function numberToGrade(num: number): string {
  if (num >= 3.5) return "A";
  if (num >= 2.5) return "B";
  if (num >= 1.5) return "C";
  if (num >= 0.5) return "D";
  return "F";
}

export function computeGrades(
  actuals: Record<string, number>, // { housing: 1200, food: 450, ... }
  budgeted: Record<string, number> // { housing: 1500, food: 400, ... }
): CheckinGrade {
  const categories: CategoryGrade[] = [];
  let totalBudgeted = 0;
  let totalActual = 0;

  // Grade each budgeted category
  for (const [category, budget] of Object.entries(budgeted)) {
    if (budget <= 0) continue;
    const actual = actuals[category] || 0;
    const ratio = actual / budget;
    const grade = letterGrade(ratio);
    categories.push({
      category,
      budgeted: Math.round(budget * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      ratio: Math.round(ratio * 1000) / 1000,
      grade,
      diff: Math.round((actual - budget) * 100) / 100,
    });
    totalBudgeted += budget;
    totalActual += actual;
  }

  // Add unbudgeted categories (spending with no budget set)
  for (const [category, actual] of Object.entries(actuals)) {
    if (!budgeted[category] && actual > 0) {
      categories.push({
        category,
        budgeted: 0,
        actual: Math.round(actual * 100) / 100,
        ratio: Infinity,
        grade: "—",
        diff: Math.round(actual * 100) / 100,
      });
      totalActual += actual;
    }
  }

  // Sort: worst grades first
  categories.sort((a, b) => gradeToNumber(a.grade) - gradeToNumber(b.grade));

  // Overall grade: weighted by budget amount
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cg of categories) {
    if (cg.budgeted > 0) {
      weightedSum += gradeToNumber(cg.grade) * cg.budgeted;
      weightTotal += cg.budgeted;
    }
  }
  const overallGrade = weightTotal > 0 ? numberToGrade(weightedSum / weightTotal) : "N/A";

  return {
    categories,
    overallGrade,
    totalBudgeted: Math.round(totalBudgeted * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalDiff: Math.round((totalActual - totalBudgeted) * 100) / 100,
  };
}
