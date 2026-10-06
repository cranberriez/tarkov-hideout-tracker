import { NewsPost } from "@/features/news/NewsPost";
import { PostImage } from "@/features/news/ImagePlaceholder";

export function PostDevelopmentPreview() {
	return (
		<NewsPost title="A Look at the Next Update" date="September 9, 2026" version="4.0" defaultOpen>
			<p className="text-lg">
				A lot has been taking shape in the development branch: a rebuilt questing interface, separate player profiles,
				more useful item details, and new ways to compare barter and crafting profits.
			</p>
			<p>
				Here is a look at what is in development so far. Work will continue beyond these features, with more additions,
				fixes, and improvements along the way.
			</p>

			<h3>A new questing interface</h3>
			<p>
				The Quests page has been overhauled to make it easier to find your next task and keep track of what needs doing.
				Browse and filter your quests, then open one to see its objectives, required items, and rewards alongside the
				list.
			</p>
			<p>
				The quest visualizer helps you follow prerequisite chains. The Raid Planner brings objectives from your active
				quests onto a map, so you can see what to work on during your next raid.
			</p>
			<PostImage
				label="Quest workspace with objectives and requirements"
				src="/images/news/preview/quests-workspace.png"
			/>
			<PostImage
				label="Raid Planner showing quest objectives on the Customs map"
				src="/images/news/preview/raid-planner.png"
			/>

			<h3>Separate player profiles</h3>
			<p>
				PVP, PVE, and KORD now have their own profiles. Each keeps its own quest progress, hideout upgrades, tracked
				inventory, and character settings. Switch profiles to pick up where you left off with that character.
			</p>
			<PostImage
				label="Player profile selector with PVE, PVP and KORD"
				src="/images/news/preview/profile-selector.png"
			/>

			<h3>More information in every item</h3>
			<p>
				The updated item window brings trader information, related crafts and barters, and pricing history together.
				Check trader offers, see where an item is used, and look at how its flea market price has changed without
				leaving the page.
			</p>
			<PostImage label="Item details showing trader offers" src="/images/news/preview/item-traders.png" />
			<PostImage label="Item price history chart" src="/images/news/preview/item-price-history.png" />

			<h3>Barter and crafting profit tables</h3>
			<p>
				New profit pages help you compare ingredient costs, sale proceeds, and estimated profit for barters and crafts.
				Sort crafts by profit per hour, filter the results, and adjust prices to match what you expect to pay or sell
				for.
			</p>
			<p>
				Estimates account for your unlocks and flea market selling fees. Prices can change, and costs such as fuel are
				not included, so use the figures as a guide.
			</p>
			<PostImage label="Crafting profits table" src="/images/news/preview/crafting-profits.png" />

			<h3>Hideout stations and the Bitcoin Farm</h3>
			<p>
				Every hideout station now has its own page with requirements, prerequisites, and the crafts it unlocks, and
				stations can be found through search. The Bitcoin Farm page adds a calculator that weighs generator fuel costs
				against what the farm produces.
			</p>
			<PostImage
				label="Bitcoin Farm station page with level requirements and generator costs"
				src="/images/news/preview/bitcoin-farm.png"
			/>

			<h3>Trader board and inventory</h3>
			<p>
				The trader board lays out every quest by trader and loyalty level, so you can see what is available, upcoming,
				or locked at a glance. A new Inventory page lists the items you are tracking in one place.
			</p>
			<PostImage
				label="Trader board with quests grouped by trader and loyalty level"
				src="/images/news/preview/trader-board.png"
			/>

			<h3>More to come</h3>
			<p>
				These are the main additions so far, and development is ongoing. If something looks wrong or you have an idea
				that would make the tracker more useful, share it on{" "}
				<a href="https://github.com/cranberriez/tarkov-hideout-tracker/issues" className="underline hover:text-brand">
					GitHub
				</a>
				. Thanks for following along!
			</p>
		</NewsPost>
	);
}
