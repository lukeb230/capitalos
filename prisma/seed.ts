import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.scenarioChange.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.profile.deleteMany();

  console.log("Cleared existing data");

  // ===== PROFILE 1: Alex =====
  const alex = await prisma.profile.create({
    data: { name: "Alex", avatarColor: "#3b82f6" },
  });
  console.log("Created profile: Alex");

  const alexSalary = await prisma.income.create({
    data: { profileId: alex.id, name: "Software Engineer Salary", amount: 3269.23, frequency: "biweekly", taxRate: 22 },
  });
  await prisma.income.create({
    data: { profileId: alex.id, name: "Freelance Web Dev", amount: 500, frequency: "monthly", taxRate: 25 },
  });

  const alexExpenses = [
    { name: "Rent", amount: 1800, category: "housing", isFixed: true },
    { name: "Car Payment", amount: 450, category: "transport", isFixed: true },
    { name: "Utilities", amount: 200, category: "utilities", isFixed: true },
    { name: "Groceries", amount: 600, category: "food", isFixed: false },
    { name: "Subscriptions", amount: 150, category: "subscriptions", isFixed: true },
    { name: "Dining Out", amount: 300, category: "entertainment", isFixed: false },
    { name: "Gas", amount: 200, category: "transport", isFixed: false },
    { name: "Car Insurance", amount: 100, category: "insurance", isFixed: true },
  ];
  for (const e of alexExpenses) {
    await prisma.expense.create({ data: { profileId: alex.id, ...e, frequency: "monthly" } });
  }

  await prisma.debt.create({ data: { profileId: alex.id, name: "Student Loans", balance: 22000, interestRate: 5.5, minimumPayment: 350, type: "student" } });
  await prisma.debt.create({ data: { profileId: alex.id, name: "Car Loan", balance: 15000, interestRate: 4.2, minimumPayment: 450, type: "auto" } });
  const alexCC = await prisma.debt.create({ data: { profileId: alex.id, name: "Credit Card", balance: 3200, interestRate: 19.99, minimumPayment: 120, type: "credit" } });

  await prisma.asset.create({ data: { profileId: alex.id, name: "Savings Account", value: 12000, type: "savings", growthRate: 4.5, monthlyContribution: 200 } });
  await prisma.asset.create({ data: { profileId: alex.id, name: "401(k)", value: 28000, type: "investment", growthRate: 8, monthlyContribution: 500 } });
  await prisma.asset.create({ data: { profileId: alex.id, name: "Brokerage Account", value: 5000, type: "investment", growthRate: 7, monthlyContribution: 150 } });
  await prisma.asset.create({ data: { profileId: alex.id, name: "Car (2021 Honda Civic)", value: 18000, type: "vehicle", growthRate: -10, monthlyContribution: 0 } });

  await prisma.goal.create({ data: { profileId: alex.id, name: "Emergency Fund", targetAmount: 15000, currentAmount: 12000, targetDate: new Date("2026-12-31"), priority: 1, type: "emergency_fund" } });
  await prisma.goal.create({ data: { profileId: alex.id, name: "Pay Off Credit Card", targetAmount: 3200, currentAmount: 0, targetDate: new Date("2026-06-30"), priority: 2, type: "debt_free" } });
  await prisma.goal.create({ data: { profileId: alex.id, name: "Retirement: $100K", targetAmount: 100000, currentAmount: 28000, targetDate: new Date("2030-12-31"), priority: 3, type: "retirement" } });

  await prisma.scenario.create({ data: { profileId: alex.id, name: "Current Baseline", description: "Your current financial situation as-is", isBaseline: true } });
  await prisma.scenario.create({
    data: {
      profileId: alex.id, name: "Salary Raise to $95K", description: "What if you get a raise from $85K to $95K?", isBaseline: false,
      changes: { create: [{ entityType: "income", entityId: alexSalary.id, field: "amount", oldValue: "3269.23", newValue: "3653.85" }] },
    },
  });
  await prisma.scenario.create({
    data: {
      profileId: alex.id, name: "Aggressive Credit Card Payoff", description: "Double the credit card payment to $240/mo", isBaseline: false,
      changes: { create: [{ entityType: "debt", entityId: alexCC.id, field: "minimumPayment", oldValue: "120", newValue: "240" }] },
    },
  });

  console.log("Seeded Alex's data");

  // ===== PROFILE 2: Jordan =====
  const jordan = await prisma.profile.create({
    data: { name: "Jordan", avatarColor: "#22c55e" },
  });
  console.log("Created profile: Jordan");

  await prisma.income.create({ data: { profileId: jordan.id, name: "Marketing Manager Salary", amount: 5200, frequency: "monthly", taxRate: 24 } });
  await prisma.income.create({ data: { profileId: jordan.id, name: "Etsy Shop", amount: 800, frequency: "monthly", taxRate: 20 } });

  const jordanExpenses = [
    { name: "Mortgage", amount: 2200, category: "housing", isFixed: true },
    { name: "HOA Fees", amount: 350, category: "housing", isFixed: true },
    { name: "Groceries", amount: 500, category: "food", isFixed: false },
    { name: "Utilities", amount: 250, category: "utilities", isFixed: true },
    { name: "Streaming & Subscriptions", amount: 80, category: "subscriptions", isFixed: true },
    { name: "Dining Out", amount: 400, category: "entertainment", isFixed: false },
  ];
  for (const e of jordanExpenses) {
    await prisma.expense.create({ data: { profileId: jordan.id, ...e, frequency: "monthly" } });
  }

  await prisma.debt.create({ data: { profileId: jordan.id, name: "Mortgage", balance: 285000, interestRate: 6.5, minimumPayment: 1800, type: "mortgage" } });
  await prisma.debt.create({ data: { profileId: jordan.id, name: "Personal Loan", balance: 8000, interestRate: 9.0, minimumPayment: 250, type: "personal" } });

  await prisma.asset.create({ data: { profileId: jordan.id, name: "Checking Account", value: 5500, type: "savings", growthRate: 0.5, monthlyContribution: 0 } });
  await prisma.asset.create({ data: { profileId: jordan.id, name: "Savings Account", value: 18000, type: "savings", growthRate: 4.5, monthlyContribution: 300 } });
  await prisma.asset.create({ data: { profileId: jordan.id, name: "Roth IRA", value: 42000, type: "investment", growthRate: 8, monthlyContribution: 583 } });
  await prisma.asset.create({ data: { profileId: jordan.id, name: "Home Equity", value: 65000, type: "property", growthRate: 3, monthlyContribution: 0 } });

  await prisma.goal.create({ data: { profileId: jordan.id, name: "Pay Off Personal Loan", targetAmount: 8000, currentAmount: 0, targetDate: new Date("2027-06-30"), priority: 1, type: "debt_free" } });
  await prisma.goal.create({ data: { profileId: jordan.id, name: "$50K Emergency Fund", targetAmount: 50000, currentAmount: 23500, targetDate: new Date("2028-12-31"), priority: 2, type: "emergency_fund" } });
  await prisma.goal.create({ data: { profileId: jordan.id, name: "Reach $250K Net Worth", targetAmount: 250000, currentAmount: 0, targetDate: new Date("2030-06-30"), priority: 3, type: "net_worth" } });

  await prisma.scenario.create({ data: { profileId: jordan.id, name: "Current Baseline", description: "Current financial situation", isBaseline: true } });

  console.log("Seeded Jordan's data");
  console.log("\nSeed complete! 2 profiles ready.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
