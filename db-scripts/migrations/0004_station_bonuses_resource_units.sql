-- Station level bonuses (validated AdditionalSlots / FuelConsumption) and resource capacity
-- (fuel tanks). Additive and nullable: existing rows stay valid until the next catalog update.
ALTER TABLE station_levels ADD COLUMN IF NOT EXISTS bonuses jsonb;
ALTER TABLE item_modes ADD COLUMN IF NOT EXISTS resource_units numeric;
