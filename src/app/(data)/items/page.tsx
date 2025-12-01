import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200; // 12 hours

export default function ItemsPage() {
    return <ItemsClientPage />;
}
