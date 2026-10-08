import { redirect } from "next/navigation";

/** Higher or Lower is the only game for now. */
export default function GamesPage() {
	redirect("/games/higher-lower");
}
