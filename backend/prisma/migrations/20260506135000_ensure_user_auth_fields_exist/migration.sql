-- Fallback: Ensure all auth+email verification fields exist on User table
-- This handles cases where earlier migrations weren't applied

DO $$
BEGIN
  -- Add email verification fields if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'emailVerifiedAt') THEN
    ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'emailVerificationTokenHash') THEN
    ALTER TABLE "User" ADD COLUMN "emailVerificationTokenHash" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'emailVerificationExpiresAt') THEN
    ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
  END IF;

  -- Add rate-limit fields if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'failedLoginAttempts') THEN
    ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'lockedUntil') THEN
    ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'lastLoginAt') THEN
    ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
  END IF;
END $$;

-- Mark existing users as verified (prevents auth lockout)
UPDATE "User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt") WHERE "emailVerifiedAt" IS NULL;

-- Create indexes if missing
CREATE INDEX IF NOT EXISTS "User_emailVerificationTokenHash_idx" ON "User" ("emailVerificationTokenHash");
CREATE INDEX IF NOT EXISTS "User_email_lockedUntil_idx" ON "User" ("email", "lockedUntil");
