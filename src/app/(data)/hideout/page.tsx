import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";

export const revalidate = 1209600; // 14 days; tag revalidation handles freshness

export default function HideoutPage() {
    return <HideoutClientPage />;
}
