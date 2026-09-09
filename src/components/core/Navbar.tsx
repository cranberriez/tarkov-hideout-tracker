"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, Plus, Search, Settings2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchPalette } from "@/features/search/SearchPalette";
import { ItemDetailModal } from "@/features/items/item-detail/LazyItemDetailModal";
import { getQuestDeepLinkHref } from "@/features/quests/quest-deep-link";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import type { ItemSummary } from "@/types/items";
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
import { devNavItem, navMenus, type NavItem, type NavMenu } from "./nav-config";
import { PlayerProfileMenu } from "./PlayerProfileMenu";

export function Navbar() {
	const gameMode = useUserStore((state) => state.gameMode);
	return <NavbarContent key={gameMode} />;
}

function NavbarContent() {
	const gameMode = useUserStore((state) => state.gameMode);
	const [searchOpen, setSearchOpen] = useState(false);
	const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);
	const searchTrigger = useRef<HTMLElement | null>(null);
	const router = useRouter();
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.repeat) {
				// Do not place the palette on top of another modal workflow.
				if (document.querySelector('[role="dialog"]') && !searchOpen) return;
				event.preventDefault();
				if (!searchOpen) searchTrigger.current = document.activeElement as HTMLElement;
				setSearchOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [searchOpen]);
	const searchButton = (
		<button
			type="button"
			aria-label="Search items and quests"
			title="Search items and quests (Ctrl/⌘ K)"
			aria-haspopup="dialog"
			aria-expanded={searchOpen}
			onClick={(event) => {
				searchTrigger.current = event.currentTarget;
				setSearchOpen(true);
			}}
			className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
		>
			<Search size={20} />
		</button>
	);
	const setSetupOpen = useUserStore((state) => state.setSetupOpen);
	const hasCompletedSetup = useUserStore((state) => state.hasCompletedSetup);
	const isQuickAddOpen = useUIStore((state) => state.isQuickAddOpen);
	const setQuickAddOpen = useUIStore((state) => state.setQuickAddOpen);
	const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
	const currentPage = usePathname();
	const isSecondaryRoute = currentPage === "/settings" || currentPage === "/news" || currentPage === "/dev";
	const visibleMenus = process.env.NODE_ENV === "development" ? [...navMenus, devNavItem] : navMenus;

	if (currentPage === "/quests" && isMainNavHidden) return null;

	return (
		<>
			<nav data-main-nav className="border-b bg-card">
				<div className="container mx-auto px-3 py-3 sm:px-6 sm:py-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
						<div className="flex items-center justify-between gap-2 sm:gap-3">
							<Link href="/" className="min-w-0 shrink-0">
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
										<span className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg sm:tracking-wide">
											TARKOV HIDEOUT
										</span>
										<span className="text-[10px] tracking-wide text-subtle-foreground sm:text-xs">STATION MANAGER</span>
									</div>
								</div>
							</Link>

							<div className="flex items-center gap-1 sm:gap-2 md:hidden">
								<button
									onClick={() => setQuickAddOpen(true)}
									className={cn(
										"flex items-center gap-2 rounded px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
										isQuickAddOpen ? "bg-foreground/80 text-card" : "bg-brand text-inverse hover:bg-brand-hover",
									)}
								>
									<Plus size={15} />
									<span className="hidden sm:inline">Add</span>
								</button>

								<PlayerProfileMenu />

								{!hasCompletedSetup && (
									<div className="hidden sm:block">
										<SetupButton onClick={() => setSetupOpen(true)} compact />
									</div>
								)}

								<DropdownMenu>
									<DropdownMenuTrigger
										className={cn(
											"flex items-center gap-2 rounded p-2 text-muted-foreground transition-colors hover:text-foreground",
											isSecondaryRoute && "bg-foreground/80 text-card",
										)}
										aria-label="Menu"
									>
										<Menu size={18} />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" sideOffset={8}>
										{visibleMenus.map((menu, index) => (
											<MobileNavSection key={menu.name} menu={menu} currentPage={currentPage} separated={index > 0} />
										))}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											asChild
											className={cn(currentPage === "/news" && "bg-accent text-accent-foreground")}
										>
											<Link href="/news" className="w-full">
												News
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem
											asChild
											className={cn(currentPage === "/settings" && "bg-accent text-accent-foreground")}
										>
											<Link href="/settings" className="w-full">
												Settings
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem onSelect={() => setSetupOpen(true)}>Setup</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								{searchButton}
							</div>
						</div>

						<div className="hidden flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground md:flex lg:gap-4">
							<button
								onClick={() => setQuickAddOpen(true)}
								className={cn(
									"flex items-center gap-2 rounded px-3 py-2.5 transition-colors",
									isQuickAddOpen ? "bg-foreground/80 text-card" : "bg-brand text-inverse hover:bg-brand-hover",
								)}
							>
								<Plus size={16} />
							</button>

							{visibleMenus.map((menu) => (
								<DesktopNavMenu key={menu.name} menu={menu} currentPage={currentPage} />
							))}

							<PlayerProfileMenu />

							{!hasCompletedSetup && <SetupButton onClick={() => setSetupOpen(true)} />}

							<DropdownMenu>
								<DropdownMenuTrigger
									className={cn(
										"flex items-center gap-2 rounded p-2 transition-colors",
										isSecondaryRoute ? "bg-foreground/80 text-card" : "hover:text-foreground",
									)}
									aria-label="Menu"
								>
									<Menu size={18} />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" sideOffset={8}>
									<DropdownMenuItem
										asChild
										className={cn(currentPage === "/news" && "bg-accent text-accent-foreground")}
									>
										<Link href="/news" className="w-full">
											News
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem
										asChild
										className={cn(currentPage === "/settings" && "bg-accent text-accent-foreground")}
									>
										<Link href="/settings" className="w-full">
											Settings
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onSelect={() => setSetupOpen(true)}>Setup</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							{searchButton}
						</div>
					</div>
				</div>
			</nav>
			{searchOpen && (
				<SearchPalette
					mode={toTarkovJsonGameMode(gameMode)}
					onClose={() => setSearchOpen(false)}
					restoreFocus={() => searchTrigger.current?.focus()}
					onSelect={(result) => {
						setSearchOpen(false);
						if (result.kind === "item") setSelectedItem(result.item);
						else router.push(getQuestDeepLinkHref(result.id), { scroll: false });
					}}
				/>
			)}
			<ItemDetailModal
				item={selectedItem}
				isOpen={!!selectedItem}
				onClose={() => {
					setSelectedItem(null);
					searchTrigger.current?.focus();
				}}
			/>
		</>
	);
}

function isNavItemActive(currentPage: string, item: NavItem) {
	return currentPage === item.href || currentPage.startsWith(`${item.href}/`);
}

function NavItemIcon({ item, size = 16 }: { item: NavItem; size?: number }) {
	const Icon = item.icon;
	return Icon ? <Icon size={size} /> : null;
}

function DesktopNavMenu({ menu, currentPage }: { menu: NavMenu; currentPage: string }) {
	const visibleChildren = menu.children?.filter((item) => !item.disabled) ?? [];
	const hasChildren = visibleChildren.length > 0;
	const isActive = isNavItemActive(currentPage, menu);

	return (
		<div className="group/nav-menu relative">
			<Link
				href={menu.href}
				aria-haspopup={hasChildren ? "menu" : undefined}
				className={cn(
					"flex items-center gap-2 rounded px-3 py-2 transition-colors",
					isActive ? "bg-foreground/80 text-card" : "hover:text-foreground",
				)}
			>
				<NavItemIcon item={menu} />
				{menu.name}
				{hasChildren && <ChevronDown size={14} className="opacity-60" />}
			</Link>

			{hasChildren && (
				<div
					role="menu"
					aria-label={`${menu.name} pages`}
					className="pointer-events-none invisible absolute left-0 top-full z-50 w-56 pt-2 opacity-0 transition-[opacity,visibility] duration-150 group-hover/nav-menu:pointer-events-auto group-hover/nav-menu:visible group-hover/nav-menu:opacity-100 group-focus-within/nav-menu:pointer-events-auto group-focus-within/nav-menu:visible group-focus-within/nav-menu:opacity-100"
				>
					<div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
						{visibleChildren.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								role="menuitem"
								className={cn(
									"flex items-center gap-2 rounded-sm px-2 py-2 text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
									currentPage === item.href && "bg-accent text-accent-foreground",
								)}
							>
								<NavItemIcon item={item} />
								{item.name}
							</Link>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function MobileNavSection({
	menu,
	currentPage,
	separated,
}: {
	menu: NavMenu;
	currentPage: string;
	separated: boolean;
}) {
	const visibleChildren = menu.children?.filter((item) => !item.disabled) ?? [];

	return (
		<>
			{separated && <DropdownMenuSeparator />}
			<DropdownMenuItem
				asChild
				className={cn("font-semibold", isNavItemActive(currentPage, menu) && "bg-accent text-accent-foreground")}
			>
				<Link href={menu.href} className="flex w-full items-center gap-2">
					<NavItemIcon item={menu} />
					{menu.name}
				</Link>
			</DropdownMenuItem>
			{visibleChildren.map((item) => (
				<DropdownMenuItem
					key={item.href}
					asChild
					className={cn("pl-6", currentPage === item.href && "bg-accent text-accent-foreground")}
				>
					<Link href={item.href} className="flex w-full items-center gap-2">
						<NavItemIcon item={item} />
						{item.name}
					</Link>
				</DropdownMenuItem>
			))}
		</>
	);
}

function SetupButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex h-10 items-center justify-center gap-2 rounded border border-brand/60 bg-brand/10 font-semibold uppercase tracking-wide text-brand shadow-[0_0_18px_color-mix(in_oklab,_var(--brand)_12%,_transparent)] transition-all hover:border-brand hover:bg-brand hover:text-inverse",
				compact ? "px-2 text-[11px]" : "px-3 text-xs",
			)}
		>
			<Settings2 size={compact ? 14 : 15} />
			Setup
		</button>
	);
}
