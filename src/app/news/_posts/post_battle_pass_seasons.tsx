import { NewsPost } from "@/features/news/NewsPost";

export function PostBattlePassSeasons() {
	return (
		<NewsPost title="Battle Pass Planning and Season Modifiers" date="November 19, 2026" version="4.1" defaultOpen>
			<p className="text-lg">
				This update focuses on the season: a much deeper Battle Pass page, new Season 1 and Season 2 pages, and a
				modifier builder you can share with friends.
			</p>

			<h3>Battle Pass document inventory</h3>
			<p>
				Track the documents you own for each profile right on the Battle Pass page. Rewards now show what they cost in
				documents, including classified ones, and claiming a reward removes the documents it uses after you confirm.
				Saved plans show which documents they still need.
			</p>
			<p>
				Document locations are shown as a map grid, labeled and filterable by type, so you can see where to farm what
				you are missing.
			</p>

			<h3>Route planning (work in progress)</h3>
			<p>
				An optional planner can work out a route to the rewards you want across your PVE, PVP, and season profiles. Pick
				a destination and a gathering target, choose the maps you want to farm, and it suggests what to gather, what to
				claim, and when buying TarCoins or classified documents is cheaper than farming. Balanced, Simplest, and
				cheapest routes can be compared side by side, and each season keeps its own saved plan.
			</p>
			<p>
				The planner is off by default while it is still being refined. Turn it on from the Battle Pass page to try it,
				and expect its suggestions to change as it improves.
			</p>

			<h3>Export and import</h3>
			<p>
				Battle Pass data can be exported and imported from the Battle Pass page, so you can back it up or move it to
				another browser.
			</p>

			<h3>Season 1 and Season 2 pages</h3>
			<p>
				New season pages list every global, positive, and negative modifier. The Season 2 page covers the UNTAR Control
				announcement, and both pages compare modifiers across seasons.
			</p>

			<h3>Season modifier builder</h3>
			<p>
				Pick modifiers to build your season and watch the point totals update in a bar that stays on screen as you
				scroll. Your picks are remembered for each season. Share a build with a short link that shows a preview card
				when posted in chat, or save a screenshot sheet of the modifiers you picked. Opening someone else&apos;s link
				will not overwrite your own saved build. A compact view fits more modifiers on screen.
			</p>

			<h3>Faster pages</h3>
			<p>
				Game mode is now part of page addresses, which lets data pages load from cache more often. Search data loads only
				when you need it, and quest selection, loading states, and item windows have had a round of fixes.
			</p>

			<h3>Feedback</h3>
			<p>
				If something looks wrong or you have an idea, share it on{" "}
				<a href="https://github.com/cranberriez/tarkov-hideout-tracker/issues" className="underline hover:text-brand">
					GitHub
				</a>
				. Thanks for following along!
			</p>
		</NewsPost>
	);
}
