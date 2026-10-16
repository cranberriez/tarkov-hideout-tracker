import type { ReactNode } from "react";

// Map control glyphs from tarkov-mappinator, drawn at its sizes so the ported panels line up.
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

export const SplitIcon = () => (
	<Icon>
		<rect x="2.5" y="6" width="5" height="12" rx="1" />
		<rect x="9.5" y="6" width="5" height="12" rx="1" />
		<rect x="16.5" y="6" width="5" height="12" rx="1" />
	</Icon>
);
export const CrosshairIcon = () => (
	<Icon size={16}>
		<circle cx="12" cy="12" r="7" />
		<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
	</Icon>
);
export const PlusIcon = () => (
	<Icon size={16}>
		<path d="M12 5v14M5 12h14" />
	</Icon>
);
export const MinusIcon = () => (
	<Icon size={16}>
		<path d="M5 12h14" />
	</Icon>
);
export const LayersIcon = () => (
	<Icon size={16}>
		<path d="m12 3 9 5-9 5-9-5z" />
		<path d="m3 13 9 5 9-5" />
	</Icon>
);
export const PinIcon = () => (
	<Icon size={16}>
		<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" />
		<circle cx="12" cy="10" r="2.2" />
	</Icon>
);
export const CaretIcon = () => (
	<Icon size={12}>
		<path d="m6 9 6 6 6-6" />
	</Icon>
);
export const ResetIcon = () => (
	<Icon size={15}>
		<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
		<path d="M3 3v5h5" />
	</Icon>
);
export const TerrainIcon = () => (
	<Icon size={16}>
		<path d="m2.5 19 6-9 4 5.5 2.5-3.5 6.5 7z" />
		<circle cx="16.5" cy="6.5" r="2" />
	</Icon>
);
export const CloseIcon = () => (
	<Icon size={14}>
		<path d="M6 6l12 12M18 6 6 18" />
	</Icon>
);
export const AllFloorsIcon = () => (
	<Icon size={13}>
		<path d="m12 3 9 4.5-9 4.5-9-4.5z" />
		<path d="m3 12 9 4.5 9-4.5" />
		<path d="m3 16.5 9 4.5 9-4.5" />
	</Icon>
);
export const CoinIcon = () => (
	<Icon size={16}>
		<circle cx="12" cy="12" r="8" />
		<path d="M14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5" />
	</Icon>
);
export const FullscreenIcon = () => (
	<Icon size={14}>
		<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
	</Icon>
);
export const ExitFullscreenIcon = () => (
	<Icon size={14}>
		<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
	</Icon>
);
