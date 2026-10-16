import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	Boxes,
	ChartCandlestick,
	Columns3,
	Compass,
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
import { questViewHref } from "@/lib/entity-routes";
import { MAP_EXPLORER_MAPS } from "@/lib/cfg/map-explorer";

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
			{ name: "Trader Board", href: questViewHref("board"), icon: Columns3 },
			{ name: "Visualizer", href: questViewHref("visualizer"), icon: GitBranch },
			{ name: "Raid Planner", href: questViewHref("planner"), icon: Compass },
			{ name: "Story Chapters", href: "/story", icon: BookOpen },
		],
	},
	{
		name: "Maps",
		href: "/maps",
		icon: Map,
		children: MAP_EXPLORER_MAPS.map((map) => ({ name: map.name, href: `/maps/${map.key}` })),
	},
	{
		name: "Season 1",
		href: "/season-1",
		icon: Goal,
		children: [
			{ name: "Overview", href: "/season-1", icon: House },
			{ name: "Battle Pass", href: "/battle-pass", icon: Goal },
		],
	},
];

/** The games hub; listed only near the bottom of the secondary (☰) menu. */
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

export function seasonNavMenus(season: { id: string; name: string }): NavMenu[] {
	return navMenus.map((menu) =>
		menu.href === "/season-1"
			? {
					...menu,
					name: season.name,
					href: "/" + season.id,
					children: menu.children?.map((child) => ({
						...child,
						href: child.href === "/season-1" ? "/" + season.id : child.href + "?season=" + season.id,
					})),
				}
			: menu,
	);
}
