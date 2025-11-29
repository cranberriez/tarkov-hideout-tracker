import { Post_v2_11_28 } from "./_posts/post_v2_11-28";

export default function NewsPage() {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="flex flex-col gap-2 mb-10">
                <h1 className="text-4xl font-bold tracking-tight">News & Updates</h1>
                <p className="text-muted-foreground">Latest changes and additions to the Tarkov Hideout Tracker.</p>
            </div>

            <Post_v2_11_28 />
        </div>
    );
}
