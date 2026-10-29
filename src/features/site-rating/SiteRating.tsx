"use client";

import { ChevronLeft, Heart, LoaderCircle, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { FEEDBACK_FORM_URL } from "@/lib/cfg/support-links";
import { useSiteRating } from "./useSiteRating";
import styles from "./site-rating.module.css";

export function SiteRating() {
	const { phase, outcome, layout, expanded, setExpanded, rate, dismiss } = useSiteRating();
	if (phase === "hidden") return null;
	const collapsed = layout === "collapsed" && !expanded && phase === "idle";
	return (
		<aside className={styles.anchor} aria-label="Site rating">
			{collapsed ? (
				<button
					type="button"
					className={styles.caret}
					aria-label="Open site rating"
					aria-expanded={false}
					onClick={() => setExpanded(true)}
				>
					<ChevronLeft size={18} />
				</button>
			) : (
				<div
					className={styles.pill}
					data-phase={phase}
					data-outcome={outcome}
					data-layout={layout}
					data-expanded={expanded}
				>
					{phase === "idle" && (
						<>
							<div className={styles.buttons}>
								<button type="button" aria-label="Thumbs down" onClick={() => void rate("bad")}>
									<ThumbsDown size={16} />
								</button>
								<button type="button" aria-label="Thumbs up" onClick={() => void rate("good")}>
									<ThumbsUp size={16} />
								</button>
							</div>
							{layout === "collapsed" && (
								<button
									type="button"
									className={styles.close}
									aria-label="Collapse site rating"
									onClick={() => setExpanded(false)}
								>
									<X size={14} />
								</button>
							)}
						</>
					)}
					{phase === "loading" && (
						<span role="status" aria-label="Sending rating">
							<LoaderCircle className={styles.spinner} size={16} />
						</span>
					)}
					{(phase === "positive" || (phase === "closing" && outcome === "good")) && (
						<span role="status" aria-label="Thank you for rating">
							<Heart className={styles.heart} size={32} />
						</span>
					)}
					{(phase === "negative" || (phase === "closing" && outcome === "bad")) && (
						<>
							<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">
								Send Feedback
							</a>
							<button type="button" aria-label="Dismiss feedback" onClick={dismiss}>
								<X size={14} />
							</button>
						</>
					)}
				</div>
			)}
		</aside>
	);
}
