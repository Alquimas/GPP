import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGSFEN, type ParseResult } from '../../src/gsfen/parse.js';
import { EMPTY_HAND, FULL_HAND } from '../../src/constants.js';
import type { GameState, Player } from '../../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a .gsfen fixture file by name (without extension). */
function readFixture(name: string): string {
  return readFileSync(join(__dirname, '..', '..', '..', 'gsfen', `${name}.gsfen`), 'utf-8').trim();
}

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

  it('startpos with extra whitespace is rejected', () => {
    const result = parseGSFEN('  startpos  ');
    // The trim in parseGSFEN handles it — it's still 'startpos' after trim
    expect(result.ok).toBe(true);
  });

  it('Startpos (capital S) is NOT the keyword', () => {
    const result = parseGSFEN('Startpos');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C1');
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
      const raw = name === 'startpos' ? 'startpos' : readFixture(name);
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
    const raw = readFixture('battle-start');
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
    const raw = readFixture('sparse-board');
    const result = parseGSFEN(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    expect(state.turn.phase).toBe('battle');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.counter).toBe(35);
  });

  it('all-on-board has both hands empty (-)', () => {
    const raw = readFixture('all-on-board');
    const state = assertOk(parseGSFEN(raw));
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
  });

  it('three-deep-stacks has stacks with 3 pieces', () => {
    const raw = readFixture('three-deep-stacks');
    const state = assertOk(parseGSFEN(raw));
    // Row 5 (idx 4), Col 5 (idx 4): "PYT" — White Pawn, White Spy, White Captain
    const stack = state.position[4][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack.length).toBe(3);
      expect(stack[0].type).toBe('P');
      expect(stack[0].owner).toBe('white');
      expect(stack[1].type).toBe('Y');
      expect(stack[2].type).toBe('T');
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
    const gsfen = '9/9/9/9/9/9/9/9/4,M,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2';
    const state = assertOk(parseGSFEN(gsfen));

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
    const gsfen =
      '4,g,4/4,m,4/9/9/9/9/9/4,G,4/4,M,4 dwB 2AC3E2F2JL2N4P2STU2Y2ac3e2f2jl2n4p2stu2y 5';
    const state = assertOk(parseGSFEN(gsfen));

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
    const gsfen = '4,m,4/9/9/9/4,PyT,4/9/9/9/4,M,4 w 2AC3E2FG2JL2N3P2SU2Y2ac3e2fg2jl2n4p2stuy 12';
    const state = assertOk(parseGSFEN(gsfen));

    // Stack at (row 5, col 5) → position[4][4]
    const stack = state.position[4][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack.length).toBe(3);
      // Bottom: White Pawn (P)
      expect(stack[0].type).toBe('P');
      expect(stack[0].owner).toBe('white');
      // Middle: Black Spy (y)
      expect(stack[1].type).toBe('Y');
      expect(stack[1].owner).toBe('black');
      // Top: White Captain (T)
      expect(stack[2].type).toBe('T');
      expect(stack[2].owner).toBe('white');
    }

    expect(state.turn.phase).toBe('battle');
    expect(state.turn.activePlayer).toBe('white');
    expect(state.turn.done).toBeNull();
    expect(state.turn.counter).toBe(12);
  });
});

describe('parseGSFEN — invalid spellings from GSFEN.md', () => {
  it('C3: adjacent empty runs not merged (4,1 instead of 5)', () => {
    const gsfen = '9/9/9/9/9/9/9/9/4,1,M,3 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2';
    const result = parseGSFEN(gsfen);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C3');
  });

  it('C6: leading zero in counter', () => {
    const gsfen = '9/9/9/9/9/9/9/9/M,8 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 02';
    const result = parseGSFEN(gsfen);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C6');
  });

  it('V3 bug: lowercase m on row 9 (Black Marshal in wrong zone + White Marshal missing)', () => {
    // This should parse OK (the parser just checks C1-C7), the semantic
    // validation (V3, V6) would reject it.
    const gsfen = '9/9/9/9/9/9/9/9/4,m,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2';
    const result = parseGSFEN(gsfen);
    // It parses correctly — lowercase = black owner
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    const stack = state.position[8][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].owner).toBe('black');
    }
  });

  it('V3: Marshal not at top of stack', () => {
    const gsfen = '9/9/9/9/9/9/9/9/4,MP,4 dw 2AC3E2FG2JL2N3P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2';
    const result = parseGSFEN(gsfen);
    // Parser parses it fine (C1-C7 ok), validation should catch it
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state;
    const stack = state.position[8][4];
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack.length).toBe(2);
      expect(stack[0].type).toBe('M'); // bottom
      expect(stack[1].type).toBe('P'); // top
    }
  });
});

describe('parseGSFEN — additional invalid cases', () => {
  it('wrong number of fields', () => {
    const result = parseGSFEN('a b c');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C1');
  });

  it('empty input', () => {
    const result = parseGSFEN('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C1');
  });

  it('wrong number of rows', () => {
    const result = parseGSFEN('9/9/9 w - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C1');
  });

  it('unknown piece letter', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/4,X,4 dw - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C2');
  });

  it('invalid turn token', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 x - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C1');
  });

  it('stack with 4 letters', () => {
    const result = parseGSFEN('4,MPTS,4/9/9/9/9/9/9/9/9 dw - 1');
    expect(result.ok).toBe(false);
  });

  it('hand duplicate letter', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 dw AAP 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C5');
  });

  it('hand non-alphabetical order', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 dw PA 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C5');
  });

  it('hand lowercase only (white empty, black has piece)', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 dw a 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands.black.A).toBe(1);
    expect(result.state.hands.white.A).toBe(0);
  });

  it('counter with leading zero', () => {
    const result = parseGSFEN('9/9/9/9/9/9/9/9/9 w - 01');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C6');
  });

  it('row does not sum to 9 squares', () => {
    const result = parseGSFEN('8/9/9/9/9/9/9/9/9 w - 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('C2');
  });
});

describe('parseGSFEN — coordinate mapping', () => {
  it('piece at Col 1 maps to position[row][0]', () => {
    // Row 9 has 8 empty squares then one piece at Col 1
    const gsfen = '9/9/9/9/9/9/9/9/8,M dw - 1';
    const state = assertOk(parseGSFEN(gsfen));
    const stack = state.position[8][0]; // Col 1 → idx 0
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].type).toBe('M');
    }
  });

  it('piece at Col 9 maps to position[row][8]', () => {
    // Row 9 has piece at Col 9 then 8 empty
    const gsfen = '9/9/9/9/9/9/9/9/M,8 dw - 1';
    const state = assertOk(parseGSFEN(gsfen));
    const stack = state.position[8][8]; // Col 9 → idx 8
    expect(stack).not.toBeNull();
    if (stack) {
      expect(stack[0].type).toBe('M');
    }
  });

  it('full row mapping is correct: 3,P,2,T,2', () => {
    // GSFEN row: "3" (Cols 9,8,7 empty), "P" (Col 6 White Pawn),
    //            "2" (Cols 5,4 empty), "T" (Col 3 White Captain),
    //            "2" (Cols 2,1 empty)
    // position[row][*]:
    //   idx 8 (Col 9): null
    //   idx 7 (Col 8): null
    //   idx 6 (Col 7): null
    //   idx 5 (Col 6): [White Pawn]
    //   idx 4 (Col 5): null
    //   idx 3 (Col 4): null
    //   idx 2 (Col 3): [White Captain]
    //   idx 1 (Col 2): null
    //   idx 0 (Col 1): null
    const gsfen = '3,P,2,T,2/9/9/9/9/9/9/9/9 w - 1';
    const state = assertOk(parseGSFEN(gsfen));

    expect(state.position[0][8]).toBeNull(); // Col 9
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
      expect(col3[0].type).toBe('T');
      expect(col3[0].owner).toBe('white');
    }

    expect(state.position[0][1]).toBeNull(); // Col 2
    expect(state.position[0][0]).toBeNull(); // Col 1
  });
});
