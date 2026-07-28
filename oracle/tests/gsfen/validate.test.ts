import { describe, it, expect } from 'vitest';
import { validateState } from '../../src/gsfen/validate.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { EMPTY_HAND, FULL_HAND, INITIAL_COUNTS, START_GSFEN } from '../../src/constants.js';
import { BLACK_DONE_DECLARED, EXAMPLE4_MIXED_STACK, FIXTURES, WHITE_MARSHAL_AT_5_9 } from '../../src/gsfen/fixtures.js';
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

describe('validateState — valid states', () => {
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

describe('validateState — BR-GSFEN-VALID-002 stack size', () => {
  it('rejects a stack of 4 pieces', () => {
    const state = emptyBattleState();
    // Put a 4-piece stack on the board
    state.position[4][4] = [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as unknown as Stack;
    assertInvalid(state, 'BR-GSFEN-VALID-002');
  });

  it('rejects a stack of 0 pieces', () => {
    const state = emptyBattleState();
    state.position[4][4] = [] as unknown as Stack;
    assertInvalid(state, 'BR-GSFEN-VALID-002');
  });
});

describe('validateState — BR-GSFEN-VALID-003 Marshal integrity', () => {
  it('rejects Marshal not at top of stack', () => {
    const state = emptyBattleState();
    // Stack with Marshal at bottom, Pawn on top
    state.position[4][4] = [
      { type: 'M', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as Stack;
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('rejects missing Marshal in battle phase', () => {
    const state = emptyBattleState();
    // No Marshal on board for either player, and none in hand
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('rejects Marshal in hand during battle', () => {
    const state = emptyBattleState();
    // Put Marshal on board for both players, but also Marshal in white's hand
    state.position[4][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.white.M = 1;
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('rejects two Marshals on board for same player in battle', () => {
    const state = emptyBattleState();
    state.position[4][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[4][5] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[4][3] = [{ type: 'M', owner: 'black' }] as Stack;
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('accepts valid deploys — Marshal in hand with no pieces on board', () => {
    const state = emptyDeployState();
    assertValid(state);
  });

  it('accepts valid deploys — Marshal on board as top of stack', () => {
    const state = emptyDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    assertValid(state);
  });

  it('rejects deploy with Marshal both on board and in hand', () => {
    const state = emptyDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    // Marshal still in hand (start state has it)
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('rejects deploy with Marshal in hand but other pieces on board', () => {
    const state = emptyDeployState();
    // Place a Pawn on board but keep Marshal in hand
    state.position[8][4] = [{ type: 'P', owner: 'white' }] as Stack;
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });
});

describe('validateState — BR-GSFEN-VALID-004 inventory conservation', () => {
  /** All piece types except M (Marshal over-count can't be tested in battle
   *  because BR-GSFEN-VALID-003 Marshal checks fire first — see BR-GSFEN-VALID-004 + deploy M test below). */
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

  describe('white over-count per type (battle)', () => {
    for (const type of NON_M_TYPES) {
      it(`${type} (initial ${INITIAL_COUNTS[type]})`, () => {
        const state = emptyBattleState();
        // Place both Marshals to satisfy BR-GSFEN-VALID-003
        state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
        state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
        // Place initial + 1 pieces
        placePieces(state, type, 'white', INITIAL_COUNTS[type] + 1);
        assertInvalid(state, 'BR-GSFEN-VALID-004');
      });
    }
  });

  describe('black over-count per type (battle)', () => {
    for (const type of NON_M_TYPES) {
      it(`${type} (initial ${INITIAL_COUNTS[type]})`, () => {
        const state = emptyBattleState();
        // Place both Marshals to satisfy BR-GSFEN-VALID-003
        state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
        state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
        // Place initial + 1 pieces
        placePieces(state, type, 'black', INITIAL_COUNTS[type] + 1);
        assertInvalid(state, 'BR-GSFEN-VALID-004');
      });
    }
  });

  describe('white over-count M (deploy — only phase where BR-GSFEN-VALID-004 can fire for M)', () => {
    it('M (initial 1)', () => {
      const state = emptyDeployState();
      // Place 2 white Marshals on board, none in hand
      state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
      state.position[8][5] = [{ type: 'M', owner: 'white' }] as Stack;
      state.hands.white.M = 0;
      // Place black Marshal to make it a valid deploy
      state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
      state.hands.black.M = 0;
      // BR-GSFEN-VALID-003 deploy checks pass (M on board only, not in hand, other M at top)
      // BR-GSFEN-VALID-004 catches M: 2 on board > initial 1
      assertInvalid(state, 'BR-GSFEN-VALID-004');
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
      assertInvalid(state, 'BR-GSFEN-VALID-004');
    });
  });
});

describe('validateState — BR-GSFEN-VALID-005 Done flags', () => {
  it('rejects done flag on the active player', () => {
    const state = emptyDeployState();
    state.turn.done = 'white'; // white is active, can't have done
    assertInvalid(state, 'BR-GSFEN-VALID-005');
  });

  it('rejects done flag when done player has no Marshal on board', () => {
    const state = emptyDeployState();
    state.turn.done = 'black';
    state.turn.activePlayer = 'white';
    // Black has no Marshal on board
    assertInvalid(state, 'BR-GSFEN-VALID-005');
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

describe('validateState — BR-GSFEN-VALID-006 deploy-phase constraints', () => {
  /** Helper: set up a minimal valid deploy state with both Marshals on board at correct zones. */
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
      hands: { white: { ...EMPTY_HAND }, black: { ...EMPTY_HAND } },
    };
  }

  it('rejects white piece in black zone (row 1-3) during deploy', () => {
    const state = minimalDeployState();
    // Place both Marshals on board in correct zones
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // White Pawn in black zone (row 1, col 1 — a separate square from Black Marshal)
    state.position[0][0] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3; // 1 board + 3 hand = 4 = initial
    state.hands.white.M = 0;
    state.hands.black.M = 0;
    assertInvalid(state, 'BR-GSFEN-VALID-006');
  });

  it('rejects black piece in white zone (row 7-9) during deploy', () => {
    const state = minimalDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // Black Pawn in white zone (row 9, col 1 — separate from White Marshal)
    state.position[8][0] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 3;
    state.hands.white.M = 0;
    state.hands.black.M = 0;
    assertInvalid(state, 'BR-GSFEN-VALID-006');
  });

  it('rejects mixed-ownership stack during deploy', () => {
    const state = minimalDeployState();
    // Mixed stack in white zone: White Pawn (bottom), White Marshal (top), Black Pawn (middle)
    state.position[8][4] = [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'black' },
      { type: 'M', owner: 'white' }, // top = Marshal, passes BR-GSFEN-VALID-003
    ] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.white.P = 3;
    state.hands.black.P = 3;
    state.hands.white.M = 0;
    state.hands.black.M = 0;
    assertInvalid(state, 'BR-GSFEN-VALID-006');
  });

  it('accepts deploy state with pieces in correct zones', () => {
    const state = minimalDeployState();
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // Additional white piece in row 8 (idx 7)
    state.position[7][4] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3;
    // Additional black piece in row 2 (idx 1)
    state.position[1][4] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 3;
    state.hands.white.M = 0;
    state.hands.black.M = 0;
    assertValid(state);
  });
});

describe('validateState — BR-GSFEN-VALID-007 counter bounds', () => {
  it('rejects counter 0', () => {
    const state = parseOk('startpos');
    state.turn.counter = 0;
    assertInvalid(state, 'BR-GSFEN-VALID-007');
  });

  it('rejects deploy counter > 50', () => {
    const state = parseOk('startpos');
    state.turn.counter = 51;
    assertInvalid(state, 'BR-GSFEN-VALID-007');
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
});

describe('validateState — multi-rule violations (first-rule ordering)', () => {
  it('BR-GSFEN-VALID-002 fires before BR-GSFEN-VALID-003: bad stack + missing Marshal', () => {
    const state = emptyBattleState();
    // BR-GSFEN-VALID-002: stack of 4 pieces
    state.position[4][4] = [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as unknown as Stack;
    // No Marshals at all (would be BR-GSFEN-VALID-003)
    assertInvalid(state, 'BR-GSFEN-VALID-002');
  });

  it('BR-GSFEN-VALID-003 fires before BR-GSFEN-VALID-004: Marshal not at top + piece over-count', () => {
    const state = emptyBattleState();
    // BR-GSFEN-VALID-003: Marshal buried under Pawn
    state.position[4][4] = [
      { type: 'M', owner: 'white' },
      { type: 'P', owner: 'white' },
    ] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // Also over-count A: 3 on board (initial 2) — uses row 5
    state.position[4][5] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][6] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][7] = [{ type: 'A', owner: 'white' }] as Stack;
    // BR-GSFEN-VALID-003 fires first (Marshal not at top) before BR-GSFEN-VALID-004 would be checked
    assertInvalid(state, 'BR-GSFEN-VALID-003');
  });

  it('BR-GSFEN-VALID-004 fires before BR-GSFEN-VALID-005: over-count + bad done flag', () => {
    const state = emptyBattleState();
    // Place both Marshals to pass BR-GSFEN-VALID-003
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    // BR-GSFEN-VALID-004: over-count Archer (3 on board, initial 2)
    state.position[4][4] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][5] = [{ type: 'A', owner: 'white' }] as Stack;
    state.position[4][6] = [{ type: 'A', owner: 'white' }] as Stack;
    // BR-GSFEN-VALID-005 would also fail: done flag on active player
    state.turn.done = 'white';
    // BR-GSFEN-VALID-004 is checked before BR-GSFEN-VALID-005, so BR-GSFEN-VALID-004 fires first
    assertInvalid(state, 'BR-GSFEN-VALID-004');
  });

  it('BR-GSFEN-VALID-005 fires before BR-GSFEN-VALID-006: bad done flag + white piece in black zone (deploy)', () => {
    const state = emptyDeployState();
    // BR-GSFEN-VALID-005: done flag on active player
    state.turn.done = 'white'; // white is active
    // BR-GSFEN-VALID-006: white piece in black zone (row 1)
    state.position[0][0] = [{ type: 'P', owner: 'white' }] as Stack;
    state.hands.white.P = 3;
    // Both Marshals on board in proper zones
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // BR-GSFEN-VALID-005 fires before BR-GSFEN-VALID-006
    assertInvalid(state, 'BR-GSFEN-VALID-005');
  });

  it('BR-GSFEN-VALID-006 fires before BR-GSFEN-VALID-007: deploy zone violation + bad counter', () => {
    const state = emptyDeployState();
    // Place both Marshals in correct zones to pass BR-GSFEN-VALID-003
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.hands.white.M = 0;
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.hands.black.M = 0;
    // BR-GSFEN-VALID-006: black piece in white zone (row 9)
    state.position[8][0] = [{ type: 'P', owner: 'black' }] as Stack;
    state.hands.black.P = 4; // 1 board + 4 in FULL_HAND = 5 exceeds initial 4? No...
    // Use EMPTY_HAND-based state. Actually emptyDeployState uses FULL_HAND.
    // Black P initial is 4, FULL_HAND has P:4. Adding 1 board = 5 > 4, that's BR-GSFEN-VALID-004.
    // Let me adjust: reduce hand P to 3 so board 1 + hand 3 = 4 = initial.
    state.hands.black.P = 3;
    // BR-GSFEN-VALID-007 would also fail: counter 0
    state.turn.counter = 0;
    // BR-GSFEN-VALID-006 fires before BR-GSFEN-VALID-007
    assertInvalid(state, 'BR-GSFEN-VALID-006');
  });
});
