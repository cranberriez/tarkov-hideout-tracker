/** Bundled icon file stems in `public/maps/icons`. */
const ICONS = ["btr_stop","container_buried-barrel-cache","container_cash-register","container_crate","container_dead-scav","container_drawer","container_duffle-bag","container_festive-airdrop-supply-crate","container_grenade-box","container_ground-cache","container_jacket","container_medbag","container_medcase","container_pc-block","container_plastic-suitcase","container_safe","container_toolbox","container_weapon-box","container_wooden-ammo-box","container_wooden-crate","extract_pmc","extract_scav","extract_shared","extract_transit","hazard","hazard_mortar","key","keycard","lock","loose_loot","player-position-no-rotation","player-position","quest_item","quest_objective","spawn_af","spawn_black-div","spawn_bloodhound","spawn_boss","spawn_cultist-priest","spawn_pmc","spawn_rogue","spawn_scav","spawn_sniper_scav","stationarygun","switch"];

/** Icon URLs by file stem, e.g. `mapIcons["extract_pmc"]`, `mapIcons["container_safe"]`. */
export const mapIcons: Record<string, string> = Object.fromEntries(ICONS.map((stem) => [stem, `/maps/icons/${stem}.png`]));

/** Icon for a tarkov.dev loot container `normalizedName`, when one exists. */
export const containerIcon = (normalizedName: string): string | undefined => mapIcons[`container_${normalizedName}`];
