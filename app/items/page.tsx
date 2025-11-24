import { ItemsList } from "../features/items/components/ItemsList";
import { ItemsControls } from "../features/items/components/ItemsControls";

export default function ItemsPage() {
    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border-color pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">ITEM CHECKLIST</h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Aggregated list of items required for your hideout upgrades
                    </p>
                </div>
                <div className="w-full md:w-auto">
                    <ItemsControls />
                </div>
            </div>

            <ItemsList />
        </main>
    );
}
