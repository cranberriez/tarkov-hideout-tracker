"use client";

import { ArchiveRestore } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStoreHydrated } from "@/lib/query/game-data";

/** Shown after the conversion dialog is closed without Skip or Confirm. */
export function LegacyProfileConversionBanner() {
	const hydrated = useUserStoreHydrated();
	const { isPending, dismiss } = useUserStore(
		useShallow((state) => ({
			isPending:
				state.deprecatedLegacyState !== null &&
				!state.hasConvertedDeprecatedLegacyState &&
				!state.hasDismissedDeprecatedLegacyState,
			dismiss: state.dismissDeprecatedLegacyState,
		})),
	);
	const { isDeferred, isOpen, open } = useUIStore(
		useShallow((state) => ({
			isDeferred: state.isLegacyProfileConversionDeferred,
			isOpen: state.isLegacyProfileConversionOpen,
			open: state.setLegacyProfileConversionOpen,
		})),
	);

	if (!hydrated || !isPending || !isDeferred || isOpen) return null;

	return (
		<aside aria-label="Old profile data" className="border-b border-brand/25 bg-brand/10">
			<div className="container mx-auto flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
				<div className="flex items-start gap-2 text-sm text-foreground sm:items-center">
					<ArchiveRestore aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand sm:mt-0" />
					<p className="leading-5">
						<span className="font-semibold">You have old profile data that hasn&apos;t been restored.</span> Convert it
						into a PVP, PVE, or KORD profile.
					</p>
				</div>
				<div className="ml-6 flex shrink-0 items-center gap-2 sm:ml-0">
					<button
						type="button"
						onClick={dismiss}
						className="rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
					>
						Ignore
					</button>
					<button
						type="button"
						onClick={() => open(true)}
						className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-inverse transition-colors hover:bg-brand-hover"
					>
						Convert profile
					</button>
				</div>
			</div>
		</aside>
	);
}
