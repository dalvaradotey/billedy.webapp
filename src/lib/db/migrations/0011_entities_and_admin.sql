-- Add isAdmin field to users table
ALTER TABLE "n1n4_users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;

-- Create entity type enum
DO $$ BEGIN
  CREATE TYPE "public"."entity_type" AS ENUM('bank', 'supermarket', 'pharmacy', 'store', 'restaurant', 'service', 'utility', 'government', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create entities table
CREATE TABLE IF NOT EXISTS "n1n4_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" "entity_type" NOT NULL,
  "image_url" varchar(500),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "n1n4_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
