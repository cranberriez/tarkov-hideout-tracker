import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Include all linked encoder versions and options in the fingerprint. Changing the
// toolchain or transform must produce a new URL for immutable browser caches.
const transformVersion = JSON.stringify({
	versions: sharp.versions,
	format: "webp",
	quality: 80,
	withoutEnlargement: true,
});
const root = process.cwd();
const publicDir = path.join(root, "public");
const outputDir = path.join(publicDir, "images/generated-artwork");
const story = {};
const battlePass = {};
await mkdir(outputDir, { recursive: true });
const indexPath = path.join(outputDir, ".index.json");
let index = {};
try {
	index = JSON.parse(await readFile(indexPath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}

async function add(source, widths) {
	const input = await readFile(path.join(publicDir, source.slice(1)));
	const entries = [];
	for (const width of widths) {
		const fingerprint = createHash("sha256").update(input).update(transformVersion).update(String(width)).digest("hex");
		let hash = index[fingerprint];
		let exists = false;
		if (hash) {
			try {
				await access(path.join(outputDir, `${hash}.webp`));
				exists = true;
			} catch {}
		}
		if (!exists) {
			const data = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
			hash = createHash("sha256").update(data).digest("hex").slice(0, 24);
			await writeFile(path.join(outputDir, `${hash}.webp`), data);
			index[fingerprint] = hash;
		}
		entries.push(hash);
	}
	return entries;
}

const storyDir = path.join(publicDir, "images/story");
for (const chapter of (await readdir(storyDir, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
	const steps = path.join(storyDir, chapter.name, "steps");
	let files;
	try {
		files = await readdir(steps, { withFileTypes: true });
	} catch (error) {
		if (error.code === "ENOENT") continue;
		throw error;
	}
	for (const file of files.filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))) {
		story[`${chapter.name}/${file.name}`] = (await add(`/images/story/${chapter.name}/steps/${file.name}`, [1024]))[0];
	}
}
for (const file of await readdir(path.join(publicDir, "images/battle-pass"), { withFileTypes: true })) {
	if (file.isFile() && /\.(png|webp)$/i.test(file.name)) {
		battlePass[file.name] = await add(`/images/battle-pass/${file.name}`, [128, 512]);
	}
}
for (const file of await readdir(path.join(publicDir, "images/battle-pass/maps"), { withFileTypes: true })) {
	if (file.isFile() && /\.webp$/i.test(file.name)) {
		battlePass[`maps/${file.name}`] = await add(`/images/battle-pass/maps/${file.name}`, [256]);
	}
}
await writeFile(indexPath, JSON.stringify(index));
await writeFile(path.join(root, "src/lib/generated-story-artwork.json"), `${JSON.stringify(story)}\n`);
await writeFile(path.join(root, "src/lib/generated-battle-pass-artwork.json"), `${JSON.stringify(battlePass)}\n`);
console.log(`Generated artwork for ${Object.keys(story).length + Object.keys(battlePass).length} source images.`);
