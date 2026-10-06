import type { Station } from "@/types/hideout";

/** A goal level of another station that needs this station's level. */
export interface StationGoalPrerequisite {
	stationId: string;
	stationName: string;
	/** The level of `stationId` that has the prerequisite. */
	level: number;
	/** The level of this station that it requires. */
	requiredLevel: number;
}

export interface ResolvedStationGoal {
	/** The saved goal; absent means the station's max level. */
	goal: number | undefined;
	/** Highest level that still counts as demand, raised to cover other goals' prerequisites. */
	cap: number;
	/** Goal levels elsewhere that raised `cap` above `goal`. */
	requiredBy: StationGoalPrerequisite[];
}

/**
 * Resolves each station's demand cap: its saved goal (max level when unset), raised until
 * every unbuilt level within any cap has its station prerequisites within their caps.
 */
export function resolveStationGoals(
	stations: readonly Station[],
	stationLevels: Readonly<Record<string, number>>,
	stationGoals: Readonly<Record<string, number>>,
): Record<string, ResolvedStationGoal> {
	const byName = new Map(stations.map((station) => [station.normalizedName, station]));
	const resolved: Record<string, ResolvedStationGoal> = {};
	for (const station of stations) {
		const maxLevel = topLevel(station);
		const goal = stationGoals[station.id];
		resolved[station.id] = {
			goal,
			cap: goal === undefined ? maxLevel : Math.max(0, Math.min(goal, maxLevel)),
			requiredBy: [],
		};
	}

	// Caps only grow and are bounded by max levels, so this terminates.
	let changed = true;
	while (changed) {
		changed = false;
		for (const station of stations) {
			const current = stationLevels[station.id] ?? 0;
			const { cap } = resolved[station.id];
			for (const level of station.levels) {
				if (level.level <= current || level.level > cap) continue;
				for (const requirement of level.stationLevelRequirements) {
					const target = byName.get(requirement.station.normalizedName);
					if (!target) continue;
					const targetGoal = resolved[target.id];
					const requiredLevel = Math.min(requirement.level, topLevel(target));
					if (requiredLevel <= targetGoal.cap || requiredLevel <= (stationLevels[target.id] ?? 0)) continue;
					targetGoal.cap = requiredLevel;
					changed = true;
				}
			}
		}
	}

	// Record what raised each cap once the caps are final.
	for (const station of stations) {
		const current = stationLevels[station.id] ?? 0;
		const { cap } = resolved[station.id];
		for (const level of station.levels) {
			if (level.level <= current || level.level > cap) continue;
			for (const requirement of level.stationLevelRequirements) {
				const target = byName.get(requirement.station.normalizedName);
				if (!target) continue;
				const targetGoal = resolved[target.id];
				const ownCap = targetGoal.goal ?? topLevel(target);
				if (requirement.level <= ownCap || requirement.level <= (stationLevels[target.id] ?? 0)) continue;
				targetGoal.requiredBy.push({
					stationId: station.id,
					stationName: station.name,
					level: level.level,
					requiredLevel: requirement.level,
				});
			}
		}
	}
	return resolved;
}

function topLevel(station: Station) {
	return station.levels.reduce((top, level) => Math.max(top, level.level), 0);
}

/** Demand caps by station ID, for consumers that only filter levels. */
export function stationGoalCaps(resolved: Readonly<Record<string, ResolvedStationGoal>>): Record<string, number> {
	return Object.fromEntries(Object.entries(resolved).map(([stationId, { cap }]) => [stationId, cap]));
}
