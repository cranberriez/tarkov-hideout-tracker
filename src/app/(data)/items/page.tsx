import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200; // 12 hours

export default function ItemsPage() {
    return (
        <main className="container mx-auto px-6 py-8">
            <ItemsClientPage />
        </main>
    );
}
