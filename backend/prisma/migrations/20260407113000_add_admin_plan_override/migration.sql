-- CreateTable
CREATE TABLE "AdminPlanOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminPlanOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminPlanOverride_userId_revokedAt_expiresAt_idx" ON "AdminPlanOverride"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminPlanOverride_createdByAdminId_createdAt_idx" ON "AdminPlanOverride"("createdByAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminPlanOverride_createdAt_idx" ON "AdminPlanOverride"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminPlanOverride" ADD CONSTRAINT "AdminPlanOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPlanOverride" ADD CONSTRAINT "AdminPlanOverride_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
