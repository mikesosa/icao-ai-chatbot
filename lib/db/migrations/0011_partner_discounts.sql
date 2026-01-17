CREATE TABLE IF NOT EXISTS "PartnerDiscount" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partnerSlug" varchar(64) NOT NULL,
  "code" varchar(64) NOT NULL,
  "discountType" varchar(16) NOT NULL,
  "discountValue" varchar(32) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "startsAt" timestamp,
  "expiresAt" timestamp,
  "maxRedemptions" varchar(16),
  "maxRedemptionsPerUser" varchar(16),
  "eligiblePlans" json,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "DiscountRedemption" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discountId" uuid NOT NULL REFERENCES "PartnerDiscount"("id"),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "redeemedAt" timestamp NOT NULL
);
