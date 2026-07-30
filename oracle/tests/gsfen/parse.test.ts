import { describe, it, expect } from 'vitest';
import { parseGSFEN, type ParseResult } from '../../src/gsfen/parse.js';
import { EMPTY_HAND, FULL_HAND } from '../../src/constants.js';
import type { GameState, Player } from '../../src/types.js';
import {
  BLACK_DONE_DECLARED,
  C2_UNKNOWN_PIECE,
  C3_ADJACENT_EMPTY_RUNS,
  C5_DUPLICATE_LETTER,
  C5_NON_ALPHABETICAL,
  C6_LEADING_ZERO_COUNTER,
  C6_LEADING_ZERO_COUNTER_FULL,
  DEPLOY_BLACK_MARSHAL_PLACED,
  DEPLOY_MARSHAL_COL1,
  DEPLOY_MARSHAL_COL9,
  DEPLOY_MARSHAL_ON_TOP,
  EXAMPLE4_MIXED_STACK,
  FIXTURES,
  ROW_NOT_9,
  ROW_WITH_P_AND_T,
  STACK_OF_FOUR,
  WHITE_MARSHAL_AT_5_9,
} from '../support/fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a parse is successful and return the state. */
function assertOk(result: ParseResult): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseGSFEN — startpos keyword', () => {
  it('expands startpos to START_GSFEN', () => {
    const result = parseGSFEN('startpos');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const state = result.state;

    // Empty board
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(state.position[r][c]).toBeNull();
      }
    }

    // Deploy phase, white to place
    expect(state.turn.phase).toBe('deploy');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.done).toBeNull();
    expect(state.turn.counter).toBe(1);

    // Full hands
    expect(state.hands.white).toEqual(FULL_HAND);
    expect(state.hands.black).toEqual(FULL_HAND);
  });

  it('startpos with leading/trailing whitespace is rejected (BR-GSFEN-CANON-SEPARATOR-WHITESPACE)', () => {
    const result = parseGSFEN('  startpos  ');
    expect(result.ok).toBe(false);
    if (result.ok) return; // unreachable — narrows type to error branch
    expect(result.error.rule).toBe('BR-GSFEN-CANON-SEPARATOR-WHITESPACE');
  });

  it('Startpos (capital S) is NOT the keyword (BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT)', () => {
    const result = parseGSFEN('Startpos');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // "Startpos" has no spaces → split(' ') gives ['Startpos'] → length 1 ≠ 4
    expect(result.error.rule).toBe('BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT');
  });
});

describe('parseGSFEN — sample files', () => {
  const samples: { name: string; phase: string; active: Player; expectedCounter: number }[] = [
    { name: 'startpos', phase: 'deploy', active: 'white', expectedCounter: 1 },
    { name: 'battle-start', phase: 'battle', active: 'white', expectedCounter: 1 },
    { name: 'battle-midgame', phase: 'battle', active: 'white', expectedCounter: 14 },
    { name: 'deploy-stacks-in-zones', phase: 'deploy', active: 'white', expectedCounter: 9 },
    { name: 'deploy-near-end', phase: 'deploy', active: 'black', expectedCounter: 12 },
    { name: 'black-done-declared', phase: 'deploy', active: 'white', expectedCounter: 5 },
    { name: 'white-done-declared', phase: 'deploy', active: 'black', expectedCounter: 6 },
    { name: 'both-marshals-placed', phase: 'deploy', active: 'white', expectedCounter: 3 },
    { name: 'white-marshal-at-5-9', phase: 'deploy', active: 'black', expectedCounter: 2 },
    { name: 'capture-aftermath', phase: 'battle', active: 'black', expectedCounter: 22 },
    { name: 'dense-engagement', phase: 'battle', active: 'white', expectedCounter: 45 },
    { name: 'some-captured', phase: 'battle', active: 'white', expectedCounter: 20 },
    { name: 'three-deep-stacks', phase: 'battle', active: 'black', expectedCounter: 18 },
    { name: 'all-on-board', phase: 'battle', active: 'white', expectedCounter: 1 },
  ];

  for (const { name, phase, active, expectedCounter } of samples) {
    it(`parses ${name}.gsfen correctly`, () => {
      // startpos.gsfen just contains "startpos"
      const raw = FIXTURES[name];
      const result = parseGSFEN(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const state = result.state;
      expect(state.turn.phase).toBe(phase);
      expect(state.turn.activePlayer).toBe(active);
      expect(state.turn.counter).toBe(expectedCounter);
    });
  }

  it('battle-start has expected board setup', () => {
    const raw = FIXTURES['battle-start'];
    const state = assertOk(parseGSFEN(raw));

    // Row 1 (idx 0): 4 empty, Black Marshal (m) at Col 5, 4 empty
    // GSFEN: "4,m,4"
    // position[0][col-1]: col 5 → idx 4 should have stack with Black Marshal
    const row0col5 = state.position[0][4];
    expect(row0col5).not.toBeNull();
    if (row0col5) {
      expect(row0col5[0].type).toBe('M');
      expect(row0col5[0].owner).toBe('black');
    }

    // Row 9 (idx 8): 4 empty, White Marshal (M) at Col 5, 4 empty
    const row8col5 = state.position[8][4];
    expect(row8col5).not.toBeNull();
    if (row8col5) {
      expect(row8col5[0].type).toBe('M');
      expect(row8col5[0].owner).toBe('white');
    }
  });

  it('sparse-board parses successfully (9 rows after fix)', () => {
    const raw = FIXTURES['sparse-board'];
    const result = parseGSFEN(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    expect(state.turn.phase).toBe('battle');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.counter).toBe(35);
  });

  it('all-on-board has both hands empty (-)', () => {
    const raw = FIXTURES['all-on-board'];
    const state = assertOk(parseGSFEN(raw));
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
  });

  it('three-deep-stacks has stacks with 3 pieces', () => {
    const raw = FIXTURES['three-deep-stacks'];
    const state = assertOk(parseGSFEN(raw));
    // Row 5 (idx 4), Col 5 (idx 4): "PYT" — White Pawn, White Spy, White Captain
    const stack = state.position[4][4];
    expect(stack).not.toBeNull();
    if (stack?.length === 3) {
      expect(stack[0].type).toBe('P');
      expect(stack[0].owner).toBe('white');
      expect(stack[1].type).toBe('Y');
      expect(stack[2].type).toBe('T');
    } else if (stack) {
      expect(stack.length).toBe(3);
    }
  });
});

describe('parseGSFEN — worked examples from GSFEN.md', () => {
  // Example 1: Game start (startpos → expanded)
  it('Example 1: startpos expands correctly', () => {
    const state = assertOk(parseGSFEN('startpos'));

    expect(state.turn.phase).toBe('deploy');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.hands.white).toEqual(FULL_HAND);
    expect(state.hands.black).toEqual(FULL_HAND);
  });

  // Example 2: White's first Placement (Marshal at 5-9); Black to place
  it('Example 2: White Marshal at 5-9, Black to place', () => {
    const state = assertOk(parseGSFEN(WHITE_MARSHAL_AT_5_9));

    // Row 9 (idx 8): 4 empty, White Marshal at Col 5, 4 empty
    const stack = state.position[8][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack.length).toBe(1);
      expect(stack[0].type).toBe('M');
      expect(stack[0].owner).toBe('white');
    }

    expect(state.turn.phase).toBe('deploy');
    expect(state.turn.activePlayer).toBe('black');
    expect(state.turn.counter).toBe(2);

    // White's hand should NOT have Marshal
    expect(state.hands.white.M).toBe(0);
    // Black's hand should still have Marshal
    expect(state.hands.black.M).toBe(1);
  });

  // Example 3: Mid-deploy; Black has declared Done; White to place
  it('Example 3: Black done, White to place', () => {
    const state = assertOk(parseGSFEN(BLACK_DONE_DECLARED));

    // Black Marshal at (row 2, col 5) → position[1][4]
    const blackM = state.position[1][4];
    expect(blackM).not.toBeNull();
    if (blackM) {
      expect(blackM[0].type).toBe('M');
      expect(blackM[0].owner).toBe('black');
    }

    // White Marshal at (row 9, col 5) → position[8][4]
    const whiteM = state.position[8][4];
    expect(whiteM).not.toBeNull();
    if (whiteM) {
      expect(whiteM[0].type).toBe('M');
      expect(whiteM[0].owner).toBe('white');
    }

    expect(state.turn.phase).toBe('deploy');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.done).toBe('black');
    expect(state.turn.counter).toBe(5);
  });

  // Example 4: Regular play with mixed-ownership stack; White to move, turn 12
  it('Example 4: Mixed stack at 5-5', () => {
    const state = assertOk(parseGSFEN(EXAMPLE4_MIXED_STACK));

    // Stack at (row 5, col 5) → position[4][4]
    const stack = state.position[4][4];
    expect(stack).not.toBeNull();
    // Narrow tuple type via length check
    if (stack?.length === 3) {
      // Bottom: White Pawn (P)
      expect(stack[0].type).toBe('P');
      expect(stack[0].owner).toBe('white');
      // Middle: Black Spy (y)
      expect(stack[1].type).toBe('Y');
      expect(stack[1].owner).toBe('black');
      // Top: White Captain (T)
      expect(stack[2].type).toBe('T');
      expect(stack[2].owner).toBe('white');
    } else {
      expect(stack).not.toBeNull();
    }

    expect(state.turn.phase).toBe('battle');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.done).toBeNull();
    expect(state.turn.counter).toBe(12);
  });
});

describe('parseGSFEN — invalid spellings from GSFEN.md', () => {
  it('BR-GSFEN-CANON-POSITION-COMPRESSION: adjacent empty runs not merged (4,1 instead of 5)', () => {
    const result = parseGSFEN(C3_ADJACENT_EMPTY_RUNS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-COMPRESSION');
  });

  it('BR-GSFEN-CANON-COUNTER-LEADING-ZERO: leading zero in counter', () => {
    const result = parseGSFEN(C6_LEADING_ZERO_COUNTER_FULL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-COUNTER-LEADING-ZERO');
  });

  it('Black Marshal at row 1 (valid deploy zone) — parses correctly', () => {
    const result = parseGSFEN(DEPLOY_BLACK_MARSHAL_PLACED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    const stack = state.position[0][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].type).toBe('M');
      expect(stack[0].owner).toBe('black');
    }
  });

  it('Marshal on top of Pawn stack — parses correctly', () => {
    const result = parseGSFEN(DEPLOY_MARSHAL_ON_TOP);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    const stack = state.position[8][4];
    expect(stack).not.toBeNull();
    if (stack?.length === 2) {
      expect(stack[0].type).toBe('P'); // bottom
      expect(stack[1].type).toBe('M'); // top
    } else if (stack) {
      expect(stack.length).toBe(2);
    }
  });
});

describe('parseGSFEN — additional invalid cases', () => {
  it('wrong number of fields (BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT)', () => {
    const result = parseGSFEN('a b c');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT');
  });

  it('empty input (BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT)', () => {
    const result = parseGSFEN('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT');
  });

  it('wrong number of rows (BR-GSFEN-CANON-POSITION-ROW-COUNT)', () => {
    const result = parseGSFEN('9/9/9 w - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-ROW-COUNT');
  });

  it('unknown piece letter (BR-GSFEN-CANON-POSITION-STACK-SPELLING)', () => {
    const result = parseGSFEN(C2_UNKNOWN_PIECE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-STACK-SPELLING');
  });

  it('invalid turn token (BR-GSFEN-CANON-TURN-TOKEN)', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 x - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-TURN-TOKEN');
  });

  it('stack with 4 letters (BR-GSFEN-CANON-POSITION-STACK-SPELLING)', () => {
    const result = parseGSFEN(STACK_OF_FOUR);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-STACK-SPELLING');
  });

  it('hand duplicate letter (BR-GSFEN-CANON-HANDS-DUPLICATE)', () => {
    const result = parseGSFEN(C5_DUPLICATE_LETTER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-HANDS-DUPLICATE');
  });

  it('hand non-alphabetical order (BR-GSFEN-CANON-HANDS-ALPHABETICAL)', () => {
    const result = parseGSFEN(C5_NON_ALPHABETICAL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-HANDS-ALPHABETICAL');
  });

  it('counter with leading zero (BR-GSFEN-CANON-COUNTER-LEADING-ZERO)', () => {
    const result = parseGSFEN(C6_LEADING_ZERO_COUNTER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-COUNTER-LEADING-ZERO');
  });

  it('row does not sum to 9 squares (BR-GSFEN-CANON-POSITION-SQUARE-COUNT)', () => {
    const result = parseGSFEN(ROW_NOT_9);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GSFEN-CANON-POSITION-SQUARE-COUNT');
  });
});

describe('parseGSFEN — coordinate mapping', () => {
  it('piece at Col 1 maps to position[row][0]', () => {
    // Row 9 has 8 empty squares then one piece at Col 1
    const state = assertOk(parseGSFEN(DEPLOY_MARSHAL_COL1));
    const stack = state.position[8][0]; // Col 1 → idx 0
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].type).toBe('M');
    }
  });

  it('piece at Col 9 maps to position[row][8]', () => {
    // Row 9 has piece at Col 9 then 8 empty
    const state = assertOk(parseGSFEN(DEPLOY_MARSHAL_COL9));
    const stack = state.position[8][8]; // Col 9 → idx 8
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].type).toBe('M');
    }
  });

  it('full row mapping is correct: M,2,P,2,T,2', () => {
    // GSFEN row: "M" (Col 9 White Marshal),
    //            "2" (Cols 8,7 empty), "P" (Col 6 White Pawn),
    //            "2" (Cols 5,4 empty), "T" (Col 3 Black Marshal),
    //            "2" (Cols 2,1 empty)
    // position[row][*]:
    //   idx 8 (Col 9): [White Marshal]
    //   idx 7 (Col 8): null
    //   idx 6 (Col 7): null
    //   idx 5 (Col 6): [White Pawn]
    //   idx 4 (Col 5): null
    //   idx 3 (Col 4): null
    //   idx 2 (Col 3): [Black Marshal]
    //   idx 1 (Col 2): null
    //   idx 0 (Col 1): null
    const state = assertOk(parseGSFEN(ROW_WITH_P_AND_T));

    const col9 = state.position[0][8]; // Col 9
    expect(col9).not.toBeNull();
    if (col9) {
      expect(col9[0].type).toBe('M');
      expect(col9[0].owner).toBe('white');
    }

    expect(state.position[0][7]).toBeNull(); // Col 8
    expect(state.position[0][6]).toBeNull(); // Col 7

    const col6 = state.position[0][5]; // Col 6
    expect(col6).not.toBeNull();
    if (col6) {
      expect(col6[0].type).toBe('P');
      expect(col6[0].owner).toBe('white');
    }

    expect(state.position[0][4]).toBeNull(); // Col 5
    expect(state.position[0][3]).toBeNull(); // Col 4

    const col3 = state.position[0][2]; // Col 3
    expect(col3).not.toBeNull();
    if (col3) {
      expect(col3[0].type).toBe('M');
      expect(col3[0].owner).toBe('black');
    }

    expect(state.position[0][1]).toBeNull(); // Col 2
    expect(state.position[0][0]).toBeNull(); // Col 1
  });
});
