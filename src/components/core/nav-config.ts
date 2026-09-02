import type { LucideIcon } from "lucide-react";
import {
    Bitcoin,
    Boxes,
    Factory,
    Goal,
    HandCoins,
    House,
    KeyRound,
    ListChecks,
    PackageOpen,
    ScrollText,
    Wrench,
} from "lucide-react";

export interface NavItem {
    name: string;
    href: string;
    icon?: LucideIcon;
    disabled?: boolean;
}

export interface NavMenu extends NavItem {
    children?: NavItem[];
}

export const navMenus: NavMenu[] = [
    {
        name: "Items",
        href: "/items",
        icon: Boxes,
        children: [
            { name: "Inventory", href: "/items/inventory", icon: PackageOpen, disabled: true },
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
        children: [
            {
                name: "Station Goals",
                href: "/hideout/station-goals",
                icon: Goal,
                disabled: true,
            },
            {
                name: "Bitcoin Farm",
                href: "/hideout/bitcoin-farm",
                icon: Bitcoin,
                disabled: true,
            },
        ],
    },
    {
        name: "Quests",
        href: "/quests",
        icon: ScrollText,
    },
];

export const devNavItem: NavItem = {
    name: "Dev",
    href: "/dev",
    icon: Wrench,
};
