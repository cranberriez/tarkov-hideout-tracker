import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default function HideoutPage() {
    return <HideoutClientPage />;
}
