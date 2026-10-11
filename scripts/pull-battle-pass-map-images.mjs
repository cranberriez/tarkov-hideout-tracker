import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const snapshot = JSON.parse(await readFile(resolve(root, "src/lib/data/battle-pass-map-data.json"), "utf8"));
const backgrounds = JSON.parse(await readFile(resolve(root, "src/lib/data/battle-pass-map-backgrounds.json"), "utf8"));
const urls = [
	...new Set([
		...snapshot.maps.flatMap((map) => [map.imageUrl, ...map.layers.map((layer) => layer.imageUrl)]),
		...snapshot.locations.flatMap((location) => location.screenshotUrls),
		...backgrounds.maps.flatMap((map) => [map.imageUrl, map.sourceImageUrl].filter(Boolean)),
	]),
].sort();
const paths = {};
let next = 0;
let totalBytes = 0;
await Promise.all(
	Array.from({ length: 6 }, async () => {
		while (next < urls.length) {
			const source = urls[next++];
			const url = new URL(source);
			if (url.protocol !== "https:" || !["tarkovdoc.com", "tarkov.dev"].includes(url.hostname)) {
				throw new Error(`Unexpected image source: ${source}`);
			}
			const local = `/images/battle-pass/map-assets/${url.hostname}${url.pathname}`;
			const destination = resolve(root, `public${local}`);
			let bytes;
			try {
				bytes = await readFile(destination);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				const response = await fetch(source, { signal: AbortSignal.timeout(60000) });
				if (!response.ok) throw new Error(`${response.status}: ${source}`);
				bytes = Buffer.from(await response.arrayBuffer());
			}
			const metadata = await sharp(bytes).metadata();
			if (!metadata.width || !metadata.height) throw new Error(`Invalid image: ${source}`);
			const replacement = backgrounds.maps.find((map) => map.imageUrl === source);
			if (replacement && (metadata.width !== replacement.width || metadata.height !== replacement.height)) {
				throw new Error(`Replacement canvas changed: ${source}`);
			}
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, bytes);
			paths[source] = local;
			totalBytes += bytes.length;
		}
	}),
);
const manifest = resolve(root, "src/lib/data/battle-pass-map-images.json");
await writeFile(
	`${manifest}.tmp`,
	JSON.stringify(Object.fromEntries(urls.map((url) => [url, paths[url]])), null, "\t") + "\n",
);
await rename(`${manifest}.tmp`, manifest);
console.log(`Bundled ${urls.length} map images (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`);
