import { type Hand, type MovementDef, type PieceType } from './types.js';

/** Canonical alphabetical order of all 14 piece types. */
export const ALL_PIECE_TYPES: PieceType[] = [
  'A',
  'C',
  'E',
  'F',
  'G',
  'J',
  'L',
  'M',
  'N',
  'P',
  'S',
  'T',
  'U',
  'Y',
];

/** Letter → full English name. */
export const PIECE_NAMES: Record<PieceType, string> = {
  A: 'Archer',
  C: 'Cannon',
  E: 'Spear',
  F: 'Fortress',
  G: 'General',
  J: 'Major',
  L: 'Lieutenant',
  M: 'Marshal',
  N: 'Knight',
  P: 'Pawn',
  S: 'Samurai',
  T: 'Captain',
  U: 'Musketeer',
  Y: 'Spy',
};

/** Letter → initial count per player (per GSFEN.md piece table). */
export const INITIAL_COUNTS: Record<PieceType, number> = {
  A: 2,
  C: 1,
  E: 3,
  F: 2,
  G: 1,
  J: 2,
  L: 1,
  M: 1,
  N: 2,
  P: 4,
  S: 2,
  T: 1,
  U: 1,
  Y: 2,
};

/** A Hand record with every count at 0 — the canonical empty hand.
 * Frozen at runtime to prevent accidental mutation of the shared instance
 * (used as a default return value in parseHands and as an export).
 */
export const EMPTY_HAND: Hand = Object.freeze({
  A: 0,
  C: 0,
  E: 0,
  F: 0,
  G: 0,
  J: 0,
  L: 0,
  M: 0,
  N: 0,
  P: 0,
  S: 0,
  T: 0,
  U: 0,
  Y: 0,
});

/** A Hand record with every count at its initial value — the canonical full hand.
 * Frozen at runtime to prevent accidental mutation of the shared instance.
 */
export const FULL_HAND: Hand = Object.freeze({ ...INITIAL_COUNTS });

/**
 * Declarative movement rules per piece type (White's perspective).
 * Pure data — the movement engine derives concrete destinations at runtime,
 * applying stack-size scaling per BR-MOVEMENT-005:
 *   size 1 — base (step = 1 sq, limited-range max 2)
 *   size 2 — +1 (step → 1-2, limited-range max 3, jump extends)
 *   size 3 — +2 (step → 1-3, limited-range max 4, jump extends)
 * Range movement is unaffected by the stack bonus.
 */
export const PIECE_MOVEMENT: Record<PieceType, MovementDef> = {
  // Marshal: step in all 8 directions
  M: { step: ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'], limitedRange: [], range: [], jumps: [] },

  // General: range in orthogonal, step in diagonal
  G: { step: ['FL', 'FR', 'BL', 'BR'], limitedRange: [], range: ['F', 'B', 'L', 'R'], jumps: [] },

  // Lieutenant: range in diagonal, step in orthogonal
  L: { step: ['F', 'B', 'L', 'R'], limitedRange: [], range: ['FL', 'FR', 'BL', 'BR'], jumps: [] },

  // Major: step in F, B, L, R, FL, FR
  J: { step: ['F', 'B', 'L', 'R', 'FL', 'FR'], limitedRange: [], range: [], jumps: [] },

  // Samurai: step in F, FL, FR, B
  S: { step: ['F', 'FL', 'FR', 'B'], limitedRange: [], range: [], jumps: [] },

  // Spear: limited-range F + step FL, FR, B
  E: { step: ['FL', 'FR', 'B'], limitedRange: ['F'], range: [], jumps: [] },

  // Knight: limited-range F, B + step L, R
  N: { step: ['L', 'R'], limitedRange: ['F', 'B'], range: [], jumps: [] },

  // Spy: limited-range in all 4 diagonals
  Y: { step: [], limitedRange: ['FL', 'FR', 'BL', 'BR'], range: [], jumps: [] },

  // Fortress: step in F, L, R, BL, BR
  F: { step: ['F', 'L', 'R', 'BL', 'BR'], limitedRange: [], range: [], jumps: [] },

  // Pawn: step in F, B
  P: { step: ['F', 'B'], limitedRange: [], range: [], jumps: [] },

  // Cannon: step L, R, B + jump (0,+3) over [(0,+1), (0,+2)]
  C: {
    step: ['L', 'R', 'B'],
    limitedRange: [],
    range: [],
    jumps: [
      {
        dest: { col: 0, row: 3 },
        over: [
          { col: 0, row: 1 },
          { col: 0, row: 2 },
        ],
      },
    ],
  },

  // Archer: step B + 3 jumps (right, forward, left)
  A: {
    step: ['B'],
    limitedRange: [],
    range: [],
    jumps: [
      { dest: { col: -1, row: 2 }, over: [{ col: 0, row: 1 }] },
      { dest: { col: 0, row: 2 }, over: [{ col: 0, row: 1 }] },
      { dest: { col: 1, row: 2 }, over: [{ col: 0, row: 1 }] },
    ],
  },

  // Musketeer: step BL, BR + jump (0,+2) over [(0,+1)]
  U: {
    step: ['BL', 'BR'],
    limitedRange: [],
    range: [],
    jumps: [{ dest: { col: 0, row: 2 }, over: [{ col: 0, row: 1 }] }],
  },

  // Captain: step FL, FR, B
  T: { step: ['FL', 'FR', 'B'], limitedRange: [], range: [], jumps: [] },
};

/** The known startpos GSFEN string (canonical expansion of the `startpos` keyword, GSFEN.md). */
export const START_GSFEN = '9/9/9/9/9/9/9/9/9 dw 2AC3E2FG2JLM2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1';
