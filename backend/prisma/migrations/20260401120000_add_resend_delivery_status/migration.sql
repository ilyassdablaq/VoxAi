-- CreateTable
CREATE TABLE "EmailDeliveryStatus" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryStatus_provider_providerMessageId_key" ON "EmailDeliveryStatus"("provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "EmailDeliveryStatus_recipientEmail_eventTimestamp_idx" ON "EmailDeliveryStatus"("recipientEmail", "eventTimestamp");

-- CreateIndex
CREATE INDEX "EmailDeliveryStatus_status_eventTimestamp_idx" ON "EmailDeliveryStatus"("status", "eventTimestamp");
