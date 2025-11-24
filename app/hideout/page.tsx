import { HideoutList } from "../features/hideout/components/HideoutList";
import { HideoutControls } from "../features/hideout/components/HideoutControls";

export default function HideoutPage() {
    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border-color pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        HIDEOUT STATIONS
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Manage your current station levels to calculate required items
                    </p>
                </div>
                <div className="w-full md:w-auto">
                    <HideoutControls />
                </div>
            </div>

            <HideoutList />
        </main>
    );
}
