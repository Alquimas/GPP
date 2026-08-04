/**
 * Terminal condition tests.
 *
 * Step  9: evaluateExposure --- Deploy->Battle boundary (BR-DEPLOY-012).
 * Step 11: checkTerminal, hasLegalPlays --- Checkmate, Stalemate, Repetition.
 *
 * @module
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import type { GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import {
  evaluateExposure,
  checkTerminal,
  hasLegalPlays,
  hasInsufficientMaterial,
} from '../../src/game/terminal.js';
import { emptyPosition, setStack, createStack } from '../../src/board/board.js';
import { getLegalDestinations } from '../../src/board/movement.js';
import { isInCheck } from '../../src/board/attack.js';
import { Game } from '../../src/game/game.js';
import { parseGAN } from '../../src/gan/parse.js';
import {
  BOTH_MARSHALS_BATTLE_NOHANDS,
  BOTH_MARSHALS_PLACED,
  BLACK_TURN_MARSHAL_ONLY,
  CHECKMATE_AFTER_CAPTURE,
  DEPLOY_BLACK_MARSHAL_PLACED,
  DEPLOY_PHASE_CTR1,
  MARSHAL_ALONE_BATTLE,
  MARSHAL_BLOCKED_GENERAL_FREE,
  WHITE_MARSHAL_AT_5_9,
} from '../support/fixtures.js';

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

/* ------------------------------------------------------------------ */
/*  evaluateExposure                                                   */
/* ------------------------------------------------------------------ */

describe('evaluateExposure', () => {
  it('returns ongoing when neither Marshal is under attack', () => {
    const state = gsfenState(BOTH_MARSHALS_PLACED);
    const r = evaluateExposure(state.position);
    expect(r.kind).toBe('ongoing');
  });

  it('returns exposure with loser when White Marshal is under attack', () => {
    const state = gsfenState(WHITE_MARSHAL_AT_5_9);
    const pos = setStack(
      state.position,
      { col: 5, row: 1 },
      createStack([{ type: 'G', owner: 'black' }]),
    );
    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure');
    if (r.kind === 'exposure') expect(r.loser).toBe('white');
  });

  it('returns exposure with loser when Black Marshal is under attack', () => {
    const state = gsfenState(DEPLOY_BLACK_MARSHAL_PLACED);
    const pos = setStack(
      state.position,
      { col: 5, row: 9 },
      createStack([{ type: 'G', owner: 'white' }]),
    );
    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure');
    if (r.kind === 'exposure') expect(r.loser).toBe('black');
  });

  it('returns exposure-draw when both Marshals are under attack', () => {
    const state = gsfenState(BOTH_MARSHALS_PLACED);
    let pos = setStack(
      state.position,
      { col: 5, row: 2 },
      createStack([{ type: 'G', owner: 'white' }]),
    );
    pos = setStack(pos, { col: 5, row: 8 }, createStack([{ type: 'G', owner: 'black' }]));
    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure-draw');
  });

  it('returns ongoing when no Marshals are on board (deploy phase edge case)', () => {
    const state = gsfenState(DEPLOY_PHASE_CTR1);
    const r = evaluateExposure(state.position);
    expect(r.kind).toBe('ongoing');
  });
});

/* ------------------------------------------------------------------ */
/*  hasLegalPlays                                                      */
/* ------------------------------------------------------------------ */

describe('hasLegalPlays', () => {
  it('returns true when a player has a move available', () => {
    // White Marshal at (5,9) can step left to (4,9)
    const state = gsfenState(MARSHAL_ALONE_BATTLE);
    expect(hasLegalPlays(state)).toBe(true);
  });

  it('returns true when a player has an arata available', () => {
    // Build: White Marshal at (5,9); White has Pawn in hand.
    // Place a White Pawn at (5,7) so the most advanced piece is row 7.
    // Arata zone: rows 7–9. (5,8) is in zone and empty --- valid arata target.
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const pos = setStack(
      base.position,
      { col: 5, row: 7 },
      createStack([{ type: 'P', owner: 'white' }]),
    );
    const state: GameState = {
      ...base,
      position: pos,
      hands: { ...base.hands, white: { ...base.hands.white, P: 1 } },
    };
    expect(hasLegalPlays(state)).toBe(true);
  });

  it('returns false when no moves or aratas are possible', () => {
    // White Marshal at (5,9). Five reachable directions:
    //   F=(5,8), L=(6,9), R=(4,9), FL=(6,8), FR=(4,8).
    // Block all five with BLACK size-3 stacks so the Marshal cannot land
    // on them (BR-MOVE-005: source stack size 1 < target stack size 3).
    // White has no other pieces and empty hands --- no aratas.
    const state = emptyBattleState('white');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 5 as any, row: 9 as any },
      createStack([{ type: 'M', owner: 'white' }]),
    );
    // Block all five escape squares
    pos = setStack(
      pos,
      { col: 5 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 6 as any, row: 9 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 4 as any, row: 9 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 6 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 4 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    const testState: GameState = { ...state, position: pos };
    expect(hasLegalPlays(testState)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  hasInsufficientMaterial                                            */
/* ------------------------------------------------------------------ */

describe('hasInsufficientMaterial', () => {
  it('returns true when both players have only their Marshal and empty hands', () => {
    const state = gsfenState(MARSHAL_ALONE_BATTLE);
    expect(hasInsufficientMaterial(state)).toBe(true);
  });

  it('returns true for BLACK_TURN_MARSHAL_ONLY', () => {
    const state = gsfenState(BLACK_TURN_MARSHAL_ONLY);
    expect(hasInsufficientMaterial(state)).toBe(true);
  });

  it('returns true for BOTH_MARSHALS_BATTLE_NOHANDS', () => {
    const state = gsfenState(BOTH_MARSHALS_BATTLE_NOHANDS);
    expect(hasInsufficientMaterial(state)).toBe(true);
  });

  it('returns false when a player has an extra piece on board', () => {
    // Add a White Pawn to the MARSHAL_ALONE_BATTLE position
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const pos = setStack(
      base.position,
      { col: 3, row: 9 },
      createStack([{ type: 'P', owner: 'white' }]),
    );
    const state: GameState = { ...base, position: pos };
    expect(hasInsufficientMaterial(state)).toBe(false);
  });

  it('returns false when a player has pieces in hand', () => {
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const state: GameState = {
      ...base,
      hands: { ...base.hands, white: { ...base.hands.white, P: 1 } },
    };
    expect(hasInsufficientMaterial(state)).toBe(false);
  });

  it('returns false when both players have pieces in hand', () => {
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const state: GameState = {
      ...base,
      hands: {
        white: { ...base.hands.white, P: 2 },
        black: { ...base.hands.black, E: 1 },
      },
    };
    expect(hasInsufficientMaterial(state)).toBe(false);
  });

  it('returns false when one player has no Marshal on board', () => {
    // Clear Black's Marshal at (1,1) --- MARSHAL_ALONE_BATTLE row 1 is "8,m"
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const pos = setStack(base.position, { col: 1, row: 1 }, null);
    const state: GameState = { ...base, position: pos };
    expect(hasInsufficientMaterial(state)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  checkTerminal --- Checkmate & Stalemate                              */
/* ------------------------------------------------------------------ */

/**
 * Build a battle-phase GameState from scratch with empty hands and the
 * given active player, using emptyPosition() as the board seed.
 */
function emptyBattleState(activePlayer: 'white' | 'black'): GameState {
  return {
    position: emptyPosition(),
    turn: { phase: 'battle', activePlayer, done: null, counter: 1 },
    hands: {
      white: { A: 0, C: 0, E: 0, F: 0, G: 0, J: 0, L: 0, M: 0, N: 0, P: 0, S: 0, T: 0, U: 0, Y: 0 },
      black: { A: 0, C: 0, E: 0, F: 0, G: 0, J: 0, L: 0, M: 0, N: 0, P: 0, S: 0, T: 0, U: 0, Y: 0 },
    },
  };
}

describe('checkTerminal', () => {
  it('returns checkmate when Marshal is in check and has no legal moves', () => {
    // White Marshal at (1,9) --- corner.
    // All three reachable squares are blocked by Black size-3 stacks
    // so BR-MOVE-005 prevents landing (source size 1 < target size 3).
    //   (1,8) = size-3 Black stack
    //   (2,9) = size-3 Black stack
    //   (2,8) = size-3 stack topped by Black Marshal (step-FL attacks (1,9))
    // No Self Check computation needed --- move engine rejects size violations directly.
    const state = emptyBattleState('white');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 1 as any, row: 9 as any },
      createStack([{ type: 'M', owner: 'white' }]),
    );
    pos = setStack(
      pos,
      { col: 2 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'M', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 1 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 2 as any, row: 9 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    const testState: GameState = { ...state, position: pos };

    // Sanity: is the Marshal in check?
    expect(isInCheck(testState.position, 'white')).toBe(true);
    // Sanity: does the movement engine return any legal destinations?
    const marshalMoves = getLegalDestinations(
      testState.position,
      { col: 1 as any, row: 9 as any },
      'white',
    );
    expect(marshalMoves.length).toBe(0);

    const r = checkTerminal(testState, []);
    expect(r.kind).toBe('checkmate');
    if (r.kind === 'checkmate') expect(r.loser).toBe('white');
  });

  it('returns stalemate when Marshal is not in check but has no legal moves', () => {
    // White Marshal at (1,9). All three escape squares blocked by
    // Black size-3 stacks. The top of (1,8) is a Spy so it does NOT
    // attack (1,9) (Spy has diagonal-only movement). (2,8) and (2,9)
    // tops are Pawns --- Pawn F from (2,8)->(2,9), from (2,9)->off-board.
    // None attack (1,9).
    const state = emptyBattleState('white');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 1 as any, row: 9 as any },
      createStack([{ type: 'M', owner: 'white' }]),
    );
    // (1,8): Spy top --- Spy never attacks (1,9) (diagonals only)
    pos = setStack(
      pos,
      { col: 1 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'Y', owner: 'black' },
      ]),
    );
    // (2,9): Pawn top --- Pawn F from (2,9) is off-board
    pos = setStack(
      pos,
      { col: 2 as any, row: 9 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    // (2,8): Pawn top --- Pawn F from (2,8) = (2,9), not (1,9)
    pos = setStack(
      pos,
      { col: 2 as any, row: 8 as any },
      createStack([
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
        { type: 'P', owner: 'black' },
      ]),
    );
    const testState: GameState = { ...state, position: pos };

    // Sanity: Marshal NOT in check
    expect(isInCheck(testState.position, 'white')).toBe(false);
    // Sanity: no legal destinations (all size 3 > source size 1)
    const marshalMoves = getLegalDestinations(
      testState.position,
      { col: 1 as any, row: 9 as any },
      'white',
    );
    expect(marshalMoves.length).toBe(0);

    const r = checkTerminal(testState, []);
    expect(r.kind).toBe('stalemate');
    if (r.kind === 'stalemate') expect(r.loser).toBe('white');
  });

  it('returns ongoing when Marshal is in check but has a legal escape', () => {
    // White Marshal at (5,5) is attacked by a Black Pawn at (5,4)
    // (Pawn F for Black = row+1 -> (5,5)). The Marshal can step out to
    // any of the surrounding EMPTY squares (e.g. (5,6), (4,5), (6,5)) or
    // capture the Pawn, so hasLegalPlays is true and checkTerminal must
    // NOT report checkmate merely because isInCheck is true.
    const state = emptyBattleState('white');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 5 as any, row: 5 as any },
      createStack([{ type: 'M', owner: 'white' }]),
    );
    pos = setStack(
      pos,
      { col: 5 as any, row: 4 as any },
      createStack([{ type: 'P', owner: 'black' }]),
    );
    const testState: GameState = { ...state, position: pos };

    // Sanity: the Marshal IS in check
    expect(isInCheck(testState.position, 'white')).toBe(true);
    // Sanity: the Marshal has at least one legal escape square
    const marshalMoves = getLegalDestinations(
      testState.position,
      { col: 5 as any, row: 5 as any },
      'white',
    );
    expect(marshalMoves.length).toBeGreaterThan(0);

    const r = checkTerminal(testState, []);
    expect(r.kind).toBe('ongoing');
  });

  it('returns checkmate for a Black Marshal in the (1,1) corner mirror', () => {
    // Mirror of the White (1,9) checkmate: Black Marshal at (1,1).
    // All three reachable squares are blocked by White size-3 stacks
    // so BR-MOVE-005 prevents landing (source size 1 < target size 3).
    //   (1,2) = size-3 White stack
    //   (2,1) = size-3 White stack
    //   (2,2) = size-3 stack topped by White Marshal (step-FR attacks (1,1))
    const state = emptyBattleState('black');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 1 as any, row: 1 as any },
      createStack([{ type: 'M', owner: 'black' }]),
    );
    pos = setStack(
      pos,
      { col: 2 as any, row: 2 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'M', owner: 'white' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 1 as any, row: 2 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
      ]),
    );
    pos = setStack(
      pos,
      { col: 2 as any, row: 1 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
      ]),
    );
    const testState: GameState = { ...state, position: pos };

    // Sanity: is the Marshal in check?
    expect(isInCheck(testState.position, 'black')).toBe(true);
    // Sanity: no legal destinations (all size 3 > source size 1)
    const marshalMoves = getLegalDestinations(
      testState.position,
      { col: 1 as any, row: 1 as any },
      'black',
    );
    expect(marshalMoves.length).toBe(0);

    const r = checkTerminal(testState, []);
    expect(r.kind).toBe('checkmate');
    if (r.kind === 'checkmate') expect(r.loser).toBe('black');
  });

  it('returns stalemate for a Black Marshal in the (1,1) corner mirror', () => {
    // Mirror of the White (1,9) stalemate: Black Marshal at (1,1).
    // All three escape squares blocked by White size-3 stacks. The top
    // of (1,2) is a Spy so it does NOT attack (1,1) (Spy has diagonal-only
    // movement). (2,1) and (2,2) tops are Pawns --- Pawn F from (2,1) is
    // off-board, from (2,2) -> (2,1). None attack (1,1).
    const state = emptyBattleState('black');
    let pos = state.position;
    pos = setStack(
      pos,
      { col: 1 as any, row: 1 as any },
      createStack([{ type: 'M', owner: 'black' }]),
    );
    // (1,2): Spy top --- Spy never attacks (1,1) (diagonals only)
    pos = setStack(
      pos,
      { col: 1 as any, row: 2 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'Y', owner: 'white' },
      ]),
    );
    // (2,1): Pawn top --- Pawn F from (2,1) is off-board
    pos = setStack(
      pos,
      { col: 2 as any, row: 1 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
      ]),
    );
    // (2,2): Pawn top --- Pawn F from (2,2) = (2,1), not (1,1)
    pos = setStack(
      pos,
      { col: 2 as any, row: 2 as any },
      createStack([
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
        { type: 'P', owner: 'white' },
      ]),
    );
    const testState: GameState = { ...state, position: pos };

    // Sanity: Marshal NOT in check
    expect(isInCheck(testState.position, 'black')).toBe(false);
    // Sanity: no legal destinations (all size 3 > source size 1)
    const marshalMoves = getLegalDestinations(
      testState.position,
      { col: 1 as any, row: 1 as any },
      'black',
    );
    expect(marshalMoves.length).toBe(0);

    const r = checkTerminal(testState, []);
    expect(r.kind).toBe('stalemate');
    if (r.kind === 'stalemate') expect(r.loser).toBe('black');
  });

  it('returns ongoing when the game continues', () => {
    // MARSHAL_ALONE_BATTLE would trigger insufficient-material --- add a
    // Pawn to White's hand to give both players mating potential.
    const base = gsfenState(MARSHAL_ALONE_BATTLE);
    const state: GameState = {
      ...base,
      hands: { ...base.hands, white: { ...base.hands.white, P: 1 } },
    };
    const r = checkTerminal(state, []);
    expect(r.kind).toBe('ongoing');
  });

  it('returns ongoing when Marshal is trapped but another piece can move', () => {
    // MARSHAL_BLOCKED_GENERAL_FREE:
    //   Black turn. Black Marshal at (5,1) has reachable squares geometrically
    //   (F=(5,2), L=(6,1), R=(4,1)) but ALL cause Self Check: Pawn-stacks at
    //   (6,2)/(4,2) cover the lateral escapes via B step, and Lieutenant at
    //   (5,3) covers (5,2) via F step. The diagonal Pawn-squares (6,2)/(4,2)
    //   are size-2 stacks, blocked by BR-MOVE-005 (source 1 < target 2).
    //   So while getLegalDestinations returns moves, hasLegalPlays rejects
    //   them via Self Check filtering.
    //
    //   However, Black General at (1,4) CAN move safely (e.g., step BR to (2,3)
    //   or range F to (1,5) --- all empty and unattacked). So hasLegalPlays
    //   returns true, and checkTerminal returns ongoing --- NOT stalemate.
    const state = gsfenState(MARSHAL_BLOCKED_GENERAL_FREE);

    // Marshal has 3 reachable squares geometrically
    const marshalMoves = getLegalDestinations(
      state.position,
      { col: 5 as any, row: 1 as any },
      'black',
    );
    expect(marshalMoves.length).toBe(3);

    // General has many legal destinations (18 in this position)
    const generalMoves = getLegalDestinations(
      state.position,
      { col: 1 as any, row: 4 as any },
      'black',
    );
    expect(generalMoves.length).toBeGreaterThan(0);

    // hasLegalPlays scans ALL pieces --- finds the General's safe move
    expect(hasLegalPlays(state)).toBe(true);

    // checkTerminal: not stalemate, game continues
    const r = checkTerminal(state, []);
    expect(r.kind).toBe('ongoing');
  });

  it('returns insufficient-material when both players have only their Marshals', () => {
    const state = gsfenState(MARSHAL_ALONE_BATTLE);
    const r = checkTerminal(state, []);
    expect(r.kind).toBe('insufficient-material');
  });

  it('returns insufficient-material for BLACK_TURN_MARSHAL_ONLY', () => {
    const state = gsfenState(BLACK_TURN_MARSHAL_ONLY);
    const r = checkTerminal(state, []);
    expect(r.kind).toBe('insufficient-material');
  });

  it('detects checkmate after a capture leaves the opponent with no legal plays', () => {
    // Fixture: Black's turn, Black can capture at (8,7) with a Lieutenant
    // moving from (5,4). After the capture, White is in check but every
    // possible move would leave White's Marshal in check or stack on the
    // Marshal (BR-STACK-004), which is forbidden.
    //
    // The bug: hasLegalPlaces was missing the BR-STACK-004 check in its
    // inline Self Check simulation for Moves (isMoveSafe/isCaptureSafe),
    // so it incorrectly thought stacking a piece on the Marshal was a
    // legal escape, causing checkTerminal to return 'ongoing'.
    const game = new Game(CHECKMATE_AFTER_CAPTURE);

    // Before the move --- Black's turn, ongoing
    expect(game.state.turn.activePlayer).toBe('black');
    expect(game.result.kind).toBe('ongoing');

    // Apply the capture move: Lieutenant moves from (5,4) to (8,7)
    const gan = parseGAN('5-4>8-7x');
    expect(gan.ok).toBe(true);
    if (!gan.ok) return;
    const result = game.applyAction(gan.action);

    // After the move --- White's turn, no legal plays, White is in check
    expect(result.state.turn.activePlayer).toBe('white');
    expect(isInCheck(result.state.position, 'white')).toBe(true);

    // hasLegalPlays must return false --- no escape from check
    expect(hasLegalPlays(result.state)).toBe(false);

    // checkTerminal must detect checkmate
    const terminal = checkTerminal(result.state, []);
    expect(terminal.kind).toBe('checkmate');
    if (terminal.kind === 'checkmate') expect(terminal.loser).toBe('white');

    // Game.result should also reflect checkmate
    expect(game.result.kind).toBe('checkmate');
    if (game.result.kind === 'checkmate') expect(game.result.loser).toBe('white');
  });
});
