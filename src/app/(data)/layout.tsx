import type { ReactNode } from "react";
import { LegacyProfileConversionBanner } from "@/features/profile-conversion/LegacyProfileConversionBanner";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { CompanionSyncController } from "@/features/sync/CompanionSyncController";

interface DataLayoutProps {
	children: ReactNode;
}

export default function DataLayout({ children }: DataLayoutProps) {
	return (
		<>
			<LegacyProfileConversionBanner />
			{/* Grows to fill short pages so the footer stays at the viewport bottom. */}
			<div className="page-content flex min-h-0 flex-1 flex-col">
				<div className="page-content-side" aria-hidden="true" />
				{children}
				<div className="page-content-side" aria-hidden="true" />
			</div>
			<RouteAwareFooter />
			<LegacyProfileConversionDialog />
			<CompanionSyncController />
		</>
	);
}
