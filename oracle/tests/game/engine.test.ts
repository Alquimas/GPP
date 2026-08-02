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
      result: { kind: 'repetition', loser: 'black' },
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

    // At startpos only White Marshal placements are legal: 27 deploy-zone
    // squares x 1 candidate each. Done is not yet legal (Marshal not deployed).
    expect(actions).toHaveLength(27);
    expect(actions.every((candidate) => step(state, candidate).ok)).toBe(true);
  });

  it('includes done in legalActions once the active player Marshal is deployed', () => {
    const state = initialGlobalState();

    // Place White's Marshal -> Black's turn. Black's Marshal is not deployed,
    // so only Black Marshal placements are legal (no done for Black yet).
    let r = step(state, action('M5-9'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const blackTurnActions = legalActions(r.state);
    expect(blackTurnActions.some((a) => a.kind === 'done')).toBe(false);
    expect(blackTurnActions).toHaveLength(27);

    // Place Black's Marshal -> White's turn. Both Marshals are deployed, so
    // White can either place another piece or declare Done.
    r = step(r.state, action('M5-1'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const whiteTurnActions = legalActions(r.state);
    expect(whiteTurnActions.some((a) => a.kind === 'done')).toBe(true);
    expect(whiteTurnActions.every((candidate) => step(r.state, candidate).ok)).toBe(true);
  });

  it('applies a done action without incrementing the counter or changing position/hands', () => {
    const state = initialGlobalState();

    // White places Marshal -> counter 2
    let r = step(state, action('M5-9'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const before = structuredClone(r.state.current);
    expect(before.turn.counter).toBe(2);

    // Black places Marshal -> counter 3, White to move
    r = step(r.state, action('M5-1'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.current.turn.counter).toBe(3);

    // White declares Done -> turn.done=white, turn flips to black, counter
    // stays 3, position and hands unchanged.
    const doneBefore = structuredClone(r.state.current);
    r = step(r.state, { kind: 'done' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.current.turn.done).toBe('white');
    expect(r.state.current.turn.activePlayer).toBe('black');
    expect(r.state.current.turn.counter).toBe(3);
    expect(r.state.current.position).toStrictEqual(doneBefore.position);
    expect(r.state.current.hands).toStrictEqual(doneBefore.hands);
  });

  it('ends the deploy phase when both players declare done (no exposure)', () => {
    const state = initialGlobalState();

    let r = step(state, action('M5-9'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    r = step(r.state, action('M5-1'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // White declares Done -> black's turn
    r = step(r.state, { kind: 'done' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.current.turn.done).toBe('white');

    // Black declares Done -> both done -> battle begins
    r = step(r.state, { kind: 'done' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.current.turn.phase).toBe('battle');
    expect(r.state.current.turn.activePlayer).toBe('white');
    expect(r.state.current.turn.counter).toBe(1);
    expect(r.state.current.turn.done).toBeNull();
    expect(r.state.result.kind).toBe('ongoing');
  });

  it('rejects done before the active player Marshal is deployed', () => {
    const state = initialGlobalState();
    const result = step(state, { kind: 'done' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-003');
  });
});
