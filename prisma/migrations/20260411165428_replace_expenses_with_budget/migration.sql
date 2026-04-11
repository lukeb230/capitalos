-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_profileId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Expense";

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "isFixed" BOOLEAN NOT NULL DEFAULT true,
    "rolloverEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetOverride" (
    "id" TEXT NOT NULL,
    "budgetCategoryId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "overrideAmount" DOUBLE PRECISION,
    "rolloverIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "BudgetOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetCategory_profileId_idx" ON "BudgetCategory"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_profileId_category_key" ON "BudgetCategory"("profileId", "category");

-- CreateIndex
CREATE INDEX "BudgetOverride_budgetCategoryId_idx" ON "BudgetOverride"("budgetCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetOverride_budgetCategoryId_month_year_key" ON "BudgetOverride"("budgetCategoryId", "month", "year");

-- AddForeignKey
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOverride" ADD CONSTRAINT "BudgetOverride_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
