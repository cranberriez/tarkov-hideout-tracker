"use client";

import { useBattlePassData } from "./BattlePassSeason";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { buttonClassName } from "@/components/ui/button";

const BattlePassMapView = dynamic(
	() => import("./components/BattlePassMapView").then((module) => module.BattlePassMapView),
	{
		ssr: false,
		loading: LoadingMap,
	},
);

function LoadingMap() {
	const { seasonId } = useBattlePassData();
	return (
		<div className="flex h-dvh flex-col items-center justify-center gap-4 p-6">
			<p role="status" className="text-sm text-muted-foreground">
				Loading document map…
			</p>
			<Link href={"/battle-pass?season=" + seasonId} className={buttonClassName()}>
				Back to Battle Pass
			</Link>
		</div>
	);
}

export function BattlePassMapPage() {
	const { seasonId } = useBattlePassData();
	const router = useRouter();
	// Keep the map entry available to browser Back, including after a direct visit.
	const close = useCallback(() => router.push("/battle-pass?season=" + seasonId), [router, seasonId]);
	return (
		<main className="h-dvh w-full overflow-hidden">
			<BattlePassMapView onClose={close} />
		</main>
	);
}
