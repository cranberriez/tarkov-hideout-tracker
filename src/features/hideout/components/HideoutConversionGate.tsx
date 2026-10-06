"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { CompletedItemsConversionModal } from "@/features/items/components/CompletedItemsConversionModal";
import type { Station } from "@/types/hideout";

interface HideoutConversionGateProps {
	stations: Station[];
}

export function HideoutConversionGate({ stations }: HideoutConversionGateProps) {
	const { stationLevels, completedRequirements, hasSeenItemConversionModal, setHasSeenItemConversionModal } =
		useUserStore(
			useShallow((state) => ({
				stationLevels: state.stationLevels,
				completedRequirements: state.completedRequirements,
				hasSeenItemConversionModal: state.hasSeenItemConversionModal,
				setHasSeenItemConversionModal: state.setHasSeenItemConversionModal,
			})),
		);

	const hasConvertible = useMemo(() => {
		return stations.some((station) => {
			const currentLevel = stationLevels[station.id] ?? 0;

			return station.levels.some((level) => {
				if (currentLevel >= level.level) return false;

				return level.itemRequirements.some((req) => completedRequirements[req.id]);
			});
		});
	}, [stations, stationLevels, completedRequirements]);

	const isOpen = hasConvertible && !hasSeenItemConversionModal;

	if (!isOpen) return null;

	return <CompletedItemsConversionModal isOpen={true} onClose={() => setHasSeenItemConversionModal(true)} />;
}
