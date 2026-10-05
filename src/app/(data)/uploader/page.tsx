import type { Metadata } from "next";
import { UploaderClientPage } from "@/features/uploader/UploaderClientPage";

export const metadata: Metadata = {
	title: "Screenshot uploader",
	robots: { index: false, follow: false },
};

export default function UploaderPage() {
	return <UploaderClientPage />;
}
