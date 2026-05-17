import { HideoutProgressCard } from "@/features/settings/HideoutProgressCard";
import { StorageResetCard } from "@/features/settings/StorageResetCard";
import { ItemProgressConversionCard } from "@/features/settings/ItemProgressConversionCard";

export default function SettingsPage() {
    return (
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-2xl space-y-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Settings</h1>
            <HideoutProgressCard />
            <StorageResetCard />
            <ItemProgressConversionCard />
        </div>
    );
}
