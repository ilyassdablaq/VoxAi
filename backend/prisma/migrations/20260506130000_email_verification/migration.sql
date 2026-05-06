-- E-Mail-Verifizierung: Drei neue Felder am User-Modell.
-- emailVerifiedAt = NULL → noch nicht verifiziert.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Lookup nach Token-Hash beim Verify
CREATE INDEX IF NOT EXISTS "User_emailVerificationTokenHash_idx"
  ON "User" ("emailVerificationTokenHash");

-- Bestandsnutzer als verifiziert markieren (sonst werden alle Logins gesperrt).
-- Wenn du das NICHT willst: diese Zeile entfernen und Verifikation pro Nutzer triggern.
UPDATE "User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt");
