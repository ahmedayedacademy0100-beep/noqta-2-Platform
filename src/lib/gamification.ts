/**
 * The XP curve used by the student experience.
 *
 * Points are awarded by the backend (see `evaluateGamification`): a fixed
 * reward per submitted assessment, a bonus when the attempt passes, and the
 * points attached to each badge. This module only *describes* those points as
 * levels — it never invents progress.
 *
 * Level 1 starts at 0 XP. Each next level costs 150 XP more than the previous
 * one, so early levels arrive quickly and later ones feel earned:
 *   1 → 300, 2 → 450, 3 → 600, 4 → 750 …
 */

export const LEVEL_BASE_XP = 300;
export const LEVEL_STEP_XP = 150;

export type LevelState = {
  /** 1-based level number. */
  level: number;
  /** XP accumulated inside the current level. */
  into: number;
  /** XP the current level needs in total. */
  need: number;
  /** 0–100 progress inside the current level. */
  progress: number;
  /** XP still missing before the next level. */
  remaining: number;
  /** Total XP at which the next level starts. */
  nextLevelAt: number;
};

export function levelStateFor(points: number): LevelState {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  let level = 1;
  let need = LEVEL_BASE_XP;
  let into = safe;
  // Bounded loop: even absurd point totals settle in a handful of iterations.
  while (into >= need && level < 200) {
    into -= need;
    level += 1;
    need += LEVEL_STEP_XP;
  }
  const remaining = Math.max(0, need - into);
  return {
    level,
    into,
    need,
    progress: need === 0 ? 0 : Math.min(100, (into / need) * 100),
    remaining,
    nextLevelAt: safe + remaining,
  };
}

/** Points required to reach `level` from zero — used for milestone labels. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let index = 1; index < level; index += 1) {
    total += LEVEL_BASE_XP + LEVEL_STEP_XP * (index - 1);
  }
  return total;
}

export type BadgeTone = "gold" | "blue" | "violet" | "turquoise" | "coral";

/** Stable colour per achievement code so a badge never changes identity. */
export function toneForCode(code: string): BadgeTone {
  const tones: BadgeTone[] = ["gold", "blue", "violet", "turquoise", "coral"];
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) % 99991;
  }
  return tones[hash % tones.length];
}
