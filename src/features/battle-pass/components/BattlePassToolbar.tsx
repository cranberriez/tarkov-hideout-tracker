import { Flag, Layers, Rows3, Map as MapIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Toggle } from "./ui/Toggle";

export function BattlePassToolbar({
	scope,
	setScope,
	goalCount,
	useClassified,
	setUseClassified,
	showPossibleProgress,
	setShowPossibleProgress,
	cumulative,
	setCumulative,
	listMode,
	setListMode,
	showMaps,
	setShowMaps,
}: {
	scope: "all" | "goals";
	setScope: (scope: "all" | "goals") => void;
	goalCount: number;
	useClassified: boolean;
	setUseClassified: (checked: boolean) => void;
	showPossibleProgress: boolean;
	setShowPossibleProgress: (checked: boolean) => void;
	cumulative: boolean;
	setCumulative: (checked: boolean) => void;
	listMode: boolean;
	setListMode: (checked: boolean) => void;
	showMaps: boolean;
	setShowMaps: (show: boolean) => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex gap-1" role="group" aria-label="Plan scope">
					<Button
						variant="ghost"
						selected={scope === "goals"}
						aria-pressed={scope === "goals"}
						onClick={() => setScope("goals")}
					>
						<Flag size={14} />
						Goals {goalCount > 0 && `· ${goalCount}`}
					</Button>
					<Button
						variant="ghost"
						selected={scope === "all"}
						aria-pressed={scope === "all"}
						onClick={() => setScope("all")}
					>
						Everything
					</Button>
				</div>
				<span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
				<Toggle
					checked={useClassified}
					onChange={setUseClassified}
					title="Allocate owned classified documents once across this plan after ordinary inventory."
				>
					Use classified
				</Toggle>
				<Toggle
					checked={cumulative}
					onChange={setCumulative}
					icon={<Layers size={14} />}
					title="Cheapest path to each reward from completed progress, before inventory. Each card is an independent preview."
				>
					Cumulative costs
				</Toggle>
				<Toggle
					checked={showPossibleProgress}
					onChange={setShowPossibleProgress}
					title="Preview owned documents across the plan in page order. Green checks show fully covered rewards; yellow marks and bars show possible progress. No documents are spent."
				>
					Possible progress
				</Toggle>
				<Toggle
					checked={listMode}
					onChange={setListMode}
					icon={<Rows3 size={14} />}
					title="Show every page in one long list instead of the paged gallery."
				>
					List view
				</Toggle>
				<Button
					variant="ghost"
					aria-expanded={showMaps}
					aria-controls="document-locations-panel"
					onClick={() => setShowMaps(!showMaps)}
				>
					<MapIcon size={15} />
					Locations
					<ChevronDown size={13} className={cn("transition-transform", showMaps && "rotate-180")} />
				</Button>
			</div>
		</div>
	);
}
