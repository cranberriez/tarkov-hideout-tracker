import type { NormalizedEntityReference } from "./common";

export interface Trader extends NormalizedEntityReference {
    imageLink?: string | null;
    image4xLink?: string | null;
}
