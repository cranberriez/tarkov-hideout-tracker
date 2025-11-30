import type { ReactNode } from "react";
import { getHideoutStations } from "@/server/services/hideout";
import { getHideoutRequiredItems } from "@/server/services/items";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const [stations, items ] = await Promise.all([
        getHideoutStations(),
        getHideoutRequiredItems(),
    ]);
    return (children);
}
