import { describe, it, expect } from 'vitest';
import { validateState } from '../../src/gsfen/validate.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { EMPTY_HAND, FULL_HAND, INITIAL_COUNTS, START_GSFEN } from '../../src/constants.js';
import {
  BLACK_DONE_DECLARED,
  EXAMPLE4_MIXED_STACK,
  FIXTURES,
  WHITE_MARSHAL_AT_5_9,
} from '../support/fixtures.js';
import type { GameState, Position, TurnState, Stack, PieceType } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a GSFEN string and assert success. */
function parseOk(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.state;
}

/** Assert validation passes. */
function assertValid(state: GameState): void {
  const result = validateState(state);
  expect(result.ok).toBe(true);
}

/** Assert validation fails with a specific rule prefix. */
function assertInvalid(state: GameState, rulePrefix: string): void {
  const result = validateState(state);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.error.rule).toMatch(new RegExp(`^${rulePrefix}`));
}

/** Create a minimal empty-battle GameState for mutation testing. */
function emptyBattleState(overrides?: Partial<GameState>): GameState {
  const base = parseOk(START_GSFEN);
  return {
    position: base.position,
    turn: {
      phase: 'battle',
      activePlayer: 'white',
      done: null,
      counter: 1,
    },
    hands: { white: { ...EMPTY_HAND }, black: { ...EMPTY_HAND } },
    ...overrides,
  };
}

/** Create a minimal empty-deploy GameState for mutation testing. */
function emptyDeployState(overrides?: Partial<GameState>): GameState {
  const base = parseOk(START_GSFEN);
  return {
    position: base.position,
    turn: {
      phase: 'deploy',
      activePlayer: 'white',
      done: null,
      counter: 1,
    },
    hands: { white: { ...FULL_HAND }, black: { ...FULL_HAND } },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateState --- valid states', () => {
  it('startpos is valid', () => {
    const state = parseOk('startpos');
    assertValid(state);
  });

  it('all known-valid sample .gsfen files pass validation', () => {
    const validSamples = [
      'startpos',
      'battle-start',
      'deploy-stacks-in-zones',
      'black-done-declared',
      'white-done-declared',
      'both-marshals-placed',
      'white-marshal-at-5-9',
      'capture-aftermath',
      'some-captured',
      'all-on-board',
      'battle-midgame',
      'deploy-near-end',
      'dense-engagement',
      'sparse-board',
      'three-deep-stacks',
      'triple-stack-battlefield',
      'deep-capture-exchange',
      'one-side-fully-deployed',
      'empty-hands-endgame',
      'white-done-multi-count-hand',
    ];
    for (const name of validSamples) {
      const raw = FIXTURES[name];
      const state = parseOk(raw);
      const result = validateState(state);
      expect(
        result.ok,
        `${name} should be valid: ${result.ok ? '' : (result as { error: { message: string } }).error.message}`,
      ).toBe(true);
    }
  });

  it('worked example 2 is valid', () => {
    const state = parseOk(WHITE_MARSHAL_AT_5_9);
    assertValid(state);
  });

  it('worked example 3 (done flag) is valid', () => {
    const state = parseOk(BLACK_DONE_DECLARED);
    assertValid(state);
  });

  it('worked example 4 (mixed stack) is valid', () => {
    const state = parseOk(EXAMPLE4_MIXED_STACK);
    assertValid(state);
  });
});

describe('validateState --- BR-GSFEN-VALID-001 Marshal integrity', () => {
  describe('BR-GSFEN-VALID-001-TOP --- Marshal not at top of stack (BR-STACK-004)', () => {
    it('rejects Marshal not at top of stack (battle)', () => {
      const state = emptyBattleState();
      // Stack with Marshal at bottom, Pawn on top
      state.position[4][4] = [
        { type: 'M', owner: 'white' },
        { type: 'P', owner: 'white' },
      ] as Stack;
      // Black Marshal needs to be placed for the -COUNT check not to fire first
      state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
      assertInvalid(state, 'BR-GSFEN-VALID-001-TOP');
    });
  });

  describe('BR-GSFEN-VALID-001-COUNT --- Marshal appears ≠ 1 on board in battle (BR-DEPLOY-003)', () => {
    it('rejects missing Marshal in battle phase', () => {
      const state = emptyBattleState();
      // No Marshal on board for either player, and none in hand
      assertInvalid(state, 'BR-GSFEN-VALID-001-COUNT');
    });

    it('rejects two Marshals on board for same player in battle', () => {
      const state = emptyBattleState();
      state.position[4][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.position[4][5] = [{ type: 'M', owner: 'white' }] as Stack;
      state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
      assertInvalid(state, 'BR-GSFEN-VALID-001-COUNT');
    });
  });

  describe('BR-GSFEN-VALID-001-HAND --- Marshal in Hand during battle (BR-DEPLOY-011)', () => {
    it('rejects Marshal in hand during battle', () => {
      const state = emptyBattleState();
      // Put Marshal on board for both players, but also Marshal in white's hand
      state.position[4][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
      state.hands.white.M = 1;
      assertInvalid(state, 'BR-GSFEN-VALID-001-HAND');
    });
  });

  describe('BR-GSFEN-VALID-001-BOTH --- Marshal both on board and in Hand in deploy (BR-DEPLOY-003)', () => {
    it('rejects deploy with Marshal both on board and in hand', () => {
      const state = emptyDeployState();
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      // Marshal still in hand (start state has it)
      assertInvalid(state, 'BR-GSFEN-VALID-001-BOTH');
    });
  });

  describe('BR-GSFEN-VALID-001-FIRST --- Marshal in Hand but player has pieces on board (BR-DEPLOY-003)', () => {
    it('rejects deploy with Marshal in hand but other pieces on board', () => {
      const state = emptyDeployState();
      // Place a Pawn on board but keep Marshal in hand
      state.position[8][4] = [{ type: 'P', owner: 'white' }] as Stack;
      assertInvalid(state, 'BR-GSFEN-VALID-001-FIRST');
    });
  });

  describe('Valid deploy scenarios', () => {
    it('accepts valid deploys --- Marshal in hand with no pieces on board', () => {
      const state = emptyDeployState();
      assertValid(state);
    });

    it('accepts valid deploys --- Marshal on board as top of stack', () => {
      const state = emptyDeployState();
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      assertValid(state);
    });
  });
});

describe('validateState --- BR-GSFEN-VALID-002 inventory conservation', () => {
  /** All piece types except M (Marshal over-count can't be tested in battle
   *  because BR-GSFEN-VALID-001 Marshal checks fire first --- see BR-GSFEN-VALID-002 + deploy M test below). */
  const NON_M_TYPES = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;

  /** Place N pieces of a type across separate cells in row 5. */
  function placePieces(
    state: GameState,
    type: PieceType,
    owner: 'white' | 'black',
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      state.position[4][i] = [{ type, owner }] as Stack;
    }
  }

  describe('white over-count per type (battle) --- board + hand > initial', () => {
    for (const type of NON_M_TYPES) {
      it(`${type} (initial ${INITIAL_COUNTS[type]})`, () => {
        const state = emptyBattleState();
        // Place both Marshals to satisfy BR-GSFEN-VALID-001-COUNT
        state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
        state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
        // Place initial + 1 pieces
        placePieces(state, type, 'white', INITIAL_COUNTS[type] + 1);
        assertInvalid(state, 'BR-GSFEN-VALID-002');
      });
    }
  });

  describe('black over-count per type (battle) --- board + hand > initial', () => {
    for (const type of NON_M_TYPES) {
      it(`${type} (initial ${INITIAL_COUNTS[type]})`, () => {
        const state = emptyBattleState();
        // Place both Marshals to satisfy BR-GSFEN-VALID-001-COUNT
        state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
        state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
        // Place initial + 1 pieces
        placePieces(state, type, 'black', INITIAL_COUNTS[type] + 1);
        assertInvalid(state, 'BR-GSFEN-VALID-002');
      });
    }
  });

  describe('white over-count M (deploy --- only phase where BR-GSFEN-VALID-002 can fire for M)', () => {
    it('M (initial 1)', () => {
      const state = emptyDeployState();
      // Place 2 white Marshals on board, none in hand
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.position[8][5] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      // Place black Marshal to make it a valid deploy
      state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
      state.hands.black.M = 0;
      // BR-GSFEN-VALID-001 deploy checks pass (M on board only, not in hand)
      // BR-GSFEN-VALID-002 catches M: 2 on board > initial 1
      assertInvalid(state, 'BR-GSFEN-VALID-002');
    });
  });

  describe('black over-count M (deploy)', () => {
    it('M (initial 1)', () => {
      const state = emptyDeployState();
      state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
      state.position[0][5] = [{ type: 'M', owner: 'black' }] as Stack;
      state.hands.black.M = 0;
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      assertInvalid(state, 'BR-GSFEN-VALID-002');
    });
  });

  describe('deploy-phase strict equality --- board + hand < initial', () => {
    it('rejects deploy where a piece type is missing (board + hand < initial)', () => {
      const state = emptyDeployState();
      // Remove a Cannon from white's hand without placing it on board
      state.hands.white.C = 0;
      // C initial = 1; board 0 + hand 0 = 0 < 1 -> violation
      assertInvalid(state, 'BR-GSFEN-VALID-002');
    });

    it('rejects deploy where a Spear was placed but 1 is missing (board 2 + hand 0 = 2 < 3)', () => {
      const state = emptyDeployState();
      // Place Marshal first to satisfy BR-GSFEN-VALID-001-FIRST
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      // Place 2 white Spears on board
      state.position[8][3] = [{ type: 'E', owner: 'white' }] as Stack;
      state.position[8][2] = [{ type: 'E', owner: 'white' }] as Stack;
      // Remove all Spears from white's hand
      state.hands.white.E = 0;
      // board 2 + hand 0 = 2 < initial 3 -> deploy strict equality violated
      assertInvalid(state, 'BR-GSFEN-VALID-002');
    });

    it('accepts deploy where board + hand = initial for all types', () => {
      const state = emptyDeployState();
      // Place Marshal first to satisfy BR-GSFEN-VALID-001-FIRST
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      // Place 2 Spears on board, reduce hand by 2
      state.position[8][3] = [{ type: 'E', owner: 'white' }] as Stack;
      state.position[8][2] = [{ type: 'E', owner: 'white' }] as Stack;
      state.hands.white.E = 1; // 2 board + 1 hand = 3 = initial
      assertValid(state);
    });
  });
});

describe('validateState --- BR-GSFEN-VALID-003 Done flags', () => {
  it('rejects done flag on the active player', () => {
    const state = emptyDeployState();
    state.turn.done = 'white'; // white is active, can't have done
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('rejects done flag when done player has no Marshal on board', () => {
    const state = emptyDeployState();
    state.turn.done = 'black';
    state.turn.activePlayer = 'white';
    // Black has no Marshal on board
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('accepts done flag when done player has Marshal on board', () => {
    const state = emptyDeployState();
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    state.turn.done = 'black';
    state.turn.activePlayer = 'white';
    assertValid(state);
  });
});

describe('validateState --- BR-GSFEN-VALID-004 deploy-phase constraints', () => {
  /** Helper: set up a minimal valid deploy state with FULL_HAND (all pieces in hand).
   *  When placing pieces on the board, reduce the hand count to maintain strict equality
   *  (board[type] + hand[type] = initial[type] during deploy, BR-GSFEN-VALID-002). */
  function minimalDeployState(): GameState {
    const emptyRow: (Stack | null)[] = [null, null, null, null, null, null, null, null, null];
    const position: Position = Array.from({ length: 9 }, () => [...emptyRow]);
    const turn: TurnState = {
      phase: 'deploy',
      activePlayer: 'white',
      done: null,
      counter: 1,
    };
    return {
      position,
      turn,
      hands: { white: { ...FULL_HAND }, black: { ...FULL_HAND } },
    };
  }

  it('rejects white piece in black zone (row 1-3) during deploy', () => {
    const state = minimalDeployState();
    // Place both Marshals on board in correct zones
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0; // 1 board + 0 hand = 1 = initial
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0; // 1 board + 0 hand = 1 = initial
    // White Pawn in black zone (row 1, col 1 --- a separate square from Black Marshal)
    state.position[0][0] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3; // 1 board + 3 hand = 4 = initial
    assertInvalid(state, 'BR-GSFEN-VALID-004');
  });

  it('rejects black piece in white zone (row 7-9) during deploy', () => {
    const state = minimalDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // Black Pawn in white zone (row 9, col 1 --- separate from White Marshal)
    state.position[8][0] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 3; // 1 board + 3 hand = 4 = initial
    assertInvalid(state, 'BR-GSFEN-VALID-004');
  });

  it('rejects mixed-ownership stack during deploy', () => {
    const state = minimalDeployState();
    // Mixed stack in white zone: White Pawn (bottom), Black Pawn (middle), White Marshal (top)
    state.position[8][4] = [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'black' },
      { type: 'M', owner: 'white' }, // top = Marshal, passes BR-GSFEN-VALID-001-TOP
    ] as Stack;
    state.hands.white.P = 3; // 1 board + 3 hand = 4 = initial
    state.hands.black.P = 3; // 1 board + 3 hand = 4 = initial
    state.hands.white.M = 0; // 1 board + 0 hand = 1 = initial
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0; // 1 board + 0 hand = 1 = initial
    assertInvalid(state, 'BR-GSFEN-VALID-004');
  });

  it('accepts deploy state with pieces in correct zones', () => {
    const state = minimalDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // Additional white piece in row 8 (idx 7)
    state.position[7][4] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3; // 1 board + 3 hand = 4 = initial
    // Additional black piece in row 2 (idx 1)
    state.position[1][4] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 3; // 1 board + 3 hand = 4 = initial
    assertValid(state);
  });
});

describe('validateState --- BR-GSFEN-VALID-005 counter bounds', () => {
  it('rejects deploy counter > 50', () => {
    const state = parseOk('startpos');
    state.turn.counter = 51;
    assertInvalid(state, 'BR-GSFEN-VALID-005');
  });

  it('accepts deploy counter = 50', () => {
    const state = parseOk('startpos');
    state.turn.counter = 50;
    assertValid(state);
  });

  it('accepts battle counter > 50', () => {
    const state = emptyBattleState();
    state.turn.counter = 100;
    // Need Marshals
    state.position[4][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
    assertValid(state);
  });

  it('counter < 1 is unreachable (parser guarantee via BR-GSFEN-CANON-COUNTER-POSITIVE)', () => {
    // The parser regex /^[1-9]\d*$/ ensures counter ≥ 1 at parse time.
    // The validator no longer checks counter < 1 (removed per GSFEN-REORG).
    // We verify the validator accepts counter = 1 without error.
    const state = parseOk('startpos');
    expect(state.turn.counter).toBe(1);
    assertValid(state);
  });
});

describe('validateState --- multi-rule violations (first-rule ordering)', () => {
  it('BR-GSFEN-VALID-001-TOP fires before BR-GSFEN-VALID-001-COUNT: Marshal buried + missing Marshal', () => {
    const state = emptyBattleState();
    // BR-GSFEN-VALID-001-TOP: Marshal buried under Pawn
    state.position[4][4] = [
      { type: 'M', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // White Marshal count on board = 1 (at pos 4,4 but not at top -> -TOP fires)
    // -TOP is checked first in the loop
    assertInvalid(state, 'BR-GSFEN-VALID-001-TOP');
  });

  it('BR-GSFEN-VALID-001-COUNT fires before BR-GSFEN-VALID-001-HAND: missing Marshal + Marshal in hand', () => {
    const state = emptyBattleState();
    // No white Marshal on board (fires -COUNT)
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.white.M = 1; // would also fire -HAND
    // -COUNT is checked before -HAND for the same player
    assertInvalid(state, 'BR-GSFEN-VALID-001-COUNT');
  });

  it('BR-GSFEN-VALID-001 fires before BR-GSFEN-VALID-002: Marshal not at top + piece over-count', () => {
    const state = emptyBattleState();
    // BR-GSFEN-VALID-001-TOP: Marshal buried under Pawn
    state.position[4][4] = [
      { type: 'M', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // Also over-count A: 3 on board (initial 2)
    state.position[4][5] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][6] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][7] = [{ type: 'A', owner: 'white' }] as Stack;
    // BR-GSFEN-VALID-001 fires before BR-GSFEN-VALID-002
    assertInvalid(state, 'BR-GSFEN-VALID-001-TOP');
  });

  it('BR-GSFEN-VALID-002 fires before BR-GSFEN-VALID-003: over-count + bad done flag', () => {
    const state = emptyBattleState();
    // Place both Marshals to pass BR-GSFEN-VALID-001
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // BR-GSFEN-VALID-002: over-count Archer (3 on board, initial 2)
    state.position[4][4] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][5] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][6] = [{ type: 'A', owner: 'white' }] as Stack;
    // BR-GSFEN-VALID-003 would also fail: done flag on active player
    state.turn.done = 'white';
    // BR-GSFEN-VALID-002 is checked before BR-GSFEN-VALID-003
    assertInvalid(state, 'BR-GSFEN-VALID-002');
  });

  it('BR-GSFEN-VALID-003 fires before BR-GSFEN-VALID-004: bad done flag + white piece in black zone (deploy)', () => {
    const state = emptyDeployState();
    // BR-GSFEN-VALID-003: done flag on active player
    state.turn.done = 'white'; // white is active
    // BR-GSFEN-VALID-004: white piece in black zone (row 1)
    state.position[0][0] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3;
    // Both Marshals on board in proper zones
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // BR-GSFEN-VALID-003 fires before BR-GSFEN-VALID-004
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('BR-GSFEN-VALID-004 fires before BR-GSFEN-VALID-005: deploy zone violation + bad counter', () => {
    const state = emptyDeployState();
    // Place both Marshals in correct zones to pass BR-GSFEN-VALID-001
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // BR-GSFEN-VALID-004: black piece in white zone (row 9)
    state.position[8][0] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 3; // 1 board + 3 hand = 4 = initial
    // BR-GSFEN-VALID-005 would also fail: counter > 50
    state.turn.counter = 51;
    // BR-GSFEN-VALID-004 fires before BR-GSFEN-VALID-005
    assertInvalid(state, 'BR-GSFEN-VALID-004');
  });
});

describe('validateState --- out-of-contract position shape', () => {
  it('returns { ok: false } (GameError) instead of throwing for a non-9x9 position', () => {
    const state = parseOk(START_GSFEN);
    state.position = state.position.slice(0, 8) as Position;
    expect(() => validateState(state)).not.toThrow();
    const result = validateState(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-ROW-COUNT');
  });

  it('reports a row with the wrong length as BR-GSFEN-CANON-POSITION-SQUARE-COUNT', () => {
    const state = parseOk(START_GSFEN);
    state.position[0] = state.position[0].slice(0, 8) as (Stack | null)[];
    const result = validateState(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-SQUARE-COUNT');
  });
});
