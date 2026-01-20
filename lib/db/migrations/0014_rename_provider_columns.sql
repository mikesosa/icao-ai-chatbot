-- Rename rebill columns to generic provider columns
ALTER TABLE "Subscription" RENAME COLUMN "rebillCustomerId" TO "providerCustomerId";
ALTER TABLE "Subscription" RENAME COLUMN "rebillSubscriptionId" TO "providerSubscriptionId";
