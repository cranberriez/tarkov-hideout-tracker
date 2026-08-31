import { Circle, Crosshair, DoorOpen, Hammer, MapPin, Package, Search } from "lucide-react";
import {
    OBJECTIVE_CATEGORY_SHORT_LABELS,
    type QuestObjectiveCategory,
} from "./quest-workspace-utils";

const TYPE_ICONS = {
    "hand-in": Package,
    find: Search,
    plant: MapPin,
    eliminate: Crosshair,
    extract: DoorOpen,
    location: MapPin,
    build: Hammer,
    use: Package,
    other: Circle,
} satisfies Record<QuestObjectiveCategory, typeof Circle>;

export function QuestObjectiveTypeTag({ category }: { category: QuestObjectiveCategory }) {
    const Icon = TYPE_ICONS[category];
    return (
        <span className="flex shrink-0 items-center gap-1">
            <Icon size={10} /> {OBJECTIVE_CATEGORY_SHORT_LABELS[category]}
        </span>
    );
}
