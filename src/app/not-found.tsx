"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { standardItemImageUrl } from "@/lib/utils/item-images";
import { useRouter } from "next/navigation";
import { ChevronsRight, TriangleAlert } from "lucide-react";
import styles from "./not-found.module.css";

const bitcoinImage = standardItemImageUrl("59faff1d86f7746c51718c9c", "512");

const coins = [
	[8, 40, 0, -24],
	[19, 27, 0.7, 35],
	[29, 48, 0.3, -15],
	[40, 25, 1.1, 30],
	[53, 34, 0.5, -30],
	[65, 44, 0.1, 20],
	[76, 29, 0.9, -35],
	[89, 50, 0.4, 25],
	[95, 24, 1.2, -15],
] as const;

export default function NotFound() {
	const router = useRouter();

	return (
		<main className={styles.scene}>
			<div className={styles.ambience} aria-hidden="true" />
			<div className={styles.content}>
				<div className={styles.artwork} aria-hidden="true">
					<span className={styles.number}>404</span>
					<Image src={bitcoinImage} alt="" width={72} height={72} className={`${styles.coin} ${styles.strayOne}`} />
					<Image src={bitcoinImage} alt="" width={52} height={52} className={`${styles.coin} ${styles.strayTwo}`} />
					<div className={styles.rain}>
						{coins.map(([left, size, delay, tilt], index) => (
							<span
								key={index}
								className={styles.drop}
								style={
									{
										left: `${left}%`,
										"--size": `${size}px`,
										"--delay": `${delay}s`,
										"--tilt": `${tilt}deg`,
									} as CSSProperties
								}
							>
								<Image src={bitcoinImage} alt="" width={size} height={size} loading="eager" className={styles.coin} />
							</span>
						))}
					</div>
				</div>
				<div className={styles.status}>
					<TriangleAlert size={22} aria-hidden="true" />
					<h1>Missing in action</h1>
				</div>
				<nav className={styles.actions} aria-label="Page recovery">
					<Link href="/hideout" className={styles.primary}>
						<ChevronsRight size={21} aria-hidden="true" /> Back to hideout
					</Link>
					<button
						type="button"
						className={styles.secondary}
						onClick={() => {
							if (window.history.length > 1) router.back();
							else router.replace("/hideout");
						}}
					>
						Go back
					</button>
				</nav>
			</div>
		</main>
	);
}
