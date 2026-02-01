-- Add new values to entity_type enum
-- PostgreSQL requires ALTER TYPE to add new enum values

ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'hardware_store';
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'mechanic';
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'streaming';
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'grocery_store';
