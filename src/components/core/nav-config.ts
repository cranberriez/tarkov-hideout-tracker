import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	Boxes,
	ChartCandlestick,
	Columns3,
	Factory,
	Gamepad2,
	GitBranch,
	Goal,
	HandCoins,
	House,
	KeyRound,
	ListChecks,
	Map,
	PackageOpen,
	ScanSearch,
	ScrollText,
	Wrench,
} from "lucide-react";
import { questViewPath } from "@/lib/entity-routes";

export interface NavItem {
	name: string;
	/** Mode-less path; mode-scoped pages are prefixed with the current mode where rendered (`useModeRoute`). */
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
			{ name: "Market", href: "/items/market", icon: ChartCandlestick },
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
			{ name: "Trader Board", href: questViewPath("board"), icon: Columns3 },
			{ name: "Visualizer", href: questViewPath("visualizer"), icon: GitBranch },
			{ name: "Story Chapters", href: "/story", icon: BookOpen },
		],
	},
	{
		name: "Maps",
		href: "/maps",
		icon: Map,
	},
];

/** The games hub, listed in the secondary (☰) menu. */
export const gamesNavItem: NavItem = {
	name: "Games",
	href: "/games",
	icon: Gamepad2,
};

export const devNavItem: NavItem = {
	name: "Dev",
	href: "/dev",
	icon: Wrench,
};

export const battlePassNavItem: NavItem = {
	name: "Battle Pass",
	href: "/battle-pass",
	icon: Goal,
};
