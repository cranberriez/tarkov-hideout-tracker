import type { Metadata } from "next";
import { SyncPage } from "@/features/sync/SyncPage";

export default function SyncRoute() {
	return <SyncPage />;
}

export const metadata: Metadata = { title: "Sync", robots: { index: false, follow: true } };
