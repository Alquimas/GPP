import type { Action, GameState } from '../src/types.js';

export type StrategyName =
  | 'uniform'
  | 'avoid-stack'
  | 'avoid-arata'
  | 'avoid-stack-and-arata'
  | 'favor-capture'
  | 'favor-arata'
  | 'only-moves'
  | 'only-placements'
  | 'cycle-through'
  | 'custom';

export type StrategyFn = (
  actions: Action[],
  state: GameState,
  rng: () => number,
) => Action | null;

export type StrategyConfig = {
  avoidStack: boolean;
  avoidArata: boolean;
  captureWeight: number;
  arataWeight: number;
  moveWeight: number;
  placementWeight: number;
};

export type FuzzerConfig = {
  gsfen: string;
  seed: number;
  games: number;
  logDir: string;
  strategy: StrategyName;
  moveTimeoutMs: number;
  gameTimeoutMs: number;
  verbose: boolean;
  noCapture: boolean;
  stopOnError: boolean;
  strategyConfig: StrategyConfig;
};

export type LogEntry = {
  gsfen: string;
  action: string;
};

export type RunResult = {
  seed: number;
  strategy: StrategyName;
  totalMoves: number;
  result: string;
  duration: number;
  errors: number;
  crashes: number;
};
