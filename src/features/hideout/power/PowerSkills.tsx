"use client";

import { useId } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SkillRow } from "@/features/profit-pages/components/CraftingSettings";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { hideoutManagementConsumptionReduction } from "@/lib/price-calculation/craft-rules";
import { useUserStore } from "@/lib/stores/useUserStore";

export function PowerSkills() {
	const mode = useUserStore((state) => state.gameMode);
	const options = useProfitOptions(mode);
	const id = useId();
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm" className="rounded-full">
					<Settings size={14} aria-hidden />
					Skills
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined} className="p-5 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Hideout skills</DialogTitle>
				</DialogHeader>
				<div className="mt-4 [&>div>div]:flex-wrap">
					<SkillRow
						id={id}
						label="Hideout Management"
						level={options.hideoutManagementSkillLevel}
						onLevelChange={options.setHideoutManagementSkillLevel}
						reduction={hideoutManagementConsumptionReduction}
						reductionLabel="fuel use"
						inputClassName="h-12 w-20 rounded border border-highlight/20 bg-background px-3 text-center font-mono text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
						note="Saved for this profile. Also boosts station bonuses."
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
