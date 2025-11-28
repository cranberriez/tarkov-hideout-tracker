import { getHideoutStations } from "@/server/services/hideout";
import { getHideoutRequiredItems } from "@/server/services/items";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200; // 12 hours

export default async function ItemsPage() {
    let stations: import("@/types").Station[] | null = null;
    let stationsUpdatedAt: number | null = null;
    let items: import("@/types").ItemDetails[] | null = null;
    let itemsUpdatedAt: number | null = null;

    try {
        const response = await getHideoutStations();
        stations = response.data.stations;
        stationsUpdatedAt = response.updatedAt;
    } catch (error) {
        console.error("Failed to fetch hideout stations in ItemsPage", error);
    }

    try {
        const itemsResponse = await getHideoutRequiredItems({ revalidateSeconds: revalidate });
        items = itemsResponse.data.items;
        itemsUpdatedAt = itemsResponse.updatedAt;
    } catch (error) {
        console.error("Failed to fetch hideout items in ItemsPage", error);
    }

    return (
        <main className="container mx-auto px-6 py-8">
            <ItemsClientPage
                stations={stations}
                stationsUpdatedAt={stationsUpdatedAt}
                items={items}
                itemsUpdatedAt={itemsUpdatedAt}
            />
        </main>
    );
}
