"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Coffee, Menu, MessageSquare, Plus, Search, Settings2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchPalette } from "@/features/search/SearchPalette";
import { questHref, stationHref } from "@/lib/entity-routes";
import { isDev } from "@/lib/is-dev";
import { FEEDBACK_FORM_URL, KOFI_URL } from "@/lib/cfg/support-links";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
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
import { HideoutStationsNav } from "./HideoutStationsNav";
import { devNavItem, navMenus, type NavItem, type NavMenu } from "./nav-config";
import { PlayerProfileMenu } from "./PlayerProfileMenu";

export function Navbar() {
	const gameMode = useUserStore((state) => state.gameMode);
	return <NavbarContent key={gameMode} />;
}

function NavbarContent() {
	const gameMode = useUserStore((state) => state.gameMode);
	const [searchOpen, setSearchOpen] = useState(false);
	const searchTrigger = useRef<HTMLElement | null>(null);
	const router = useRouter();
	const openItemDetail = useUIStore((state) => state.openItemDetail);
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
			aria-label="Search items, quests and stations"
			title="Search items, quests and stations (Ctrl/⌘ K)"
			aria-haspopup="dialog"
			aria-expanded={searchOpen}
			onClick={(event) => {
				searchTrigger.current = event.currentTarget;
				setSearchOpen(true);
			}}
			className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

	if ((currentPage === "/quests" || currentPage.startsWith("/quests/")) && isMainNavHidden) return null;

	return (
		<>
			<nav data-main-nav className="border-b bg-card">
				<div className="container mx-auto px-3 py-3 sm:px-6 sm:py-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
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

							<div className="flex items-center gap-1 sm:gap-2 lg:hidden">
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
											isSecondaryRoute && "bg-brand text-inverse",
										)}
										aria-label="Menu"
									>
										<Menu size={18} />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" sideOffset={8}>
										{navMenus.map((menu, index) => (
											<MobileNavSection key={menu.name} menu={menu} currentPage={currentPage} separated={index > 0} />
										))}
										<DropdownMenuSeparator />
										<SecondaryMenuItems currentPage={currentPage} onSetup={() => setSetupOpen(true)} />
									</DropdownMenuContent>
								</DropdownMenu>
								{searchButton}
							</div>
						</div>

						<div className="hidden flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground lg:flex">
							<button
								onClick={() => setQuickAddOpen(true)}
								className={cn(
									"flex items-center gap-2 rounded px-3 py-2.5 transition-colors",
									isQuickAddOpen ? "bg-foreground/80 text-card" : "bg-brand text-inverse hover:bg-brand-hover",
								)}
							>
								<Plus size={16} />
							</button>

							{navMenus.map((menu) => (
								<DesktopNavMenu key={menu.name} menu={menu} currentPage={currentPage} />
							))}

							<PlayerProfileMenu />

							{!hasCompletedSetup && <SetupButton onClick={() => setSetupOpen(true)} />}

							<DropdownMenu>
								<DropdownMenuTrigger
									className={cn(
										"flex items-center gap-2 rounded p-2 transition-colors",
										isSecondaryRoute ? "bg-brand text-inverse" : "hover:text-foreground",
									)}
									aria-label="Menu"
								>
									<Menu size={18} />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" sideOffset={8}>
									<SecondaryMenuItems currentPage={currentPage} onSetup={() => setSetupOpen(true)} />
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
						if (result.kind === "item") openItemDetail(result.item);
						else if (result.kind === "quest") router.push(questHref(result.id), { scroll: false });
						else router.push(stationHref(result.id));
					}}
				/>
			)}
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

function NavItemBadge({ item }: { item: NavItem }) {
	if (!item.badge) return null;
	return (
		<span className="ml-auto rounded-sm border border-brand/40 bg-brand/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand">
			{item.badge}
		</span>
	);
}

function DesktopNavMenu({ menu, currentPage }: { menu: NavMenu; currentPage: string }) {
	const visibleChildren = menu.children?.filter((item) => !item.disabled) ?? [];
	const hasChildren = visibleChildren.length > 0 || !!menu.panel;
	const isActive = isNavItemActive(currentPage, menu);

	return (
		<div className="group/nav-menu relative">
			<Link
				href={menu.href}
				aria-haspopup={hasChildren ? "menu" : undefined}
				className={cn(
					"flex items-center gap-2 rounded px-3 py-2 transition-colors",
					isActive ? "bg-brand text-inverse" : "hover:text-foreground",
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
					className={cn(
						"pointer-events-none invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-[opacity,visibility] duration-150 group-hover/nav-menu:pointer-events-auto group-hover/nav-menu:visible group-hover/nav-menu:opacity-100 group-focus-within/nav-menu:pointer-events-auto group-focus-within/nav-menu:visible group-focus-within/nav-menu:opacity-100",
						menu.panel ? "w-md" : "w-56",
					)}
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
								<NavItemBadge item={item} />
							</Link>
						))}
						{menu.panel === "hideout-stations" && (
							<>
								{visibleChildren.length > 0 && <div className="-mx-1 my-1 h-px bg-border" />}
								<HideoutStationsNav currentPage={currentPage} />
							</>
						)}
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
						<NavItemBadge item={item} />
					</Link>
				</DropdownMenuItem>
			))}
		</>
	);
}

function SecondaryMenuItems({ currentPage, onSetup }: { currentPage: string; onSetup: () => void }) {
	const items: NavItem[] = [
		{ name: "News", href: "/news" },
		{ name: "Settings", href: "/settings" },
		...(isDev ? [devNavItem] : []),
	];

	return (
		<>
			{items.map((item) => (
				<DropdownMenuItem
					key={item.href}
					asChild
					className={cn(isNavItemActive(currentPage, item) && "bg-accent text-accent-foreground")}
				>
					<Link href={item.href} className="flex w-full items-center gap-2">
						<NavItemIcon item={item} />
						{item.name}
					</Link>
				</DropdownMenuItem>
			))}
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={onSetup}>Setup</DropdownMenuItem>
			{(FEEDBACK_FORM_URL || KOFI_URL) && <DropdownMenuSeparator />}
			{FEEDBACK_FORM_URL && (
				<DropdownMenuItem asChild>
					<a
						href={FEEDBACK_FORM_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex w-full items-center gap-2"
					>
						<MessageSquare size={16} />
						Send feedback
					</a>
				</DropdownMenuItem>
			)}
			{KOFI_URL && (
				<DropdownMenuItem asChild>
					<a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2">
						<Coffee size={16} />
						Support on Ko-fi
					</a>
				</DropdownMenuItem>
			)}
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
