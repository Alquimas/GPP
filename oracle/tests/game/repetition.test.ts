/**
 * Repetition detection tests (BR-REPETITION-001).
 *
 * Step 11: checkTerminal evaluates Repetition before each Battle Phase Turn.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { checkTerminal } from '../../src/game/terminal.js';
import { MARSHAL_ALONE_BATTLE } from '../support/fixtures.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  const validation = validateState(result.state);
  if (!validation.ok) {
    throw new Error(
      `Test fixture is an illegal game state: ${validation.error.message} (${validation.error.rule})`,
    );
  }
  return result.state;
}

/**
 * Build a GameState with the given active player, position, and hands,
 * starting from the MARSHAL_ALONE_BATTLE fixture (which has empty hands).
 *
 * This avoids repeating the 9×9 position setup in every test.
 */
function makeState(
  activePlayer: 'white' | 'black',
  whiteHand: Record<string, number> | null,
  blackHand: Record<string, number> | null,
): GameState {
  const base = gsfenState(MARSHAL_ALONE_BATTLE);
  const hands = {
    white: { ...base.hands.white },
    black: { ...base.hands.black },
  };
  if (whiteHand) {
    for (const [pt, count] of Object.entries(whiteHand)) {
      (hands.white as Record<string, number>)[pt] = count;
    }
  }
  if (blackHand) {
    for (const [pt, count] of Object.entries(blackHand)) {
      (hands.black as Record<string, number>)[pt] = count;
    }
  }
  return {
    ...base,
    turn: { ...base.turn, activePlayer },
    hands,
  };
}

/* ------------------------------------------------------------------ */
/*  Repetition tests                                                   */
/* ------------------------------------------------------------------ */

describe('checkTerminal --- Repetition (BR-REPETITION-001)', () => {
  it('returns ongoing with < 4 occurrences of the same state', () => {
    // Same state appears twice in battle-phase history + current = 3 total.
    // Add a Pawn to White's hand to avoid triggering insufficient-material.
    const state = makeState('white', { P: 1 }, null);
    const history = [state, state]; // 2 prior matching states
    // history has only 2 of the same state + current = 3 --- < 4 -> no repetition
    const r = checkTerminal(state, history);
    expect(r.kind).toBe('ongoing');
  });

  it('returns repetition when the same state appears 4 times', () => {
    const state = makeState('white', null, null);
    const history = [state, state, state]; // 3 prior matching states
    // 3 in history + current = 4 -> repetition draw
    const r = checkTerminal(state, history);
    expect(r.kind).toBe('repetition');
  });

  it('returns ongoing when state matches but active player differs', () => {
    // Different active player -> different Game State for repetition.
    // Add a Pawn to avoid triggering insufficient-material.
    const stateWhite = makeState('white', { P: 1 }, null);
    const stateBlack = makeState('black', { P: 1 }, null);
    const history = [stateWhite, stateWhite, stateWhite];
    // State is Black's turn, but history has White's turn -> not matching
    const r = checkTerminal(stateBlack, history);
    expect(r.kind).toBe('ongoing');
  });

  it('returns ongoing when hands differ even if position is same', () => {
    const state1 = makeState('white', { P: 1 }, null);
    const state2 = makeState('white', { P: 2 }, null);
    const history = [state1, state1, state1];
    // State2 has different hand -> not matching
    const r = checkTerminal(state2, history);
    expect(r.kind).toBe('ongoing');
  });

  it('excludes Deploy Phase states from repetition count', () => {
    // Add a Pawn to avoid triggering insufficient-material.
    const state = makeState('white', { P: 1 }, null);
    // Create a deploy-phase state with the same active player, position, hands
    const deployState: GameState = {
      ...state,
      turn: { ...state.turn, phase: 'deploy' },
    };
    const history = [deployState, deployState, deployState];
    // All history states are deploy-phase -> excluded -> only current count = 1
    const r = checkTerminal(state, history);
    expect(r.kind).toBe('ongoing');
  });

  it('counts initial Battle Phase state as first occurrence', () => {
    // Add a Pawn to avoid triggering insufficient-material.
    const state = makeState('white', { P: 1 }, null);
    // Empty history -> current is the first occurrence -> count = 1 -> not repetition
    const r = checkTerminal(state, []);
    expect(r.kind).toBe('ongoing');
  });

  it('returns repetition with 3 prior battle-phase matches and 1 deploy-phase mismatch', () => {
    // 3 battle-phase matches (same as current) + current = 4 -> repetition
    // even if there are also deploy-phase non-matching states
    const state = makeState('white', null, null);
    const deployState: GameState = {
      ...state,
      turn: { ...state.turn, phase: 'deploy', activePlayer: 'black' },
    };
    const history = [state, state, state, deployState];
    const r = checkTerminal(state, history);
    expect(r.kind).toBe('repetition');
  });
});
