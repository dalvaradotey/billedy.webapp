-- Add is_external_debt flag to card_purchases table
-- This flag marks purchases made for others (family, etc.) that shouldn't count against personal debt limit
ALTER TABLE "n1n4_card_purchases" ADD COLUMN "is_external_debt" boolean DEFAULT false NOT NULL;
