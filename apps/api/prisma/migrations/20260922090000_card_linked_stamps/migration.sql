-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "card_linked";

-- CreateTable
CREATE TABLE "card_linked"."User" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_linked"."Merchant" (
    "id" UUID NOT NULL,
    "stampThresholdMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_linked"."MerchantLocation" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fidel',
    "programId" UUID NOT NULL,
    "externalLocationId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_linked"."LinkedCard" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fidel',
    "programId" UUID NOT NULL,
    "externalCardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_linked"."Transaction" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" UUID NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "linkedCardId" UUID NOT NULL,
    "merchantLocationId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "stampThresholdMinor" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_linked"."StampBalance" (
    "userId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "provisional" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StampBalance_pkey" PRIMARY KEY ("userId","merchantId")
);

-- CreateTable
CREATE TABLE "card_linked"."StampLedger" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "stamps" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantLocation_merchantId_idx" ON "card_linked"."MerchantLocation"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantLocation_provider_programId_externalLocationId_key" ON "card_linked"."MerchantLocation"("provider", "programId", "externalLocationId");

-- CreateIndex
CREATE INDEX "LinkedCard_userId_idx" ON "card_linked"."LinkedCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedCard_provider_programId_externalCardId_key" ON "card_linked"."LinkedCard"("provider", "programId", "externalCardId");

-- CreateIndex
CREATE INDEX "Transaction_linkedCardId_receivedAt_idx" ON "card_linked"."Transaction"("linkedCardId", "receivedAt");

-- CreateIndex
CREATE INDEX "Transaction_merchantLocationId_receivedAt_idx" ON "card_linked"."Transaction"("merchantLocationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_provider_externalId_key" ON "card_linked"."Transaction"("provider", "externalId");

-- CreateIndex
CREATE INDEX "StampBalance_merchantId_idx" ON "card_linked"."StampBalance"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "StampLedger_transactionId_key" ON "card_linked"."StampLedger"("transactionId");

-- CreateIndex
CREATE INDEX "StampLedger_userId_merchantId_createdAt_idx" ON "card_linked"."StampLedger"("userId", "merchantId", "createdAt");

-- AddForeignKey
ALTER TABLE "card_linked"."MerchantLocation" ADD CONSTRAINT "MerchantLocation_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "card_linked"."Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."LinkedCard" ADD CONSTRAINT "LinkedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "card_linked"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."Transaction" ADD CONSTRAINT "Transaction_linkedCardId_fkey" FOREIGN KEY ("linkedCardId") REFERENCES "card_linked"."LinkedCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."Transaction" ADD CONSTRAINT "Transaction_merchantLocationId_fkey" FOREIGN KEY ("merchantLocationId") REFERENCES "card_linked"."MerchantLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."StampBalance" ADD CONSTRAINT "StampBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "card_linked"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."StampBalance" ADD CONSTRAINT "StampBalance_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "card_linked"."Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."StampLedger" ADD CONSTRAINT "StampLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "card_linked"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_linked"."StampLedger" ADD CONSTRAINT "StampLedger_userId_merchantId_fkey" FOREIGN KEY ("userId", "merchantId") REFERENCES "card_linked"."StampBalance"("userId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants are enforced even for writes outside this service.
ALTER TABLE "card_linked"."Merchant"
    ADD CONSTRAINT "Merchant_positive_threshold" CHECK ("stampThresholdMinor" > 0),
    ADD CONSTRAINT "Merchant_currency" CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE "card_linked"."Transaction"
    ADD CONSTRAINT "Transaction_positive_amount" CHECK ("amountMinor" > 0),
    ADD CONSTRAINT "Transaction_positive_threshold" CHECK ("stampThresholdMinor" > 0),
    ADD CONSTRAINT "Transaction_currency" CHECK (currency = 'GBP'),
    ADD CONSTRAINT "Transaction_status" CHECK (status = 'PROVISIONAL');
ALTER TABLE "card_linked"."StampLedger"
    ADD CONSTRAINT "StampLedger_nonnegative" CHECK (stamps >= 0);
ALTER TABLE "card_linked"."StampBalance"
    ADD CONSTRAINT "StampBalance_nonnegative" CHECK (provisional >= 0);

-- Dedicated backend schema. No browser/anonymous access or public API exposure.
REVOKE ALL ON SCHEMA "card_linked" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "card_linked" FROM PUBLIC;
