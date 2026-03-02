CREATE TABLE IF NOT EXISTS "Waitlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "source" varchar(50) DEFAULT 'landing',
  CONSTRAINT "Waitlist_email_unique" UNIQUE("email")
);
