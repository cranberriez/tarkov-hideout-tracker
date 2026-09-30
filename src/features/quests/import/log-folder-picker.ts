/**
 * Folder access for the quest log import. The File System Access picker remembers the
 * last chosen folder (per `id`), so returning users open where they left off. Drag and
 * drop and the plain directory input remain as fallbacks. Only push-notification logs
 * are collected, with `webkitRelativePath` set the way the parser expects.
 */

const PUSH_NOTIFICATION_FILE = /push-notifications.*\.log$/i;
const PICKER_ID = "eft-logs";

interface DirectoryHandleLike {
	name: string;
	entries(): AsyncIterable<[string, FileSystemHandleLike]>;
}

interface FileSystemHandleLike {
	kind: "file" | "directory";
	name: string;
	getFile?: () => Promise<File>;
	entries?: DirectoryHandleLike["entries"];
}

type PickerWindow = Window & {
	showDirectoryPicker?: (options: { id: string; mode: "read" }) => Promise<DirectoryHandleLike>;
};

function withPath(file: File, path: string) {
	Object.defineProperty(file, "webkitRelativePath", { value: path });
	return file;
}

async function collectFromHandle(directory: DirectoryHandleLike, prefix: string, files: File[]) {
	for await (const [name, handle] of directory.entries()) {
		const path = `${prefix}/${name}`;
		if (handle.kind === "directory") {
			await collectFromHandle(handle as unknown as DirectoryHandleLike, path, files);
		} else if (PUSH_NOTIFICATION_FILE.test(name) && handle.getFile) {
			files.push(withPath(await handle.getFile(), path));
		}
	}
}

/** `undefined` when the picker is unsupported, `null` when cancelled, otherwise the logs found. */
export async function pickLogFolder(): Promise<File[] | null | undefined> {
	const picker = (window as PickerWindow).showDirectoryPicker;
	if (!picker) return undefined;
	try {
		const directory = await picker.call(window, { id: PICKER_ID, mode: "read" });
		const files: File[] = [];
		await collectFromHandle(directory, directory.name, files);
		return files;
	} catch {
		return null;
	}
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	return new Promise((resolve, reject) => {
		const all: FileSystemEntry[] = [];
		const readBatch = () =>
			reader.readEntries((batch) => {
				if (batch.length === 0) resolve(all);
				else {
					all.push(...batch);
					readBatch();
				}
			}, reject);
		readBatch();
	});
}

async function collectFromEntry(entry: FileSystemEntry, files: File[]) {
	const path = entry.fullPath.replace(/^\//, "");
	if (entry.isDirectory) {
		for (const child of await readAllEntries((entry as FileSystemDirectoryEntry).createReader())) {
			await collectFromEntry(child, files);
		}
	} else if (PUSH_NOTIFICATION_FILE.test(entry.name)) {
		const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
		files.push(withPath(file, path));
	}
}

/** Files from a dropped folder (or files); read synchronously off the event, resolved async. */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
	const entries = Array.from(dataTransfer.items)
		.map((item) => item.webkitGetAsEntry?.())
		.filter((entry): entry is FileSystemEntry => !!entry);
	const files: File[] = [];
	for (const entry of entries) await collectFromEntry(entry, files);
	return files;
}
