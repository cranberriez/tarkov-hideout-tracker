import type { LucideIcon } from "lucide-react";
import {
	Boxes,
	Columns3,
	Compass,
	Factory,
	GitBranch,
	Goal,
	HandCoins,
	House,
	KeyRound,
	ListChecks,
	PackageOpen,
	ScanSearch,
	ScrollText,
	Wrench,
} from "lucide-react";
import { questViewHref } from "@/lib/entity-routes";

export interface NavItem {
	name: string;
	href: string;
	icon?: LucideIcon;
	disabled?: boolean;
	/** Short status chip, such as "Beta". */
	badge?: string;
}

export interface NavMenu extends NavItem {
	children?: NavItem[];
	/** Extra desktop dropdown content rendered below the child pages. */
	panel?: "hideout-stations";
}

export const navMenus: NavMenu[] = [
	{
		name: "Items",
		href: "/items",
		icon: Boxes,
		children: [
			{ name: "Inventory", href: "/items/inventory", icon: PackageOpen },
			{ name: "Loot Scanner", href: "/uploader", icon: ScanSearch, badge: "Beta" },
			{
				name: "Kappa Checklist",
				href: "/items/kappa-checklist",
				icon: ListChecks,
			},
			{ name: "Keys", href: "/items/keys", icon: KeyRound, disabled: true },
			{
				name: "Barter Profits",
				href: "/items/barter-profits",
				icon: HandCoins,
			},
			{
				name: "Crafting Profits",
				href: "/items/crafting-profits",
				icon: Factory,
			},
		],
	},
	{
		name: "Hideout",
		href: "/hideout",
		icon: House,
		panel: "hideout-stations",
		children: [
			{ name: "Craft Planner", href: "/hideout/craft-planner", icon: Factory, disabled: true },
			{
				name: "Station Goals",
				href: "/hideout/station-goals",
				icon: Goal,
				disabled: true,
			},
		],
	},
	{
		name: "Quests",
		href: "/quests",
		icon: ScrollText,
		children: [
			{ name: "Trader Board", href: questViewHref("board"), icon: Columns3 },
			{ name: "Visualizer", href: questViewHref("visualizer"), icon: GitBranch },
			{ name: "Raid Planner", href: questViewHref("planner"), icon: Compass },
		],
	},
];

export const devNavItem: NavItem = {
	name: "Dev",
	href: "/dev",
	icon: Wrench,
};
