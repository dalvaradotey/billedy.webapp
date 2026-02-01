-- Add entityId foreign key to accounts table
ALTER TABLE "n1n4_accounts"
ADD COLUMN "entity_id" UUID REFERENCES "n1n4_entities"("id") ON DELETE SET NULL;
