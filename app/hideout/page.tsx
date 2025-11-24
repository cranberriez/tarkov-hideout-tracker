import { HideoutList } from "../features/hideout/components/HideoutList";

export default function HideoutPage() {
    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex justify-between items-end border-b border-border-color pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        HIDEOUT STATIONS
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Manage your current station levels to calculate required items
                    </p>
                </div>
                {/* Optional controls like 'Compact' view could go here */}
                <div>
                    {/* <button className="text-xs font-bold border border-border-color px-3 py-2 rounded hover:bg-white/5 uppercase tracking-widest">
                        Compact
                    </button> */}
                </div>
            </div>

            <HideoutList />
        </main>
    );
}
