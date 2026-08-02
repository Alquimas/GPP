import { describe, it, expect } from 'vitest';
import { PIECE_NAMES, INITIAL_COUNTS, PIECE_MOVEMENT, START_GSFEN } from '../src/constants.js';
import type { PieceType } from '../src/types.js';
import { STARTPOS_EXPANDED } from './support/fixtures.js';

const ALL_TYPES: PieceType[] = [
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

describe('PIECE_NAMES', () => {
  it('covers exactly the 14 piece types', () => {
    expect(Object.keys(PIECE_NAMES).sort()).toEqual([...ALL_TYPES].sort());
  });
});

describe('INITIAL_COUNTS', () => {
  it('covers exactly the 14 piece types', () => {
    expect(Object.keys(INITIAL_COUNTS).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('sums to 25 pieces per player (RULES.md inventory, GSFEN startpos)', () => {
    const total = Object.values(INITIAL_COUNTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(25);
  });
});

describe('PIECE_MOVEMENT', () => {
  it('covers exactly the 14 piece types', () => {
    expect(Object.keys(PIECE_MOVEMENT).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('every piece type has at least one movement option', () => {
    for (const t of ALL_TYPES) {
      const def = PIECE_MOVEMENT[t];
      const options =
        def.step.length + def.limitedRange.length + def.range.length + def.jumps.length;
      expect(options, `piece ${t} has no movement`).toBeGreaterThan(0);
    }
  });

  it('spot-checks against RULES.md piece reference', () => {
    // Marshal: step in all 8 directions
    expect(PIECE_MOVEMENT.M.step).toHaveLength(8);
    // General: range in 4 orthogonal, step in 4 diagonal
    expect(PIECE_MOVEMENT.G.range).toEqual(['F', 'B', 'L', 'R']);
    expect(PIECE_MOVEMENT.G.step).toEqual(['FL', 'FR', 'BL', 'BR']);
    // Cannon: jump dest (0,+3) over [(0,+1), (0,+2)]
    expect(PIECE_MOVEMENT.C.jumps).toEqual([
      {
        dest: { col: 0, row: 3 },
        over: [
          { col: 0, row: 1 },
          { col: 0, row: 2 },
        ],
      },
    ]);
    // Archer: 3 jump patterns
    expect(PIECE_MOVEMENT.A.jumps).toHaveLength(3);
    // Captain: step FL, FR, B
    expect(PIECE_MOVEMENT.T.step).toEqual(['FL', 'FR', 'B']);
  });
});

describe('START_GSFEN', () => {
  it('is the canonical startpos expansion (GSFEN.md)', () => {
    expect(START_GSFEN).toBe(STARTPOS_EXPANDED);
  });
});
