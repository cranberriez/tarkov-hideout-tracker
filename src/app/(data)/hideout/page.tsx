import { getHideoutStations } from "@/server/services/hideout";
import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";

export const revalidate = 43200; // 12 hours

export default async function HideoutPage() {
	let stations: import("@/types").Station[] | null = null;
	let stationsUpdatedAt: number | null = null;

	try {
		const response = await getHideoutStations();
		stations = response.data.stations;
		stationsUpdatedAt = response.updatedAt;
	} catch (error) {
		console.error("Failed to fetch hideout stations in HideoutPage", error);
	}

	return <HideoutClientPage stations={stations} stationsUpdatedAt={stationsUpdatedAt} />;
}
