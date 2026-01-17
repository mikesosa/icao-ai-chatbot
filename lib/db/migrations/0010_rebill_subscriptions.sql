CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "status" varchar(32) NOT NULL,
  "planId" varchar(64),
  "rebillCustomerId" varchar(64),
  "rebillSubscriptionId" varchar(64),
  "currentPeriodEnd" timestamp,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
