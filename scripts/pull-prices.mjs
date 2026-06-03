const baseUrl = process.env.PRICE_UPDATE_BASE_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
    console.error("CRON_SECRET is required to run the price refresh.");
    process.exit(1);
}

const url = new URL("/api/cron/price-update", baseUrl);
const startedAt = Date.now();

console.log(`Refreshing Tarkov.dev flea prices via ${url.toString()}...`);

const response = await fetch(url, {
    method: "GET",
    headers: {
        Authorization: `Bearer ${cronSecret}`,
    },
});

const body = await response.text();

if (!response.ok) {
    console.error(`Price refresh failed: ${response.status} ${response.statusText}`);
    console.error(body);
    process.exit(1);
}

const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`Done in ${elapsedSeconds}s.`);
console.log(body);
