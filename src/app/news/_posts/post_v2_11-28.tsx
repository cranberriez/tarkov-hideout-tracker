import { NewsPost } from "@/components/news/NewsPost";
import { PostImage } from "./ImagePlaceholder";

export function Post_v2_11_28() {
    return (
        <NewsPost 
                title="Version 2.0 Major Update" 
                date="November 28, 2025" 
                version="2.0"
            >
                <p>
                    Welcome to Version 2.0! This update brings significant changes to how you track your hideout progress, 
                    focusing on more granular control and better inventory management.
                </p>

                <h3 className="text-xl font-semibold mt-4">Individual Item Counts</h3>
                <p>
                    We've introduced individual item counts displayed directly on the Hideout and Items pages. 
                    This allows you to more finely adjust and control the items you have marked as collected. 
                    You can now see live counts and instantly know when you have enough resources to craft your station upgrades.
                </p>
                <p>
                    The biggest bonus is that you can actively and quickly see exactly what items you still need to finish your benches without guessing.
                </p>
                <PostImage label="Screenshot of Individual Item Counts UI" src="/images/news/v2/items-with-counters.png"/>
                <p>
                    Something to note here is that for something like Wires, we ONLY display and count the non found in raid items, because that's whats required. In the case where you have found in raid version of an Item we only need non-found in raid, we will not show you have the required # of items to avoid using FiR items where non-FiR can be used instead.
                </p>

                <h3 className="text-xl font-semibold mt-4">New "Add Items" Feature</h3>
                <p>
                    Finished a raid? Use the new "Add Items" feature to quickly tally up the loot you just acquired. 
                    These items will feed directly into your total counts across the game, making post-raid organization much faster.
                </p>
                <PostImage label="Add Items Modal Interface" src="/images/news/v2/quick-add-items.png" contain/>

                <h3 className="text-xl font-semibold mt-4">Found in Raid (FiR) vs. Non-FiR</h3>
                <p>
                    There is now a strict separation between <strong className="text-orange-500">Found in Raid</strong> and <strong>Non-Found in Raid</strong> items.
                    On the Items page, you will clearly see if ANY items for a specific requirement need to be Found in Raid.
                </p>
                <p>
                    This separation is necessary to properly track and display the differences, ensuring you know if you can 
                    safely use your FiR items for a station upgrade or if you should save them for quests.
                </p>
                <p className="bg-white/5 p-1 pl-2 border-l border-tarkov-green-dim">
                    Found in Raid (FiR) items are only used to fulfill non-FiR requirements if no other station requires the FiR version. In most cases we still display the total number of FiR items you have.
                </p>

                <h3 className="text-xl font-semibold mt-4">Migration & Changes</h3>
                <p>
                    Please note that the old "click to complete" functionality in the hideout has been removed. 
                    We have converted your previous progress into currently acquired items to the best of our ability.
                </p>
                
                <h3 className="text-xl font-semibold mt-4">Performance & Requirements</h3>
                <p>
                    We are aware that general load times aren't as optimal as they could be, and we will be working to improve them as we go.
                </p>
                <p>
                    Additionally, station requirements have been updated to match the latest game data. 
                    Some new display settings are available within the Settings menu (accessible via the new menu button). 
                    These settings were moved there to avoid overcrowding the controls on individual pages.
                </p>

                <div className="mt-8 p-4 bg-secondary/20 rounded-lg border border-secondary/50">
                    <h3 className="text-lg font-semibold mb-2">Going Forward</h3>
                    <ul className="list-disc list-inside space-y-2">
                        <li>We plan to add visibility for items that can be bartered for or crafted with your current station levels.</li>
                        <li>A potential new page for custom lists or the ability to pin crafts for quick reference on the item page.</li>
                        <li>Adding Quests (and Kappa items) is still being considered. While useful, we know many resources already exist for this.</li>
                    </ul>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Note: We currently have no direct endpoint for bug reports or feature requests, but look out for a new post here when that becomes available!
                    </p>
                </div>
            </NewsPost>
    )
}