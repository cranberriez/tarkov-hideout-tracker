import type { Metadata } from "next";
import { UploaderClientPage } from "@/features/uploader/UploaderClientPage";

export const metadata: Metadata = {
	title: "Loot Scanner",
	description:
		"Scan an Escape from Tarkov stash or container screenshot to identify items and see what to keep for hideout and quests, and what to sell.",
	alternates: { canonical: "/uploader" },
};

export default function UploaderPage() {
	return <UploaderClientPage />;
}
