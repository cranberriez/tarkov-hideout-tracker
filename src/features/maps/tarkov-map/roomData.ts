import { maps } from "./catalog";
import type { MapRoom } from "./rooms";
import customs from "./floor-data/customs.json";
import factory from "./floor-data/factory.json";
import groundZero from "./floor-data/ground-zero.json";
import interchange from "./floor-data/interchange.json";
import reserve from "./floor-data/reserve.json";
import shoreline from "./floor-data/shoreline.json";
import streetsOfTarkov from "./floor-data/streets-of-tarkov.json";
import theLab from "./floor-data/the-lab.json";

/**
 * Floor rooms by map art, from floor-data/<art>.json (drawn on the dev Floors page). Attaching them to the shared
 * calibration means every game map using that art (Ground Zero and 21+, …) takes its floors from them.
 */
const files = [customs, factory, groundZero, interchange, reserve, shoreline, streetsOfTarkov, theLab] as unknown as { map: string; rooms: MapRoom[] }[];
for (const data of files) setRooms(data.map, data.rooms);

/** Replaces an art's rooms; the dev Floors page calls this as it saves, so the map shows edits without a reload. */
export function setRooms(art: string, rooms: MapRoom[]) {
  const map = maps[art];
  if (!map) return;
  // Only what matching needs: the dataset's own fields (ids, copy links) stay out of the calibration.
  map.rooms = rooms.map(({ floor, zone, height, rect, area }) => ({ floor, zone, height, ...rect ? { rect } : {}, ...area ? { area } : {} }));
}
