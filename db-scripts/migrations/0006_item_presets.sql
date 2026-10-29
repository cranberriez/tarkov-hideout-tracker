-- Provider item types, each gun's default preset and preset contents (parts and counts).
-- Additive and nullable: existing rows stay valid until the next catalog update.
ALTER TABLE item_modes ADD COLUMN IF NOT EXISTS item_types text[];
ALTER TABLE item_modes ADD COLUMN IF NOT EXISTS default_preset_id text;
ALTER TABLE item_modes ADD COLUMN IF NOT EXISTS preset_contents jsonb;
