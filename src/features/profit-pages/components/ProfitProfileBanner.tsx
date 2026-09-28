import Link from "next/link";
import { Info } from "lucide-react";
import type { ProfileLockGap } from "../utils/lock-summary";

/** Explains profile-wide locks once, so rows only carry recipe-specific requirements. */
export function ProfitProfileBanner({ gaps, onHideLocked }: { gaps: ProfileLockGap[]; onHideLocked: () => void }) {
	if (!gaps.length) return null;
	const links = [...new Map(gaps.map((gap) => [gap.href, gap])).values()];
	return (
		<div
			role="status"
			className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/25 bg-warning/[0.06] px-3 py-2 text-xs text-foreground/85"
		>
			<Info className="size-4 shrink-0 text-warning" aria-hidden />
			<span className="min-w-0 flex-1">
				Showing every recipe, including ones your profile can&apos;t use yet.{" "}
				<span className="text-muted-foreground">Your profile: {gaps.map((gap) => gap.label).join(" · ")}.</span>
			</span>
			<span className="flex shrink-0 flex-wrap items-center gap-2">
				{links.map((gap) => (
					<Link
						key={gap.href}
						href={gap.href}
						className="rounded border border-highlight/15 px-2 py-1 font-medium transition hover:border-brand/50 hover:text-brand"
					>
						{gap.href === "/hideout" ? "Set hideout levels" : "Set level & traders"}
					</Link>
				))}
				<button
					type="button"
					onClick={onHideLocked}
					className="rounded border border-highlight/15 px-2 py-1 font-medium transition hover:border-brand/50 hover:text-brand"
				>
					Hide locked
				</button>
			</span>
		</div>
	);
}
