import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SyncPage } from "@/features/sync/SyncPage";
import { isSyncEnabled } from "@/server/sync-enabled";

export const dynamic = "force-dynamic";

export default function SyncRoute() {
	if (!isSyncEnabled()) notFound();
	return <SyncPage />;
}

export const metadata: Metadata = { title: "Sync", robots: { index: false, follow: true } };
