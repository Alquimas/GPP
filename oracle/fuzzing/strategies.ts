import type { Action, GameState } from '../src/types.js';
import type { StrategyFn, StrategyConfig } from './types.js';

export function uniformStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  return actions[Math.floor(rng() * actions.length)];
}

export function avoidStackStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  const filtered = actions.filter(
    (a) => a.kind !== 'move' || a.outcome !== 'stack',
  );
  const pool = filtered.length > 0 ? filtered : actions;
  return pool[Math.floor(rng() * pool.length)];
}

export function avoidArataStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  const filtered = actions.filter((a) => a.kind !== 'arata');
  const pool = filtered.length > 0 ? filtered : actions;
  return pool[Math.floor(rng() * pool.length)];
}

export function avoidStackAndArataStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  let filtered = actions.filter((a) => a.kind !== 'arata');
  filtered = filtered.filter((a) => a.kind !== 'move' || a.outcome !== 'stack');
  const pool = filtered.length > 0 ? filtered : actions;
  return pool[Math.floor(rng() * pool.length)];
}

export function favorCaptureStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  return weightedPick(
    actions,
    (a) => (a.kind === 'move' && a.outcome === 'capture' ? 2 : 1),
    rng,
  );
}

export function favorArataStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  return weightedPick(
    actions,
    (a) => (a.kind === 'arata' ? 2 : 1),
    rng,
  );
}

export function onlyMovesStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  const filtered = actions.filter((a) => a.kind === 'move');
  if (filtered.length === 0) return null;
  return filtered[Math.floor(rng() * filtered.length)];
}

export function onlyPlacementsStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  const filtered = actions.filter((a) => a.kind === 'placement');
  if (filtered.length === 0) return null;
  return filtered[Math.floor(rng() * filtered.length)];
}

export function cycleThroughStrategy(actions: Action[], _state: GameState, rng: () => number): Action | null {
  if (actions.length === 0) return null;
  const index = Math.floor(rng() * actions.length) % actions.length;
  return actions[index];
}

export function customStrategy(config: StrategyConfig): StrategyFn {
  return (actions: Action[], _state: GameState, rng: () => number): Action | null => {
    if (actions.length === 0) return null;

    let pool = actions;

    if (config.avoidStack) {
      const noStack = pool.filter((a) => a.kind !== 'move' || a.outcome !== 'stack');
      if (noStack.length > 0) pool = noStack;
    }

    if (config.avoidArata) {
      const noArata = pool.filter((a) => a.kind !== 'arata');
      if (noArata.length > 0) pool = noArata;
    }

    return weightedPick(
      pool,
      (a) => {
        if (a.kind === 'move' && a.outcome === 'capture') return config.captureWeight;
        if (a.kind === 'arata') return config.arataWeight;
        if (a.kind === 'move') return config.moveWeight;
        if (a.kind === 'placement') return config.placementWeight;
        return 1;
      },
      rng,
    );
  };
}

function weightedPick(
  actions: Action[],
  weightFn: (a: Action) => number,
  rng: () => number,
): Action {
  const weights = actions.map(weightFn);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) {
    return actions[Math.floor(rng() * actions.length)];
  }

  let roll = rng() * totalWeight;
  for (let i = 0; i < actions.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return actions[i];
  }

  return actions[actions.length - 1];
}

export function getStrategy(name: string, config?: StrategyConfig): StrategyFn {
  switch (name) {
    case 'uniform':
      return uniformStrategy;
    case 'avoid-stack':
      return avoidStackStrategy;
    case 'avoid-arata':
      return avoidArataStrategy;
    case 'avoid-stack-and-arata':
      return avoidStackAndArataStrategy;
    case 'favor-capture':
      return favorCaptureStrategy;
    case 'favor-arata':
      return favorArataStrategy;
    case 'only-moves':
      return onlyMovesStrategy;
    case 'only-placements':
      return onlyPlacementsStrategy;
    case 'cycle-through':
      return cycleThroughStrategy;
    case 'custom':
      if (!config) throw new Error('Custom strategy requires a StrategyConfig');
      return customStrategy(config);
    default:
      throw new Error(`Unknown strategy: ${name}`);
  }
}
