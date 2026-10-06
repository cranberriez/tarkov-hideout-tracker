import type { TarkovDataMode } from "../../src/types/common";

/** A mistake in how the worker was invoked (bad command, spec or mode). */
export class UsageError extends Error {
	name = "UsageError";
}

/** What `all` means. */
export const STEPS = ["poll", "push", "analyze"] as const;
/** Opt-in only: recompute every cached item, not just those with new upstream data. */
const EXTRA_STEPS = ["reanalyze"] as const;
const KNOWN_STEPS: readonly string[] = [...STEPS, ...EXTRA_STEPS];
export type Step = (typeof STEPS)[number] | (typeof EXTRA_STEPS)[number];
export type RunRequest = Map<TarkovDataMode, Set<Step>>;

/**
 * Parses steps to run now, e.g. `pvp-season:analyze`, `pvp-season:poll+push`,
 * `regular` (every step) or `all:analyze`, comma-separated. Only modes the worker
 * handles are accepted. A forced poll also refreshes the eligible item list; a
 * forced push also refreshes catalog prices.
 */
export function parseRunSpec(value: string, modes: readonly TarkovDataMode[]): RunRequest {
	const request: RunRequest = new Map();
	const entries = value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (!entries.length) throw new UsageError("Run spec is empty; use e.g. pvp-season:analyze");
	for (const entry of entries) {
		const [modePart, stepPart = "all", extra] = entry.split(":").map((part) => part.trim());
		if (extra !== undefined) throw new UsageError(`Invalid run spec "${entry}"; use mode:step+step`);
		const targetModes = modePart === "all" ? modes : [modePart as TarkovDataMode];
		for (const mode of targetModes)
			if (!modes.includes(mode))
				throw new UsageError(`Unknown or disabled mode "${modePart}" in "${entry}"; worker modes: ${modes.join(", ")}`);
		const steps = stepPart === "all" ? [...STEPS] : stepPart.split("+").map((step) => step.trim());
		for (const step of steps)
			if (!KNOWN_STEPS.includes(step))
				throw new UsageError(`Unknown step "${step}" in "${entry}"; steps: ${KNOWN_STEPS.join(", ")} or all`);
		for (const mode of targetModes) {
			const existing = request.get(mode) ?? new Set<Step>();
			for (const step of steps) existing.add(step as Step);
			request.set(mode, existing);
		}
	}
	return request;
}

export function mergeRunRequests(target: RunRequest, source: RunRequest) {
	for (const [mode, steps] of source) {
		const existing = target.get(mode) ?? new Set<Step>();
		for (const step of steps) existing.add(step);
		target.set(mode, existing);
	}
}

export function describeRunRequest(request: RunRequest): string {
	return [...request].map(([mode, steps]) => `${mode}:${[...steps].join("+")}`).join(", ");
}

/** The run spec argument of `once`/`run-now`, skipping `--modes <list>`. */
export function specArgument(args: readonly string[]): string | null {
	const modesValue = args.indexOf("--modes") + 1;
	return args.find((arg, index) => !arg.startsWith("--") && (modesValue === 0 || index !== modesValue)) ?? null;
}
