// Battle Pass document locations, vendored from tarkov-mappinator (its `scripts/vendor-documents.mjs` and dev-only linker
// own the matching). A location ties to a tarkov.dev document spawn by position; `documents/links.json` holds hand-made
// links (a null link means the location is no spawn), which win over the script's, and can give the `floor` (id, as in
// floors.ts) where its height misleads. `documents/locked.json` says by hand whether a location is behind a lock.
// Photos are this app's own battle-pass map previews. Season-specific, like the preset.
import data from "./documents/locations.json";
import links from "./documents/links.json";
import lockedByHand from "./documents/locked.json";
import type { WorldPoint } from "./types";


export type DocumentLocation = {
  /** `<tarkovdoc map>/<tarkovdoc id>`. */
  id: string;
  /** tarkov.dev map keys it is on. */
  maps: string[];
  /** Document type key, as in the preset's `documents`. */
  type: string;
  title: string;
  description?: string;
  /** Key needed to reach it. */
  key?: string;
  /** Behind a lock: set by hand, else whether tarkovdoc names a key. */
  locked: boolean;
  /** `locked` was set by hand. */
  lockedByHand?: boolean;
  /** Public URL of its photo, one of the battle-pass map previews. */
  photo?: string;
  /** Where it is, when tied to a spawn (or placed by hand where tarkov.dev has none). */
  position?: WorldPoint;
  match?: "auto" | "manual";
  /** Floor id it is on, set by hand where its height misleads; otherwise its floor is found from its position. */
  floor?: string;
  /** Where the fit puts it, when not tied to a spawn; rough. */
  estimate?: WorldPoint;
};

export const documentSource = data.source;
const all = (data.locations as Omit<DocumentLocation, "locked">[]).map((location): DocumentLocation => {
  const byHand = (lockedByHand as Record<string, boolean>)[location.id];
  return { ...location, locked: byHand ?? !!location.key, ...byHand === undefined ? {} : { lockedByHand: true } };
});
const manual = links as Record<string, (WorldPoint & { floor?: string }) | null>;

/** Locations on a map, with hand-made links applied. */
export function documentLocations(mapKey: string): DocumentLocation[] {
  return all.filter((location) => location.maps.includes(mapKey)).map((location) => {
    // A hand link removed since the script last ran leaves the location unlinked, not at the old spot.
    if (!(location.id in manual) && location.match !== "manual") return location;
    const link = manual[location.id];
    const { position: _, match: __, ...rest } = location;
    if (!link) return rest;
    const { floor, ...position } = link;
    return { ...rest, position, match: "manual", ...floor ? { floor } : {} };
  });
}

export const documentPhoto = (location: Pick<DocumentLocation, "photo">): string | undefined => location.photo;
