import { describe, expect, it } from 'vitest';
import type { Action, BoardCoord, GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { validateArata, validateMove } from '../../src/game/battle.js';
import { createStack, setStack } from '../../src/board/board.js';
import { Game } from '../../src/game/game.js';
import { TURNCOAT_INSUFFICIENT_HAND } from '../support/fixtures.js';

function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw result.error;
  const validation = validateState(result.state);
  if (!validation.ok) throw validation.error;
  return result.state;
}

/**
 * The white Captain at (5,5) (top of stack PyT) steps FL onto the black
 * pawn stack at (4,4). Stacking offers the choice of swapping levels 1 and 2
 * (both black Pawns), but White's hand holds only one Pawn.
 */
function captainStackMove(dc: number, dr: number, outcome: 'stack' | 'capture' | null, turncoat: unknown[]): Action {
  return {
    kind: 'move',
    origin: { col: 5 as BoardCoord, row: 5 as BoardCoord },
    dest: { col: dc as BoardCoord, row: dr as BoardCoord },
    outcome,
    turncoat: turncoat as never,
  };
}

describe('BR-STACK-006 --- cumulative turncoat hand accounting', () => {
  const base = gsfenState(TURNCOAT_INSUFFICIENT_HAND);

  it('rejects a stack move whose turncoat levels need more copies than the hand holds', () => {
    // [1,2] swaps both black Pawns; hand has P:1 -> must be rejected (was
    // accepted before the fix, driving hands.white.P to -1).
    const r = validateMove(base, captainStackMove(4, 4, 'stack', [1, 2]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
  });

  it('accepts the same move when the hand holds both copies, without overdrawing', () => {
    const state: GameState = {
      ...base,
      hands: { ...base.hands, white: { ...base.hands.white, P: 2 } },
    };
    const r = validateMove(state, captainStackMove(4, 4, 'stack', [1, 2]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Both Pawns consumed, both swapped; hand never negative.
    expect(r.speculativeState.hands.white.P).toBe(0);
    const stack = r.speculativeState.position[3][3];
    expect(stack?.map((p) => p.type)).toEqual(['P', 'P', 'T']);
    expect(stack?.every((p) => p.owner === 'white')).toBe(true);
  });

  it('still accepts a single-level turncoat with one copy in hand', () => {
    const r = validateMove(base, captainStackMove(4, 4, 'stack', [1]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.speculativeState.hands.white.P).toBe(0);
  });

  it('engine-level: rejects via step() and leaves the game unchanged', () => {
    const game = new Game(TURNCOAT_INSUFFICIENT_HAND);
    const before = game.toGsfen();
    const result = game.applyAction(captainStackMove(4, 4, 'stack', [1, 2]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-STACK-006');
    expect(game.toGsfen()).toBe(before);
  });

  it('rejects duplicate elected levels (reachable only via untyped actions)', () => {
    // [1,1] would otherwise decrement the same level twice: one effective
    // swap but two hand copies consumed.
    const state: GameState = {
      ...base,
      hands: { ...base.hands, white: { ...base.hands.white, P: 2 } },
    };
    const r = validateMove(state, captainStackMove(4, 4, 'stack', [1, 1]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
  });

  it('rejects malformed (non-positive) turncoat levels instead of crashing', () => {
    // Level 0 would index postMoveStack[-1] -> undefined.owner TypeError.
    const r = validateMove(base, captainStackMove(4, 4, 'stack', [0]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
  });

  it('arata: hand must cover the arata piece AND the swap when they share a type', () => {
    const state = gsfenState(TURNCOAT_INSUFFICIENT_HAND);
    // Friendly-topped stack [t(black), G(white)] at (5,8): arata the Captain
    // onto it and swap level 1. Both the arata and the swap consume a
    // Captain, so the hand needs two.
    let pos = setStack(state.position, { col: 5, row: 8 }, null);
    pos = setStack(
      pos,
      { col: 5, row: 8 },
      createStack([
        { type: 'T', owner: 'black' },
        { type: 'G', owner: 'white' },
      ]),
    );
    const arataAction: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 8 }, turncoat: [1] };

    const tooFew: GameState = {
      ...state,
      position: pos,
      hands: { ...state.hands, white: { ...state.hands.white, T: 1 } },
    };
    const r = validateArata(tooFew, arataAction);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');

    const enough: GameState = {
      ...tooFew,
      hands: { ...tooFew.hands, white: { ...tooFew.hands.white, T: 2 } },
    };
    const ok = validateArata(enough, arataAction);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    // Arata consumes one Captain, the swap consumes the other.
    expect(ok.speculativeState.hands.white.T).toBe(0);
  });
});
