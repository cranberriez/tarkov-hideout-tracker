import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";

export const revalidate = 43200; // 12 hours

export default function HideoutPage() {
    return <HideoutClientPage />;
}
