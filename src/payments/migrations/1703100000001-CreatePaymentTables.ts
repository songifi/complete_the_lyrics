import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1703100000001 implements MigrationInterface {
  name = 'CreatePaymentTables1703100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_status_enum" AS ENUM(
        'pending', 
        'processing', 
        'succeeded', 
        'failed', 
        'cancelled', 
        'refunded', 
        'partially_refunded'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."transaction_type_enum" AS ENUM(
        'payment', 
        'refund', 
        'subscription', 
        'chargeback'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."payment_provider_enum" AS ENUM(
        'stripe', 
        'paypal'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."subscription_status_enum" AS ENUM(
        'active', 
        'inactive', 
        'cancelled', 
        'past_due', 
        'trialing', 
        'paused'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."billing_interval_enum" AS ENUM(
        'day', 
        'week', 
        'month', 
        'year'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."webhook_event_status_enum" AS ENUM(
        'pending', 
        'processing', 
        'processed', 
        'failed', 
        'skipped'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."webhook_provider_enum" AS ENUM(
        'stripe', 
        'paypal'
      )
    `);

    // Create payment_customers table
    await queryRunner.query(`
      CREATE TABLE "payment_customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "stripeCustomerId" character varying,
        "paypalCustomerId" character varying,
        "metadata" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_customers_stripeCustomerId" UNIQUE ("stripeCustomerId"),
        CONSTRAINT "PK_payment_customers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_customers_stripeCustomerId" ON "payment_customers" ("stripeCustomerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_customers_userId" ON "payment_customers" ("userId")
    `);

    // Create transactions table
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" uuid,
        "status" "public"."transaction_status_enum" NOT NULL DEFAULT 'pending',
        "type" "public"."transaction_type_enum" NOT NULL,
        "provider" "public"."payment_provider_enum" NOT NULL,
        "providerTransactionId" character varying NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "refundedAmount" numeric(10,2) NOT NULL DEFAULT '0',
        "currency" character varying(3) NOT NULL,
        "description" character varying,
        "providerData" jsonb,
        "metadata" jsonb,
        "auditTrail" jsonb,
        "failureReason" character varying,
        "failureCode" character varying,
        "fraudScore" jsonb,
        "isFlagged" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMP,
        CONSTRAINT "UQ_transactions_providerTransactionId" UNIQUE ("providerTransactionId"),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_provider" ON "transactions" ("provider")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_customerId" ON "transactions" ("customerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_providerTransactionId" ON "transactions" ("providerTransactionId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_createdAt" ON "transactions" ("createdAt")
    `);

    // Create subscriptions table
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" uuid NOT NULL,
        "providerSubscriptionId" character varying NOT NULL,
        "status" "public"."subscription_status_enum" NOT NULL DEFAULT 'active',
        "planId" character varying NOT NULL,
        "planName" character varying NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "billingInterval" "public"."billing_interval_enum" NOT NULL,
        "billingIntervalCount" integer NOT NULL,
        "currentPeriodStart" TIMESTAMP NOT NULL,
        "currentPeriodEnd" TIMESTAMP NOT NULL,
        "trialStart" TIMESTAMP,
        "trialEnd" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "cancelAtPeriodEnd" boolean,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscriptions_providerSubscriptionId" UNIQUE ("providerSubscriptionId"),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_status" ON "subscriptions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_customerId" ON "subscriptions" ("customerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_providerSubscriptionId" ON "subscriptions" ("providerSubscriptionId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_currentPeriodEnd" ON "subscriptions" ("currentPeriodEnd")
    `);

    // Create webhook_events table
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" "public"."webhook_provider_enum" NOT NULL,
        "providerEventId" character varying NOT NULL,
        "eventType" character varying NOT NULL,
        "status" "public"."webhook_event_status_enum" NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL,
        "processedData" jsonb,
        "errorMessage" character varying,
        "retryCount" integer NOT NULL DEFAULT '0',
        "maxRetries" integer NOT NULL DEFAULT '3',
        "processedAt" TIMESTAMP,
        "nextRetryAt" TIMESTAMP,
        "signatureHeader" character varying NOT NULL,
        "signatureVerified" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_webhook_events_providerEventId" UNIQUE ("providerEventId"),
        CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_provider" ON "webhook_events" ("provider")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_eventType" ON "webhook_events" ("eventType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_status" ON "webhook_events" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_providerEventId" ON "webhook_events" ("providerEventId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_createdAt" ON "webhook_events" ("createdAt")
    `);

    // Create idempotency_keys table
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "userId" uuid,
        "operation" character varying NOT NULL,
        "requestData" jsonb NOT NULL,
        "responseData" jsonb,
        "status" character varying NOT NULL DEFAULT 'pending',
        "expiresAt" TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_idempotency_keys_key" UNIQUE ("key"),
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_keys_key" ON "idempotency_keys" ("key")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_keys_userId" ON "idempotency_keys" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_keys_createdAt" ON "idempotency_keys" ("createdAt")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "payment_customers" 
      ADD CONSTRAINT "FK_payment_customers_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "FK_transactions_customerId" 
      FOREIGN KEY ("customerId") REFERENCES "payment_customers"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD CONSTRAINT "FK_subscriptions_customerId" 
      FOREIGN KEY ("customerId") REFERENCES "payment_customers"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_customerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_customerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_customers" DROP CONSTRAINT "FK_payment_customers_userId"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "payment_customers"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."webhook_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_event_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."billing_interval_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transaction_status_enum"`);
  }
}
