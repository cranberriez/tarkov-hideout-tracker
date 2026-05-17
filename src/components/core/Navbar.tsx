"use client";

import Image from "next/image";
import Link from "next/link";
import { Boxes, House, Menu, Plus, ScrollText } from "lucide-react";
import { usePathname } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";

const links = [
    {
        name: "Items",
        href: "/items",
        icon: Boxes,
    },
    {
        name: "Hideout",
        href: "/hideout",
        icon: House,
    },
    {
        name: "Quests",
        href: "/quests",
        icon: ScrollText,
    },
];

export function Navbar() {
    const setSetupOpen = useUserStore((state) => state.setSetupOpen);
    const { isQuickAddOpen, setQuickAddOpen } = useUIStore();
    const currentPage = usePathname();
    const isSecondaryRoute = currentPage === "/settings" || currentPage === "/news";

    return (
        <nav className="border-b bg-card">
            <div className="container mx-auto px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div className="flex items-center justify-between gap-3">
                        <Link href="/" className="min-w-0">
                            <div className="group flex min-w-0 items-center gap-3">
                                <div className="relative h-8 w-8 shrink-0 group-hover:animate-spin">
                                    <Image
                                        src="/images/hideout/Hideout_icon.webp"
                                        alt="Tarkov Hideout Icon"
                                        fill
                                        className="object-contain"
                                        loading="eager"
                                    />
                                </div>
                                <div className="hidden min-w-0 flex-col leading-none lg:flex">
                                    <span className="truncate text-base font-bold tracking-tight text-white sm:text-lg sm:tracking-wide">
                                        TARKOV HIDEOUT
                                    </span>
                                    <span className="text-[10px] tracking-wide text-gray-500 sm:text-xs">
                                        STATION MANAGER
                                    </span>
                                </div>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2 md:hidden">
                            <button
                                onClick={() => setQuickAddOpen(true)}
                                className={cn(
                                    "flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                    isQuickAddOpen
                                        ? "bg-foreground/80 text-card"
                                        : "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                                )}
                            >
                                <Plus size={15} />
                                <span>Add</span>
                            </button>

                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className={cn(
                                        "flex items-center gap-2 rounded p-2 text-gray-400 transition-colors hover:text-white",
                                        isSecondaryRoute && "bg-foreground/80 text-card"
                                    )}
                                    aria-label="Menu"
                                >
                                    <Menu size={18} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={8}>
                                    {links.map((link) => (
                                        <DropdownMenuItem
                                            key={link.name}
                                            asChild
                                            className={cn(
                                                currentPage === link.href &&
                                                    "bg-accent text-accent-foreground"
                                            )}
                                        >
                                            <Link
                                                href={link.href}
                                                className="flex w-full items-center gap-2"
                                            >
                                                <link.icon size={16} />
                                                {link.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        asChild
                                        className={cn(
                                            currentPage === "/news" &&
                                                "bg-accent text-accent-foreground"
                                        )}
                                    >
                                        <Link href="/news" className="w-full">
                                            News
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        asChild
                                        className={cn(
                                            currentPage === "/settings" &&
                                                "bg-accent text-accent-foreground"
                                        )}
                                    >
                                        <Link href="/settings" className="w-full">
                                            Settings
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => setSetupOpen(true)}>
                                        Setup
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="hidden flex-wrap items-center gap-3 text-sm font-medium text-gray-400 md:flex lg:gap-4">
                        <button
                            onClick={() => setQuickAddOpen(true)}
                            className={cn(
                                "flex items-center gap-2 rounded px-3 py-2 transition-colors",
                                isQuickAddOpen
                                    ? "bg-foreground/80 text-card"
                                    : "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                            )}
                        >
                            <Plus size={16} />
                            Add Items
                        </button>

                        {links.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-2 rounded px-3 py-2 transition-colors",
                                    currentPage === link.href
                                        ? "bg-foreground/80 text-card"
                                        : "hover:text-white"
                                )}
                            >
                                <link.icon size={16} />
                                {link.name}
                            </Link>
                        ))}

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className={cn(
                                    "flex items-center gap-2 rounded p-2 transition-colors",
                                    isSecondaryRoute
                                        ? "bg-foreground/80 text-card"
                                        : "hover:text-white"
                                )}
                                aria-label="Menu"
                            >
                                <Menu size={18} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8}>
                                <DropdownMenuItem
                                    asChild
                                    className={cn(
                                        currentPage === "/news" &&
                                            "bg-accent text-accent-foreground"
                                    )}
                                >
                                    <Link href="/news" className="w-full">
                                        News
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    asChild
                                    className={cn(
                                        currentPage === "/settings" &&
                                            "bg-accent text-accent-foreground"
                                    )}
                                >
                                    <Link href="/settings" className="w-full">
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setSetupOpen(true)}>
                                    Setup
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
