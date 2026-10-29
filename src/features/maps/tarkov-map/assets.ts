import { createContext, useContext } from "react";
import { ASSET_HOST, TILE_HOST } from "./hosts";
import { mapIcons } from "./icons";

/** Where map images load from; provide your own through `MapAssetsContext` to cache or proxy them. */
export type MapAssets = {
  /** A tile path from the calibration. */
  tile(path: string): string;
  /** A tarkov.dev item's icon. */
  item(id: string): string;
  /** An image link from the data (boss portraits, category icons). */
  link(url: string): string;
};

/** Straight from tarkov.dev. */
export const webAssets: MapAssets = {
  tile: (path) => TILE_HOST + path,
  item: (id) => `${ASSET_HOST}${id}-512.webp`,
  link: (url) => url,
};

export const MapAssetsContext = createContext<MapAssets>(webAssets);

/** Image URL for an icon key: a bundled file stem (`src/maps/assets/icons`), `item:<id>`, or an image link. */
export const iconUrl = (assets: MapAssets, icon: string): string | undefined =>
  icon.startsWith("item:") ? assets.item(icon.slice(5)) : /^https?:\/\//.test(icon) ? assets.link(icon) : mapIcons[icon];

/** The assets in context, with `icon` resolving icon keys (see `iconUrl`). */
export function useMapAssets() {
  const assets = useContext(MapAssetsContext);
  return { ...assets, icon: (key: string) => iconUrl(assets, key) };
}
