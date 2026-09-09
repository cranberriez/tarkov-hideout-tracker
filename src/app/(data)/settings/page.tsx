import { PlayerProgressCard } from "@/features/settings/PlayerProgressCard";
import { StorageResetCard } from "@/features/settings/StorageResetCard";
import { ItemProgressConversionCard } from "@/features/settings/ItemProgressConversionCard";
import { LegacyProfileConversionCard } from "@/features/settings/LegacyProfileConversionCard";

export default function SettingsPage() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
			<header className="flex items-end justify-between gap-4 border-b border-[var(--brand)]/20 pb-5">
				<div>
					<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">Profile & storage</p>
					<h1 className="text-2xl font-semibold text-foreground">Settings</h1>
					<p className="mt-2 text-xs text-muted-foreground">Keep your progress safe. Manage what stays on this device.</p>
				</div>
				<span className="hidden rounded border border-highlight/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-subtle-foreground sm:block">
					Local storage
				</span>
			</header>
			<PlayerProgressCard />
			<details className="group rounded-lg border border-highlight/10 bg-card">
				<summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground">
					Legacy data & conversion{" "}
					<span className="ml-2 text-xs font-normal text-subtle-foreground">Tools for older saved progress</span>
				</summary>
				<div className="grid gap-3 border-t border-highlight/10 p-3 sm:grid-cols-2">
					<LegacyProfileConversionCard />
					<ItemProgressConversionCard />
				</div>
			</details>
			<StorageResetCard />
		</div>
	);
}
