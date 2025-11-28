"use client";

import Link from "next/link";
import Image from "next/image";
import { List, House, Settings, Plus } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Links = [
    {
        name: "Items",
        href: "/items",
        icon: List,
    },
    {
        name: "Hideout",
        href: "/hideout",
        icon: House,
    },
];

export function Navbar() {
    const setSetupOpen = useUserStore((state) => state.setSetupOpen);
    const { isQuickAddOpen, setQuickAddOpen } = useUIStore();
    const currentPage = usePathname();

    return (
        <nav className="border-b bg-card">
            <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
                <Link href="/">
                    <div className="flex items-center gap-3 min-w-0 group">
                            <div className="relative w-8 h-8 group-hover:animate-spin">
                                <Image
                                    src="/images/hideout/Hideout_icon.webp"
                                    alt="Tarkov Hideout Icon"
                                    fill
                                className="object-contain"
                                loading="eager"
                            />
                        </div>
                        <div className="flex flex-col leading-none min-w-0">
                            <span className="font-bold text-base sm:text-lg tracking-tight sm:tracking-wide text-white truncate">
                                TARKOV HIDEOUT
                            </span>
                            <span className="text-[10px] sm:text-xs text-gray-500 tracking-wide">
                                STATION MANAGER
                            </span>
                        </div>
                    </div>
                </Link>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-gray-400">
                    <button
                        onClick={() => setQuickAddOpen(true)}
                        className={cn("transition-colors flex items-center gap-2 p-2 rounded",
                             isQuickAddOpen ? "text-card bg-foreground/80" : "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                        )}
                    >
                        <Plus size={16}/>
                        Add Items
                    </button>
                    
                    {Links.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "transition-colors flex items-center gap-2 p-2 rounded",
                                currentPage === link.href
                                    ? "text-card bg-foreground/80"
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
                                "transition-colors flex items-center gap-2 cursor-pointer rounded p-2",
                                currentPage === "/settings"
                                    ? "text-card bg-foreground/80"
                                    : "hover:text-white"
                            )}
                            aria-label="Setup and settings menu"
                        >
                            <Settings size={18} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" sideOffset={8}>
                            <DropdownMenuItem onSelect={() => setSetupOpen(true)}>
                                Setup
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                asChild
                                className={cn(
                                    currentPage === "/settings" && "text-card bg-foreground/80"
                                )}
                            >
                                <Link href="/settings">Settings</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </nav>
    );
}
