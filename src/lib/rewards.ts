export type Difficulty = "easy" | "medium" | "hard";

export const REWARDS: Record<
  Difficulty,
  { xp: number; coins: number }
> = {
  easy: {
    xp: 10,
    coins: 5,
  },
  medium: {
    xp: 20,
    coins: 10,
  },
  hard: {
    xp: 35,
    coins: 15,
  },
};

export function getReward(difficulty: Difficulty) {
  return REWARDS[difficulty];
}