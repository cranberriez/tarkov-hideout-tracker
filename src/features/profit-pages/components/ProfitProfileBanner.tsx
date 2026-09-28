import Link from "next/link";
import { Info } from "lucide-react";
import { openCharacterPanel } from "@/components/core/PlayerProfileMenu";
import type { ProfileLockGap } from "../utils/lock-summary";

const actionClass =
	"rounded border border-highlight/15 px-2 py-1 font-medium transition hover:border-brand/50 hover:text-brand";

/** Explains profile-wide locks once, so rows only carry recipe-specific requirements. */
export function ProfitProfileBanner({
	gaps,
	onHideLocked,
	onSetTraders,
}: {
	gaps: ProfileLockGap[];
	onHideLocked: () => void;
	onSetTraders: () => void;
}) {
	if (!gaps.length) return null;
	return (
		<div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-foreground/85">
			<Info className="size-4 shrink-0 text-warning" aria-hidden />
			<span className="min-w-[12rem] flex-1">
				Showing every recipe, including ones your profile can&apos;t use yet.{" "}
				<span className="text-muted-foreground">
					Your profile:{" "}
					<strong className="font-semibold text-warning">{gaps.map((gap) => gap.label).join(" · ")}</strong>
				</span>
			</span>
			<span className="flex shrink-0 flex-wrap items-center gap-2">
				{gaps.map((gap) =>
					gap.key === "player" ? (
						<button key={gap.key} type="button" onClick={openCharacterPanel} className={actionClass}>
							Set PMC level
						</button>
					) : gap.key === "hideout" ? (
						<Link key={gap.key} href="/hideout" className={actionClass}>
							Set hideout levels
						</Link>
					) : (
						<button key={gap.key} type="button" onClick={onSetTraders} className={actionClass}>
							Set trader levels
						</button>
					),
				)}
				<button type="button" onClick={onHideLocked} className={actionClass}>
					Hide locked
				</button>
			</span>
		</div>
	);
}
