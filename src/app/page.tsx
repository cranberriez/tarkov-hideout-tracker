import { permanentRedirect } from "next/navigation";
import { modeHref } from "@/lib/entity-routes";
import { DEFAULT_GAME_MODE } from "@/lib/game-mode";

/** The proxy sends `/` to the saved mode's Hideout first; this is the cookie-free fallback. */
export default function Home() {
	permanentRedirect(modeHref(DEFAULT_GAME_MODE, "/hideout"));
}
