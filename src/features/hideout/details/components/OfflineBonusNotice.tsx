import { DataNotice } from "@/components/ui/data-notice";
import { STATION_IDS } from "@/lib/data/static-stations";

/** Known game bug: consumption bonuses only apply while the player is online. */
const NOTICES: Record<string, string> = {
	[STATION_IDS.generator]:
		"Solar Power and Hideout Management don't reduce fuel burn while you're offline, so tanks run out sooner than these estimates.",
	[STATION_IDS["solar-power"]]:
		"Solar Power doesn't reduce Generator fuel burn while you're offline, so tanks run out sooner than expected.",
	[STATION_IDS["air-filtering-unit"]]:
		"Hideout Management doesn't reduce air filter use while you're offline, so filters run out sooner than expected.",
	[STATION_IDS["water-collector"]]:
		"Hideout Management doesn't reduce water filter use while you're offline, so filters run out sooner than expected.",
};

export function OfflineBonusNotice({ stationId }: { stationId: string }) {
	const message = NOTICES[stationId];
	if (!message) return null;
	return (
		<div>
			<DataNotice className="border-warning/20 bg-warning/[0.04]">
				<span className="font-semibold">Known game bug:</span>{" "}
				<span className="text-foreground/80">{message}</span>
			</DataNotice>
		</div>
	);
}
