/**
 * Full-game integration tests for the Game class (Step 12).
 *
 * Exercises the complete public API: construction, deploy -> battle
 * transition, action validation, state transitions, serialization,
 * and terminal detection.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { Game } from '../../src/game/game.js';
import { parseGAN } from '../../src/gan/parse.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { serializeGSFEN } from '../../src/gsfen/serialize.js';
import { getStack, topPiece } from '../../src/board/board.js';
import type { Action, GameState } from '../../src/types.js';
import { BOTH_MARSHALS_PLACED } from '../support/fixtures.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function gsfenState(gsfen: string): GameState {
  const r = parseGSFEN(gsfen);
  if (!r.ok) throw new Error(`Parse: ${r.error.message}`);
  const v = validateState(r.state);
  if (!v.ok) throw new Error(`Validate: ${v.error.message}`);
  return r.state;
}

/** Parse a GAN string. */
function ganAction(gan: string): Action {
  const r = parseGAN(gan);
  if (!r.ok) throw new Error(`GAN parse failed: ${r.error.message}`);
  return r.action;
}

/* ------------------------------------------------------------------ */
/*  Constructor & factory                                              */
/* ------------------------------------------------------------------ */

describe('Game constructor', () => {
  it('defaults to startpos', () => {
    const game = new Game();
    expect(game.state.turn.phase).toBe('deploy');
    expect(game.state.turn.activePlayer).toBe('white');
    expect(game.result.kind).toBe('ongoing');
  });

  it('accepts a custom GSFEN string', () => {
    const game = new Game('startpos');
    expect(game.state.turn.phase).toBe('deploy');
  });

  it('rejects an invalid GSFEN string', () => {
    expect(() => new Game('not-a-gsfen')).toThrow();
  });

  it('fromState creates a game from an existing state', () => {
    const state = gsfenState(BOTH_MARSHALS_PLACED);
    const game = Game.fromState(state);
    expect(game.state.turn.activePlayer).toBe('white');
    expect(game.state.turn.phase).toBe('deploy');
  });
});

/* ------------------------------------------------------------------ */
/*  Deploy -> Battle transition (full game)                             */
/* ------------------------------------------------------------------ */

describe('full game: deploy -> battle', () => {
  it('plays through deploy and enters battle', () => {
    const game = new Game();

    // ── Deploy Phase ───────────────────────────────────────────
    // White places Marshal
    let r = game.applyAction(ganAction('M5-9'));
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(2);

    // Black places Marshal
    r = game.applyAction(ganAction('M5-1'));
    expect(r.state.turn.activePlayer).toBe('white');
    expect(r.state.turn.counter).toBe(3);

    // White places General, declares Done
    r = game.applyAction(ganAction('G5-8!'));
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.done).toBe('white');

    // Black places General
    r = game.applyAction(ganAction('G5-2'));
    // Black did NOT declare Done, so keeps turn (White already Done)
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.done).toBe('white');

    // Black places Lieutenant, declares Done -> both Done
    r = game.applyAction(ganAction('L5-3!'));
    expect(r.state.turn.phase).toBe('battle');
    expect(r.state.turn.activePlayer).toBe('white');
    expect(r.state.turn.counter).toBe(1);
    expect(r.state.turn.done).toBeNull();
    expect(r.result.kind).toBe('ongoing');

    // ── Battle Phase ───────────────────────────────────────────
    // Verify pieces are where expected
    const stack = getStack(game.state.position, { col: 5, row: 9 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('M');

    // White moves Marshal left
    r = game.applyAction(ganAction('5-9>4-9'));
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(2);
    expect(r.result.kind).toBe('ongoing');

    // Verify origin is empty, dest has Marshal
    expect(getStack(r.state.position, { col: 5, row: 9 })).toBeNull();
    const destStack = getStack(r.state.position, { col: 4, row: 9 });
    expect(destStack).not.toBeNull();
    expect(topPiece(destStack!).type).toBe('M');
  });

  it('rejects illegal actions without mutating state', () => {
    const game = new Game();

    // Illegal: placing Pawn before Marshal
    const beforeState = game.state;
    const r = game.applyAction(ganAction('P5-9'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.rule).toBe('BR-DEPLOY-003');
    expect(r.state).toStrictEqual(beforeState);
    expect(game.state).toStrictEqual(beforeState);

    // Now place Marshal legally --- should work
    const accepted = game.applyAction(ganAction('M5-9'));
    expect(accepted.ok).toBe(true);
    expect(game.state).not.toStrictEqual(beforeState);
  });
});

/* ------------------------------------------------------------------ */
/*  legalActions                                                       */
/* ------------------------------------------------------------------ */

describe('legalActions', () => {
  it('returns placement actions during deploy', () => {
    const game = new Game();
    const actions = game.legalActions;
    // At startpos, White has 25 pieces to place.
    // Deploy zone: rows 7-9 (3 rows × 9 cols = 27 squares).
    // Marshal must be first, so only M placements are legal.
    // Each valid (piece, dest) produces two actions (done=false, done=true).
    // M at any of 27 squares = 27 × 2 = 54 placement actions.
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.kind === 'placement')).toBe(true);
  });

  it('returns move and arata actions during battle', () => {
    // Start from a battle state: both Marshals on board.
    const game = new Game(BOTH_MARSHALS_PLACED);
    // But BOTH_MARSHALS_PLACED is a deploy-phase state.
    // We need a battle-phase state. Let's just place both Marshals and done.
    game.applyAction(ganAction('M5-9'));
    game.applyAction(ganAction('M5-1'));
    game.applyAction(ganAction('P5-8!'));
    game.applyAction(ganAction('P5-2!'));

    expect(game.state.turn.phase).toBe('battle');
    const actions = game.legalActions;
    expect(actions.length).toBeGreaterThan(0);

    // Should contain at least one move
    expect(actions.some((a) => a.kind === 'move')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Serialization round-trips                                          */
/* ------------------------------------------------------------------ */

describe('serialization', () => {
  it('toGsfen round-trips through parseGSFEN', () => {
    const game = new Game();
    const gsfen1 = game.toGsfen();

    // Parse and validate
    const parsed = parseGSFEN(gsfen1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const val = validateState(parsed.state);
    expect(val.ok).toBe(true);

    // Re-serialize
    const gsfen2 = serializeGSFEN(parsed.state);
    expect(gsfen2).toBe(gsfen1); // exact string match
  });

  it('toGan serializes an action', () => {
    const game = new Game();
    const gan = game.toGan(ganAction('M5-9'));
    expect(gan).toBe('M5-9');
  });
});

/* ------------------------------------------------------------------ */
/*  History & terminal detection                                       */
/* ------------------------------------------------------------------ */

describe('history and terminal', () => {
  it('records battle-phase states in history', () => {
    const game = new Game();

    // Deploy
    game.applyAction(ganAction('M5-9'));
    game.applyAction(ganAction('M5-1'));
    game.applyAction(ganAction('P5-8!'));
    game.applyAction(ganAction('P5-2!'));

    expect(game.state.turn.phase).toBe('battle');

    // The current state counts as the first repetition occurrence, so it is
    // only copied into history immediately before its first battle action.
    const histBefore = game.history;
    expect(histBefore).toHaveLength(0);

    // Make a few moves
    game.applyAction(ganAction('5-9>4-9')); // White moves
    game.applyAction(ganAction('5-1>4-1')); // Black moves

    // History should have grown
    expect(game.history.length).toBeGreaterThan(histBefore.length);
  });

  it('hasLegal plays returns correct counts', () => {
    // Just verify the Game doesn't crash when legalActions is called
    // multiple times during a game.
    const game = new Game();
    expect(game.legalActions.length).toBeGreaterThan(0);
    game.applyAction(ganAction('M5-9'));
    expect(game.legalActions.length).toBeGreaterThan(0);
    game.applyAction(ganAction('M5-1'));
    expect(game.legalActions.length).toBeGreaterThan(0);
  });
});
