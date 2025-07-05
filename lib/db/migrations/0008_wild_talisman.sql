ALTER TABLE "Chat" ADD COLUMN "modelType" varchar DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "examType";