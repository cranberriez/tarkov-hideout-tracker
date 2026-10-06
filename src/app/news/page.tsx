import { Coffee, MessageSquare } from "lucide-react";
import { FEEDBACK_FORM_URL, KOFI_URL } from "@/lib/cfg/support-links";
import { Post_v3_6_3 } from "./_posts/post_v3_6-3";
import { Post_v2_11_28 } from "./_posts/post_v2_11-28";
import { PostTarkov11 } from "./_posts/post_tarkov_1-1";
import { PostDevelopmentPreview } from "./_posts/post_development_preview";

export default function NewsPage() {
	return (
		<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
			<div className="mb-10 flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">News & Updates</h1>
				<p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
					Latest changes and additions to the Tarkov Hideout Tracker.
				</p>
			</div>

			{FEEDBACK_FORM_URL && (
				<aside className="mb-7 flex flex-col gap-3 rounded-lg border border-brand/40 bg-brand/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
					<div className="flex flex-col gap-1">
						<h2 className="text-base font-semibold text-foreground">Tell us what you think</h2>
						<p className="text-sm leading-6 text-muted-foreground">
							Tried the new update? A short anonymous form helps decide what gets fixed and built next.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-3">
						<a
							href={FEEDBACK_FORM_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-inverse transition-colors hover:bg-brand-hover"
						>
							<MessageSquare size={16} />
							Give feedback
						</a>
						{KOFI_URL && (
							<a
								href={KOFI_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
							>
								<Coffee size={14} />
								Support on Ko-fi
							</a>
						)}
					</div>
				</aside>
			)}

			<div className="flex flex-col gap-7">
				<PostDevelopmentPreview />
				<PostTarkov11 />
				<Post_v3_6_3 />
				<Post_v2_11_28 />
			</div>
		</div>
	);
}
