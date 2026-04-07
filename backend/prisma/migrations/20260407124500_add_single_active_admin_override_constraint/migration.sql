-- Ensure at most one non-revoked override row per user.
CREATE UNIQUE INDEX IF NOT EXISTS "AdminPlanOverride_userId_active_unique"
ON "AdminPlanOverride" ("userId")
WHERE "revokedAt" IS NULL;
