/**
 * Fixture verification tests — confirms that every .gsfen fixture file
 * parses correctly, validates, and satisfies structural invariants.
 *
 * Instead of brittle per-square golden-file assertions (which break when
 * fixture layout changes), we verify:
 *   - parse + validateState succeed
 *   - Marshal positions (fixture-distinguishing property)
 *   - Turn state (phase, activePlayer, counter, done)
 *   - Hand contents (exact — these define fixture identity)
 *   - Inventory conservation (board + hand per type ≤ initial)
 *   - Deploy-phase zone constraints
 *   - Deploy-phase strict equality (board + hand = initial)
 *
 * This catches the same behavioural regressions (wrong parser, broken
 * validator, corrupted fixture) without cascading failures on layout
 * reorganisation.
 */

import { describe, it, expect } from 'vitest';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { INITIAL_COUNTS, EMPTY_HAND, FULL_HAND, ALL_PIECE_TYPES } from '../../src/constants.js';
import { countBoardPieces, hasAnyBoardPieces, findPieceOnBoard } from '../../src/board/board.js';
import type { GameState, Hand, Player } from '../../src/types.js';
import {
  ALL_ON_BOARD,
  BATTLE_MIDGAME,
  BATTLE_START,
  BLACK_DONE_DECLARED,
  BOTH_MARSHALS_PLACED,
  CAPTURE_AFTERMATH,
  DEEP_CAPTURE_EXCHANGE,
  DENSE_ENGAGEMENT,
  DEPLOY_NEAR_END,
  DEPLOY_STACKS_IN_ZONES,
  EMPTY_HANDS_ENDGAME,
  ONE_SIDE_FULLY_DEPLOYED,
  SOME_CAPTURED,
  SPARSE_BOARD,
  STARTPOS,
  THREE_DEEP_STACKS,
  TRIPLE_STACK_BATTLEFIELD,
  WHITE_DONE_DECLARED,
  WHITE_DONE_MULTI_COUNT_HAND,
  WHITE_MARSHAL_AT_5_9,
} from '../support/fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOk(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state;
}

/** Create a full Hand from initial counts with optional overrides. */
function H(overrides?: Partial<Hand>): Hand {
  return { ...INITIAL_COUNTS, ...overrides };
}

/** Assert a stack at (rowIdx, colIdx) has the expected bottom→top pieces. */
function assertStack(
  state: GameState,
  rowIdx: number,
  colIdx: number,
  expected: { type: string; owner: string }[],
): void {
  const stack = state.position[rowIdx][colIdx];
  expect(stack).not.toBeNull();
  if (stack) {
    expect(stack.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(stack[i].type).toBe(expected[i].type);
      expect(stack[i].owner).toBe(expected[i].owner);
    }
  }
}

// ---------------------------------------------------------------------------
// Structural invariant helpers
// ---------------------------------------------------------------------------

/**
 * Verify inventory conservation for a single player:
 *   - Battle: board[type] + hand[type] ≤ initial[type]
 *   - Deploy: board[type] + hand[type] = initial[type]
 *
 * Also verifies that the Marshal is at the top of its stack (BR-STACK-004)
 * and that the Marshal count on board is 1 in battle (BR-DEPLOY-003).
 */
function checkPlayerInventory(state: GameState, player: Player, label: string): void {
  const isBattle = state.turn.phase === 'battle';
  const boardCounts = countBoardPieces(state.position, player);
  const hand = state.hands[player];

  for (const type of ALL_PIECE_TYPES) {
    const total = boardCounts[type] + hand[type];
    const initial = INITIAL_COUNTS[type];
    const desc = `${label} ${type}: board=${boardCounts[type]} hand=${hand[type]} total=${total} initial=${initial}`;

    if (total > initial) {
      throw new Error(`Inventory overflow: ${desc}`);
    }

    if (!isBattle && total < initial) {
      throw new Error(`Deploy inventory deficit: ${desc}`);
    }
  }
}

/**
 * Verify Marshal integrity invariants:
 *   - Every Marshal on board is at top of its stack (BR-STACK-004)
 *   - Battle phase: exactly 1 Marshal on board per player (BR-DEPLOY-003)
 *   - Battle phase: no Marshal in hand (BR-DEPLOY-011)
 *   - Deploy phase: not both on board AND in hand simultaneously
 *   - Deploy phase: if Marshal in hand, player has no pieces on board
 */
function checkMarshalIntegrity(state: GameState): void {
  const isBattle = state.turn.phase === 'battle';

  for (const player of ['white', 'black'] as Player[]) {
    const boardM = countBoardPieces(state.position, player).M;
    const handM = state.hands[player].M;

    // Every Marshal on board must be at top of its stack
    const mPositions = findPieceOnBoard(state.position, 'M', player);
    for (const pos of mPositions) {
      const stack = state.position[pos.row][pos.col]!;
      if (pos.stackIndex !== stack.length - 1) {
        throw new Error(
          `${player} Marshal at row ${pos.row + 1}, col ${pos.col + 1} is not at top of stack`,
        );
      }
    }

    if (isBattle) {
      if (boardM !== 1) {
        throw new Error(`Battle: ${player} Marshal appears ${boardM} times on board (expected 1)`);
      }
      if (handM !== 0) {
        throw new Error(`Battle: ${player} Marshal is in hand (board piece count: ${boardM})`);
      }
    } else {
      // Deploy phase
      if (boardM > 0 && handM > 0) {
        throw new Error(`Deploy: ${player} Marshal is both on board and in hand`);
      }
      if (handM > 0 && hasAnyBoardPieces(state.position, player)) {
        throw new Error(`Deploy: ${player} Marshal in hand but pieces on board`);
      }
    }
  }
}

/**
 * For deploy phase: verify that pieces are in the correct zones (BR-DEPLOY-004)
 * and all stacks are single-owner (BR-DEPLOY-005).
 */
function checkDeployZones(state: GameState): void {
  if (state.turn.phase !== 'deploy') return;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = state.position[r][c];
      if (stack === null) continue;

      // Single-owner check
      const firstOwner = stack[0].owner;
      for (const piece of stack) {
        if (piece.owner !== firstOwner) {
          throw new Error(`Deploy: mixed-owner stack at row ${r + 1}, col ${c + 1}`);
        }
      }

      // Zone check
      if (firstOwner === 'white' && r < 6) {
        throw new Error(`Deploy: white piece at row ${r + 1} (zone rows 7-9)`);
      }
      if (firstOwner === 'black' && r > 2) {
        throw new Error(`Deploy: black piece at row ${r + 1} (zone rows 1-3)`);
      }
    }
  }
}

/**
 * Structural invariant check shared by every fixture test.
 * This catches parser/validator/fixture corruption without
 * hard-coding per-square expectations.
 */
function checkStructuralInvariants(state: GameState): void {
  expect(validateState(state).ok).toBe(true);

  // Marshal integrity (comprehensive — covers BR-STACK-004, BR-DEPLOY-003/011)
  checkMarshalIntegrity(state);

  // Inventory conservation per player
  checkPlayerInventory(state, 'white', 'White');
  checkPlayerInventory(state, 'black', 'Black');

  // Deploy-zone constraints
  checkDeployZones(state);
}

// ---------------------------------------------------------------------------
// Tests — one per fixture
// ---------------------------------------------------------------------------

describe('fixture structural invariants', () => {
  it('startpos', () => {
    const state = parseOk(STARTPOS);
    expect(state.hands.white).toEqual(FULL_HAND);
    expect(state.hands.black).toEqual(FULL_HAND);
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('both-marshals-placed', () => {
    const state = parseOk(BOTH_MARSHALS_PLACED);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0 }));
    expect(state.hands.black).toEqual(H({ M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 3,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('all-on-board', () => {
    const state = parseOk(ALL_ON_BOARD);
    // All 25 pieces per player on board, both hands empty
    assertStack(state, 0, 6, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 6, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('battle-start', () => {
    const state = parseOk(BATTLE_START);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('battle-midgame', () => {
    const state = parseOk(BATTLE_MIDGAME);
    // Key distinguishing stack: mixed-ownership PyT at 5-5 (idx 4,4)
    assertStack(state, 4, 4, [
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, E: 2, G: 0, M: 0, P: 3, S: 0, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, G: 0, M: 0, N: 1, S: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 14,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('black-done-declared', () => {
    const state = parseOk(BLACK_DONE_DECLARED);
    assertStack(state, 0, 4, [{ type: 'G', owner: 'black' }]);
    assertStack(state, 1, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 5,
      done: 'black',
    });
    checkStructuralInvariants(state);
  });

  it('capture-aftermath', () => {
    const state = parseOk(CAPTURE_AFTERMATH);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 5, 4, [
      { type: 'N', owner: 'black' },
      { type: 'Y', owner: 'white' },
    ]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, J: 1, M: 0, N: 1, P: 2, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 0, J: 1, M: 0, N: 1, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 22,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('dense-engagement', () => {
    const state = parseOk(DENSE_ENGAGEMENT);
    assertStack(state, 2, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(
      H({ A: 1, E: 2, F: 0, G: 0, M: 0, N: 0, P: 0, S: 1, U: 0, Y: 1 }),
    );
    expect(state.hands.black).toEqual(
      H({ A: 0, E: 2, G: 0, J: 1, M: 0, N: 1, P: 1, S: 0, T: 0, U: 0, Y: 0 }),
    );
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 45,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('deploy-near-end', () => {
    const state = parseOk(DEPLOY_NEAR_END);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 12,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('deploy-stacks-in-zones', () => {
    const state = parseOk(DEPLOY_STACKS_IN_ZONES);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 1, 4, [
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
    ]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3, S: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, E: 2, G: 0, M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 9,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('white-done-declared', () => {
    const state = parseOk(WHITE_DONE_DECLARED);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 6,
      done: 'white',
    });
    checkStructuralInvariants(state);
  });

  it('white-marshal-at-5-9', () => {
    const state = parseOk(WHITE_MARSHAL_AT_5_9);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0 }));
    expect(state.hands.black).toEqual(H());
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 2,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('three-deep-stacks', () => {
    const state = parseOk(THREE_DEEP_STACKS);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    // Three-deep stacks at 2-5 (idx 1,4) and 5-5 (idx 4,4) and 8-5 (idx 7,4)
    assertStack(state, 1, 4, [
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    assertStack(state, 4, 4, [
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, G: 0, M: 0, N: 1, P: 1, S: 1, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, E: 2, G: 0, M: 0, N: 1, T: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 18,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('some-captured', () => {
    const state = parseOk(SOME_CAPTURED);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 4, 4, [
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, E: 2, G: 0, M: 0, N: 1, P: 0, T: 0 }));
    expect(state.hands.black).toEqual(H({ E: 2, G: 0, M: 0, N: 1, P: 3, S: 1, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 20,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('sparse-board', () => {
    const state = parseOk(SPARSE_BOARD);
    assertStack(state, 0, 3, [
      { type: 'E', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]);
    assertStack(state, 6, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0, N: 1, P: 2 }));
    expect(state.hands.black).toEqual(H({ E: 2, F: 1, M: 0, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 35,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('triple-stack-battlefield', () => {
    const state = parseOk(TRIPLE_STACK_BATTLEFIELD);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 1, 4, [
      { type: 'G', owner: 'black' },
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    assertStack(state, 2, 4, [
      { type: 'P', owner: 'black' },
      { type: 'Y', owner: 'white' },
      { type: 'N', owner: 'black' },
    ]);
    assertStack(state, 6, 4, [
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'N', owner: 'white' },
    ]);
    assertStack(state, 7, 4, [
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, F: 1, G: 0, M: 0, N: 1, P: 3, S: 1, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ E: 2, F: 1, G: 0, M: 0, N: 1, P: 3, S: 1, T: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 30,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('deep-capture-exchange', () => {
    const state = parseOk(DEEP_CAPTURE_EXCHANGE);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 0, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 40,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('one-side-fully-deployed', () => {
    const state = parseOk(ONE_SIDE_FULLY_DEPLOYED);
    // White has all 25 pieces on board (empty hand), black only has Marshal
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(H({ M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 3,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('empty-hands-endgame', () => {
    const state = parseOk(EMPTY_HANDS_ENDGAME);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 60,
      done: null,
    });
    checkStructuralInvariants(state);
  });

  it('white-done-multi-count-hand', () => {
    const state = parseOk(WHITE_DONE_MULTI_COUNT_HAND);
    assertStack(state, 0, 4, [{ type: 'M', owner: 'black' }]);
    assertStack(state, 8, 4, [{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 1, G: 0, M: 0, S: 1, T: 0 }));
    expect(state.hands.black).toEqual(H({ A: 1, C: 0, E: 2, G: 0, M: 0, S: 1, T: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 13,
      done: 'white',
    });
    checkStructuralInvariants(state);
  });
});
