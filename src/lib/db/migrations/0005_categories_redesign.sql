-- Categories redesign: project-specific instead of user-specific

-- Drop category_templates table
DROP TABLE IF EXISTS "n1n4_category_templates";

-- Add project_id to categories (will be null initially for existing data)
ALTER TABLE "n1n4_categories" ADD COLUMN "project_id" uuid;

-- Add foreign key constraint for project_id
ALTER TABLE "n1n4_categories" ADD CONSTRAINT "n1n4_categories_project_id_n1n4_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;

-- Drop user_id column and its foreign key
ALTER TABLE "n1n4_categories" DROP CONSTRAINT IF EXISTS "n1n4_categories_user_id_n1n4_users_id_fk";
ALTER TABLE "n1n4_categories" DROP COLUMN IF EXISTS "user_id";

-- Drop type column
ALTER TABLE "n1n4_categories" DROP COLUMN IF EXISTS "type";

-- Drop group column
ALTER TABLE "n1n4_categories" DROP COLUMN IF EXISTS "group";

-- Make project_id not null (after you've migrated any existing data or deleted orphan categories)
-- Note: Run this manually after ensuring all categories have a project_id
-- ALTER TABLE "n1n4_categories" ALTER COLUMN "project_id" SET NOT NULL;
