-- Recipe inputs are mirrored alongside JSON until readers migrate.
-- item_id deliberately permits synthetic, quest, and unresolved item references.

CREATE TABLE craft_inputs (
    craft_id text NOT NULL,
    mode text NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    input_kind text NOT NULL CHECK (input_kind IN ('item', 'quest')),
    position integer NOT NULL CHECK (position >= 0),
    item_id text NOT NULL CHECK (length(btrim(item_id)) > 0),
    count numeric NOT NULL CHECK (count > 0 AND count < 'Infinity'::numeric),
    is_tool boolean,
    PRIMARY KEY (craft_id, mode, input_kind, position),
    FOREIGN KEY (craft_id, mode) REFERENCES crafts(id, mode) ON DELETE CASCADE
);
CREATE INDEX craft_inputs_mode_item_idx ON craft_inputs(mode, item_id, craft_id);

INSERT INTO craft_inputs (craft_id, mode, input_kind, position, item_id, count, is_tool)
SELECT r.id, r.mode, 'item', (i.ordinality - 1)::integer,
       i.value->>'itemId', (i.value->>'count')::numeric, (i.value->>'isTool')::boolean
FROM crafts r CROSS JOIN LATERAL jsonb_array_elements(r.required_items) WITH ORDINALITY AS i(value, ordinality);

INSERT INTO craft_inputs (craft_id, mode, input_kind, position, item_id, count, is_tool)
SELECT r.id, r.mode, 'quest', (i.ordinality - 1)::integer,
       i.value->>'itemId', (i.value->>'count')::numeric, (i.value->>'isTool')::boolean
FROM crafts r CROSS JOIN LATERAL jsonb_array_elements(r.required_quest_items) WITH ORDINALITY AS i(value, ordinality);

CREATE TABLE barter_inputs (
    barter_id text NOT NULL,
    mode text NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    
    position integer NOT NULL CHECK (position >= 0),
    item_id text NOT NULL CHECK (length(btrim(item_id)) > 0),
    count numeric NOT NULL CHECK (count > 0 AND count < 'Infinity'::numeric),
    is_tool boolean,
    PRIMARY KEY (barter_id, mode, position),
    FOREIGN KEY (barter_id, mode) REFERENCES barters(id, mode) ON DELETE CASCADE
);
CREATE INDEX barter_inputs_mode_item_idx ON barter_inputs(mode, item_id, barter_id);

INSERT INTO barter_inputs (barter_id, mode, position, item_id, count, is_tool)
SELECT r.id, r.mode, (i.ordinality - 1)::integer,
       i.value->>'itemId', (i.value->>'count')::numeric, (i.value->>'isTool')::boolean
FROM barters r CROSS JOIN LATERAL jsonb_array_elements(r.required_items) WITH ORDINALITY AS i(value, ordinality);
