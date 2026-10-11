"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { buttonClassName } from "@/components/ui/button";

const BattlePassMapView = dynamic(
	() => import("./components/BattlePassMapView").then((module) => module.BattlePassMapView),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-dvh flex-col items-center justify-center gap-4 p-6">
				<p role="status" className="text-sm text-muted-foreground">
					Loading document map…
				</p>
				<Link href="/battle-pass" className={buttonClassName()}>
					Back to Battle Pass
				</Link>
			</div>
		),
	},
);

export function BattlePassMapPage() {
	const router = useRouter();
	// Keep the map entry available to browser Back, including after a direct visit.
	const close = useCallback(() => router.push("/battle-pass"), [router]);
	return (
		<main className="h-dvh w-full overflow-hidden">
			<BattlePassMapView onClose={close} />
		</main>
	);
}
