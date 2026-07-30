import { describe, expect, it } from 'vitest';
import type { Action, GlobalState } from '../../src/types.js';
import { initialGlobalState } from '../../src/game/initial.js';
import { legalActions, step } from '../../src/game/engine.js';
import { parseGAN } from '../../src/gan/parse.js';

function action(gan: string): Action {
  const parsed = parseGAN(gan);
  if (!parsed.ok) throw parsed.error;
  return parsed.action;
}

describe('pure game engine', () => {
  it('applies a legal action without mutating its input', () => {
    const before = initialGlobalState();
    const snapshot = structuredClone(before);

    const result = step(before, action('M5-9'));

    expect(result.ok).toBe(true);
    expect(before).toStrictEqual(snapshot);
    if (!result.ok) return;
    expect(result.state).not.toBe(before);
    expect(result.state.current.turn.activePlayer).toBe('black');
  });

  it('returns the rule error and the unchanged state for an illegal action', () => {
    const before = initialGlobalState();
    const result = step(before, action('P5-9'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-003');
    expect(result.state).toBe(before);
  });

  it('rejects actions after a terminal result', () => {
    const before: GlobalState = {
      ...initialGlobalState(),
      result: { kind: 'repetition' },
    };
    const result = step(before, action('M5-9'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAME-003');
    expect(result.state).toBe(before);
  });

  it('enumerates only actions accepted by step', () => {
    const state = initialGlobalState();
    const actions = legalActions(state);

    expect(actions).toHaveLength(54);
    expect(actions.every((candidate) => step(state, candidate).ok)).toBe(true);
  });
});
