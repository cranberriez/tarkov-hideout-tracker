import {
    ChevronRight,
    Crosshair,
    DoorOpen,
    Hammer,
    MapPin,
    Package,
    Search,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OBJECTIVE_TYPE_LABELS: Record<string, string> = {
    giveItem: "Hand in items",
    plantItem: "Plant items",
    findItem: "Find items",
    findQuestItem: "Find quest item",
    pickupQuestItem: "Pick up quest item",
    shoot: "Eliminate targets",
    extract: "Extract",
    visit: "Visit location",
    mark: "Mark location",
    locate: "Locate objective",
    buildItem: "Build item",
    useItem: "Use item",
    skill: "Skill objective",
    playerLevel: "Player level",
};

export function getQuestObjectiveTypeLabel(type: string) {
    return OBJECTIVE_TYPE_LABELS[type] ?? "Quest objective";
}

export function QuestObjectiveIcon({
    type,
    size = 13,
    className,
}: {
    type: string;
    size?: number;
    className?: string;
}) {
    const sharedClassName = cn("shrink-0", className);

    switch (type) {
        case "giveItem":
        case "plantItem":
            return <Package size={size} className={cn("text-tarkov-green/60", sharedClassName)} aria-hidden="true" />;
        case "findItem":
        case "findQuestItem":
        case "pickupQuestItem":
            return <Search size={size} className={cn("text-blue-400/60", sharedClassName)} aria-hidden="true" />;
        case "shoot":
            return <Crosshair size={size} className={cn("text-red-400/60", sharedClassName)} aria-hidden="true" />;
        case "extract":
            return <DoorOpen size={size} className={cn("text-yellow-400/60", sharedClassName)} aria-hidden="true" />;
        case "visit":
        case "mark":
        case "locate":
            return <MapPin size={size} className={cn("text-purple-400/60", sharedClassName)} aria-hidden="true" />;
        case "buildItem":
            return <Hammer size={size} className={cn("text-orange-400/60", sharedClassName)} aria-hidden="true" />;
        case "useItem":
        case "skill":
        case "playerLevel":
            return <Zap size={size} className={cn("text-cyan-400/60", sharedClassName)} aria-hidden="true" />;
        default:
            return <ChevronRight size={size} className={cn("text-gray-600", sharedClassName)} aria-hidden="true" />;
    }
}
