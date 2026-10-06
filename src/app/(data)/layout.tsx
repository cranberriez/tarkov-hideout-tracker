import type { ReactNode } from "react";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";

interface DataLayoutProps {
	children: ReactNode;
}

export default function DataLayout({ children }: DataLayoutProps) {
	return (
		<>
			{children}
			<RouteAwareFooter />
			<LegacyProfileConversionDialog />
		</>
	);
}
