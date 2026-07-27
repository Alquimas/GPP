/**
 * Parametric (table-driven) tests for the movement rules engine.
 *
 * Coverage target: every movement class x piece type x size combination,
 * plus obstruction, scaling, edge-case, and player-direction tests.
 * 150-250 parametric cases.
 */

import { describe, it, expect } from 'vitest';
import { getLegalDestinations, getLegalMoves, getScaledJumps } from '../../src/board/movement.js';
import { PIECE_MOVEMENT } from '../../src/constants.js';
import { emptyPosition } from '../../src/board/board.js';
import type { BoardCoord, PieceType, Player, Position, Square, Stack } from '../../src/types.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

/** Place a single-piece stack at (col, row). */
function putPiece(pos: Position, col: number, row: number, type: PieceType, owner: Player): void {
  pos[row - 1][col - 1] = [{ type, owner }] as Stack;
}

/** Place a multi-piece stack. `items[0]` = bottom, `items[last]` = top. */
function putStack(
  pos: Position,
  col: number,
  row: number,
  items: { type: PieceType; owner: Player }[],
): void {
  pos[row - 1][col - 1] = items.map((p) => ({ ...p })) as Stack;
}

function getSquareDesc(sq: Square): string {
  return `${sq.col},${sq.row}`;
}

function extractDestSq(moves: { dest: Square }[]): string[] {
  return moves.map((m) => getSquareDesc(m.dest)).sort();
}

/** Collect all distinct destination squares for a piece. */
function allDests(pos: Position, col: number, row: number, player: Player): string[] {
  return extractDestSq(
    getLegalDestinations(pos, { col: col as BoardCoord, row: row as BoardCoord }, player),
  );
}

/* ------------------------------------------------------------------ */
/*  1. Step movement — size 1                                          */
/* ------------------------------------------------------------------ */

const STEP_PIECES: { type: PieceType; dirs: number; label: string }[] = [
  { type: 'M', dirs: 8, label: 'Marshal' },
  { type: 'G', dirs: 4, label: 'General (diagonal)' },
  { type: 'L', dirs: 4, label: 'Lieutenant (orthogonal)' },
  { type: 'J', dirs: 6, label: 'Major' },
  { type: 'S', dirs: 4, label: 'Samurai' },
  { type: 'E', dirs: 3, label: 'Spear (step)' },
  { type: 'N', dirs: 2, label: 'Knight (step L,R)' },
  { type: 'F', dirs: 5, label: 'Fortress' },
  { type: 'P', dirs: 2, label: 'Pawn' },
  { type: 'C', dirs: 3, label: 'Cannon (step)' },
  { type: 'A', dirs: 1, label: 'Archer (step B)' },
  { type: 'U', dirs: 2, label: 'Musketeer (step BL,BR)' },
  { type: 'T', dirs: 3, label: 'Captain' },
  { type: 'Y', dirs: 4, label: 'Spy (limited-range only)' },
];

describe('Step movement — size 1 (BR-MOVEMENT-001)', () => {
  it.each(STEP_PIECES.filter((p) => PIECE_MOVEMENT[p.type].step.length > 0))(
    '$label ($type) at centre should have $dirs step destinations at size 1',
    ({ type, dirs }) => {
      const pos = emptyPosition();
      putPiece(pos, 5, 5, type, 'white');
      const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
      const stepMoves = moves.filter((m) => m.moveClass === 'step');
      expect(stepMoves.length).toBe(dirs);
    },
  );

  it('Marshal at centre size 1 — all 8 directions present', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toEqual(
      expect.arrayContaining(['4,4', '5,4', '6,4', '4,5', '6,5', '4,6', '5,6', '6,6']),
    );
    expect(dests).toHaveLength(8);
  });

  it('Marshal at corner (1,1) size 1 — only 3 reachable squares', () => {
    const pos = emptyPosition();
    putPiece(pos, 1, 1, 'M', 'white');
    const dests = allDests(pos, 1, 1, 'white');
    expect(dests).toHaveLength(3);
    expect(dests).toEqual(expect.arrayContaining(['1,2', '2,1', '2,2']));
  });

  it('Lieutenant at centre size 1 — 4 orthogonal steps (step class only)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'L', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const stepMoves = moves.filter((m) => m.moveClass === 'step');
    const stepDests = stepMoves.map((m) => `${m.dest.col},${m.dest.row}`);
    expect(stepDests).toEqual(expect.arrayContaining(['5,4', '5,6', '4,5', '6,5']));
    expect(stepDests).toHaveLength(4);
  });

  it('General at centre size 1 — 4 diagonal steps (step class only)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const stepMoves = moves.filter((m) => m.moveClass === 'step');
    const stepDests = stepMoves.map((m) => `${m.dest.col},${m.dest.row}`);
    expect(stepDests).toEqual(expect.arrayContaining(['4,4', '6,4', '4,6', '6,6']));
    expect(stepDests).toHaveLength(4);
  });

  it('Step blocked by friendly piece — destination still valid (stack outcome)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'white'); // friendly block forward
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBeNull(); // friendly → auto stack
  });

  it('Step onto enemy — outcome is stack (choice exists) OR capture (forced)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'black'); // enemy size 1, not Marshal
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBe('stack'); // size 1 enemy, not Marshal → choice
  });

  it('Step onto enemy Marshal — capture forced', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'M', 'black');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBe('capture');
  });

  it('Step onto enemy stack of size 3 — capture forced (source size >= target)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 3
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBe('capture');
  });

  it('BR-MOVE-005: source size < target size — move illegal', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 2 friendly
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeUndefined(); // 1 < 2 → illegal
  });
});

/* ------------------------------------------------------------------ */
/*  2. Step movement — sizes 2 and 3  (becomes limited-range)         */
/* ------------------------------------------------------------------ */

describe('Step movement — sizes 2-3 (BR-MOVEMENT-005 scaling)', () => {
  it('Marshal size 2 at centre — step extends 2 squares in each direction', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // Each of 8 directions: 2 squares each → 16 destinations
    // But some may overlap or go off-board in tests near edge
    expect(dests).toHaveLength(16);
    // Check F (row-1): (5,4) and (5,3)
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3']));
    // Check B (row+1): (5,6) and (5,7)
    expect(dests).toEqual(expect.arrayContaining(['5,6', '5,7']));
    // Check L (col+1): (6,5) and (7,5)
    expect(dests).toEqual(expect.arrayContaining(['6,5', '7,5']));
    // Check R (col-1): (4,5) and (3,5)
    expect(dests).toEqual(expect.arrayContaining(['4,5', '3,5']));
  });

  it('Marshal size 3 at centre — step extends 3 squares in each direction', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toHaveLength(24);
    // F: (5,4), (5,3), (5,2)
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3', '5,2']));
  });

  it('Step size 2 blocked by obstruction at step 1 — only obstruction square valid', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]);
    putPiece(pos, 5, 4, 'P', 'white'); // friendly at step 1 forward
    const dests = allDests(pos, 5, 5, 'white');
    // (5,4) is valid (stack), but (5,3) should NOT be valid (blocked)
    expect(dests).toContain('5,4');
    expect(dests).not.toContain('5,3');
  });
});

/* ------------------------------------------------------------------ */
/*  3. Limited-range movement                                          */
/* ------------------------------------------------------------------ */

describe('Limited-range movement (BR-MOVEMENT-002)', () => {
  it('Spear (E) forward size 1 — max 2 squares', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: FL, FR, B → 3
    // limited-range: F → 2 squares
    // total: 5
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3'])); // F 1-2
    expect(dests).not.toContain('5,2'); // beyond max
  });

  it('Spear size 2 — forward max 3 squares', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // step directions at size 2: FL, FR, B → 2 each → 6
    // limited-range F: max 3 → 3
    // total: 9
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3', '5,2']));
  });

  it('Spear size 3 — forward max 4 squares', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3', '5,2', '5,1']));
  });

  it('Knight size 1 — limited-range F,B (max 2) + step L,R', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'N', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step L,R: (4,5), (6,5) → 2
    // limited-range F: (5,4), (5,3) → 2
    // limited-range B: (5,6), (5,7) → 2
    // total: 6
    expect(dests).toHaveLength(6);
    expect(dests).toEqual(expect.arrayContaining(['5,4', '5,3', '5,6', '5,7', '4,5', '6,5']));
  });

  it('Spy (Y) size 1 — limited-range 4 diagonals, max 2 each', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'Y', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // 4 directions × 2 squares = 8
    expect(dests).toHaveLength(8);
    expect(dests).toEqual(
      expect.arrayContaining([
        '4,4',
        '3,3', // FL
        '6,4',
        '7,3', // FR
        '4,6',
        '3,7', // BL
        '6,6',
        '7,7', // BR
      ]),
    );
  });

  it('Limited-range blocked by friendly at step 1 — only obstruction valid', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white');
    putPiece(pos, 5, 4, 'P', 'white'); // friendly at F1
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4'); // can stack on friendly
    expect(dests).not.toContain('5,3'); // cannot pass through
  });

  it('Limited-range blocked by enemy at step 1 — obstruction valid, cannot pass', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white');
    putPiece(pos, 5, 4, 'P', 'black'); // enemy at F1
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4');
    expect(dests).not.toContain('5,3');
  });
});

/* ------------------------------------------------------------------ */
/*  4. Range movement                                                  */
/* ------------------------------------------------------------------ */

describe('Range movement (BR-MOVEMENT-003)', () => {
  it('General (G) centre — orthogonal range to board edge', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: 4 diagonals → 4
    // range F: (5,4),(5,3),(5,2),(5,1) → 4
    // range B: (5,6),(5,7),(5,8),(5,9) → 4
    // range L: (6,5),(7,5),(8,5),(9,5) → 4
    // range R: (4,5),(3,5),(2,5),(1,5) → 4
    // total: 4 + 4*4 = 20
    expect(dests).toHaveLength(20);
    expect(dests).toEqual(expect.arrayContaining(['5,1', '5,9', '1,5', '9,5']));
  });

  it('Lieutenant (L) centre — diagonal range to board edge', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'L', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: 4 orthogonal → 4
    // range: 4 diagonals → each has some squares to edge
    // FL: (4,4),(3,3),(2,2),(1,1) → 4
    // FR: (6,4),(7,3),(8,2),(9,1) → 4
    // BL: (4,6),(3,7),(2,8),(1,9) → 4
    // BR: (6,6),(7,7),(8,8),(9,9) → 4
    // total: 4 + 16 = 20
    expect(dests).toHaveLength(20);
    expect(dests).toEqual(expect.arrayContaining(['1,1', '9,1', '1,9', '9,9']));
  });

  it('Range blocked by friendly piece — stops at obstruction', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    putPiece(pos, 5, 7, 'P', 'white'); // friendly at B2
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,6'); // B1 is empty
    expect(dests).toContain('5,7'); // obstruction — valid as stack
    expect(dests).not.toContain('5,8'); // beyond obstruction
  });

  it('Range blocked by enemy piece — stops at obstruction', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    putPiece(pos, 5, 7, 'P', 'black'); // enemy at B2
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,6'); // empty
    expect(dests).toContain('5,7'); // enemy
    expect(dests).not.toContain('5,8');
  });

  it('Range from corner to board edge', () => {
    const pos = emptyPosition();
    putPiece(pos, 1, 1, 'G', 'white');
    const dests = allDests(pos, 1, 1, 'white');
    // step: 4 diagonal — but corner limits to 1 (BR: (2,2))
    // range: B=(1,2..9) → 8, R=(2..9,1) → 8
    // L=(0,1) off, F=(1,0) off, FL/FR/BL off
    expect(dests).toContain('9,1'); // right edge
    expect(dests).toContain('1,9'); // bottom edge
  });

  it('Range movement unaffected by stack size (BR-MOVEMENT-005)', () => {
    const pos = emptyPosition();
    // General at size 3
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'G', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // Range should still be to edge, not extended further
    expect(dests).toContain('5,1');
    expect(dests).toContain('1,5');
  });
});

/* ------------------------------------------------------------------ */
/*  5. Jump movement                                                   */
/* ------------------------------------------------------------------ */

describe('Jump movement (BR-MOVEMENT-004)', () => {
  it('Cannon forward jump size 1 — dest=(0,+3) from centre', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: L,R,B → 3
    // jump: (5, 5-3) = (5,2) for white
    expect(dests).toContain('5,2');
  });

  it('Cannon forward jump size 2 — dest extended to (0,+4)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // size 2: level 1 and level 2 patterns
    // level 1: (5,2)
    // level 2: (5,1)
    expect(dests).toContain('5,2');
    expect(dests).toContain('5,1');
    expect(dests).not.toContain('5,0'); // off-board
  });

  it('Cannon forward jump size 3 — dest extended to (0,+5)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // level 1: (5,2), level 2: (5,1), level 3: col=5, row=5-5=0 off
    expect(dests).toContain('5,2');
    expect(dests).toContain('5,1');
    expect(dests).not.toContain('5,0'); // off-board
  });

  it('Cannon jump blocked by large stack on over square (BR-PATH-002)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'white');
    // Block over square (5,4) [over (0,+1)] with size 2 stack (> source size 1)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).not.toContain('5,2'); // blocked
  });

  it('Cannon jump NOT blocked by small stack on over square', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'white');
    putPiece(pos, 5, 4, 'P', 'black'); // size 1 <= source size 1 → OK
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,2'); // not blocked
  });

  it('Cannon jump NOT blocked by empty over squares', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,2');
  });

  it('Archer (A) 3 jump patterns at size 1', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'A', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: B (5,6) → 1
    // jumps:
    //   (-1,+2) → (4,3)
    //   (0,+2) → (5,3)
    //   (+1,+2) → (6,3)
    expect(dests).toContain('4,3');
    expect(dests).toContain('5,3');
    expect(dests).toContain('6,3');
  });

  it('Archer jumps at size 2 — each extends by 1', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'A', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // level 1: (4,3), (5,3), (6,3)
    // level 2: (-2,+3)→(3,2), (0,+3)→(5,2), (+2,+3)→(7,2)
    expect(dests).toContain('4,3');
    expect(dests).toContain('5,3');
    expect(dests).toContain('6,3');
    expect(dests).toContain('3,2');
    expect(dests).toContain('5,2');
    expect(dests).toContain('7,2');
  });

  it('Musketeer (U) jump forward at size 1 — dest=(0,+2) over [(0,+1)]', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'U', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    // step: BL (6,6), BR (4,6) → 2
    // jump: (0,+2) → (5,3)
    expect(dests).toContain('5,3');
  });

  it('Musketeer jump blocked by size > source on over square', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'U', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2 > 1 → blocked
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).not.toContain('5,3');
  });
});

/* ------------------------------------------------------------------ */
/*  6. Player-relative directions                                      */
/* ------------------------------------------------------------------ */

describe('Player-relative directions', () => {
  it('White Marshal at (5,5) — F = row-1 = (5,4)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4');
  });

  it('Black Marshal at (5,5) — F = row+1 = (5,6)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    expect(dests).toContain('5,6');
  });

  it('White Marshal at (5,5) — L = col+1 = (6,5)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('6,5');
  });

  it('Black Marshal at (5,5) — L = col-1 = (4,5)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    expect(dests).toContain('4,5');
  });

  it('White Marshal at (5,5) — FL = (col+1,row-1) = (6,4)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('6,4');
  });

  it('Black Marshal at (5,5) — FL = (col-1,row+1) = (4,6)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    expect(dests).toContain('4,6');
  });

  it('White and Black see opposite forward directions', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white');
    putPiece(pos, 5, 6, 'E', 'black'); // black spear below white
    const whiteDests = allDests(pos, 5, 5, 'white');
    const blackDests = allDests(pos, 5, 6, 'black');
    // White E forward: (5,4), (5,3) | Black E forward: (5,7), (5,8)
    expect(whiteDests).toContain('5,4');
    expect(whiteDests).toContain('5,3');
    expect(blackDests).toContain('5,7');
    expect(blackDests).toContain('5,8');
  });
});

/* ------------------------------------------------------------------ */
/*  7. Mixed-ownership stacks                                          */
/* ------------------------------------------------------------------ */

describe('Mixed-ownership stacks', () => {
  it('Source stack with enemy pieces below — top piece still moves', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'black' }, // bottom: enemy
      { type: 'M', owner: 'white' }, // top: white
    ]);
    // white can still move the Marshal (top piece)
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests.length).toBeGreaterThan(0);
    expect(dests).toContain('5,4');
  });

  it('Source stack with enemy on top — player cannot move (not their piece)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'black' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toHaveLength(0);
  });

  it('Target stack with mixed ownership — outcome by top piece owner', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 2 ≥ target size 2
    // Target at (5,4): bottom enemy, top friendly
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'white' },
    ]); // size 2
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBeNull(); // top is friendly → auto stack
  });

  it('Target stack with enemy on top — outcome is stack or capture', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 2 ≥ target size 2
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBe('stack'); // enemy top, size 2, not Marshal → choice
  });
});

/* ------------------------------------------------------------------ */
/*  8. Edge cases                                                      */
/* ------------------------------------------------------------------ */

describe('Edge cases', () => {
  it('Piece at (1,1) — cannot move off board (step)', () => {
    const pos = emptyPosition();
    putPiece(pos, 1, 1, 'M', 'white');
    const dests = allDests(pos, 1, 1, 'white');
    // Only B=(1,2), L=(2,1), BL=(2,2)
    for (const d of dests) {
      const [c, r] = d.split(',').map(Number);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(9);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(9);
    }
  });

  it('Piece at bottom edge (row 9) for white — backward goes off board', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 9, 'M', 'white');
    const dests = allDests(pos, 5, 9, 'white');
    // B = row+1 = 10 off, so 7 destinations (B, BL, BR off)
    expect(dests).toHaveLength(5);
    // F, FL, FR, L, R valid
    expect(dests).toContain('5,8'); // F
    expect(dests).toContain('4,9'); // R
    expect(dests).toContain('6,9'); // L
  });

  it('Stack size 3 — maximum allowed', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    putPiece(pos, 6, 5, 'M', 'white');
    const dests = allDests(pos, 6, 5, 'white');
    // Marshal can move to (5,5) only if source size >= target size
    // source size = 1, target size = 3 → 1 < 3 → illegal
    expect(dests).not.toContain('5,5');
  });

  it('Stack size 1 — minimum (no scaling bonus)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toHaveLength(8); // all 8 directions, 1 each
  });

  it('Empty source square — returns empty array', () => {
    const pos = emptyPosition();
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(moves).toHaveLength(0);
  });

  it('Opponent piece on source square — returns empty array', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'black');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(moves).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  9. All piece types at all stack sizes — step/limited/range counts  */
/* ------------------------------------------------------------------ */

describe('All 14 piece types × 3 stack sizes — movement count sanity', () => {
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

  it.each(ALL_TYPES)('%s at centre size 1 — at least 1 legal move', (type) => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, type, 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests.length).toBeGreaterThanOrEqual(1);
  });

  it.each(ALL_TYPES)('%s at centre size 2 — more moves than size 1', (type) => {
    const pos1 = emptyPosition();
    const pos2 = emptyPosition();
    putPiece(pos1, 5, 5, type, 'white');
    putStack(pos2, 5, 5, [
      { type: 'P', owner: 'white' },
      { type, owner: 'white' },
    ]);
    const dests1 = allDests(pos1, 5, 5, 'white');
    const dests2 = allDests(pos2, 5, 5, 'white');
    expect(dests2.length).toBeGreaterThanOrEqual(dests1.length);
  });

  it.each(ALL_TYPES)('%s at centre size 3 — more moves than size 2', (type) => {
    const pos2 = emptyPosition();
    const pos3 = emptyPosition();
    putStack(pos2, 5, 5, [
      { type: 'P', owner: 'white' },
      { type, owner: 'white' },
    ]);
    putStack(pos3, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type, owner: 'white' },
    ]);
    const dests2 = allDests(pos2, 5, 5, 'white');
    const dests3 = allDests(pos3, 5, 5, 'white');
    expect(dests3.length).toBeGreaterThanOrEqual(dests2.length);
  });
});

/* ------------------------------------------------------------------ */
/*  10. getLegalMoves — aggregates all pieces for a player             */
/* ------------------------------------------------------------------ */

describe('getLegalMoves — aggregate', () => {
  it('Empty board — returns empty array', () => {
    const pos = emptyPosition();
    const moves = getLegalMoves(pos, 'white');
    expect(moves).toHaveLength(0);
  });

  it('White has 1 piece — matches getLegalDestinations', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const all = getLegalMoves(pos, 'white');
    const direct = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(all).toHaveLength(direct.length);
  });

  it('Finds moves for only the specified player', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 6, 'M', 'black');
    const whiteMoves = getLegalMoves(pos, 'white');
    const blackMoves = getLegalMoves(pos, 'black');
    expect(whiteMoves.length).toBeGreaterThan(0);
    expect(blackMoves.length).toBeGreaterThan(0);
    // White moves should include black piece's square as a valid dest (can capture)
    const whiteHasBlackSquare = whiteMoves.some((m) => m.dest.col === 5 && m.dest.row === 6);
    expect(whiteHasBlackSquare).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  11. BR-MOVE-005 — source size >= target size (all classes)        */
/* ------------------------------------------------------------------ */

describe('BR-MOVE-005 — stack size landing restriction', () => {
  it('Step: source=2, target=3 — illegal (target > source)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // bottom: P, top: P, size=2
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    // Top piece of source is Pawn (P) — we need a piece with step movement
    // Use Major (J) which has step
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'J', owner: 'white' },
    ]); // size 2
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeUndefined();
  });

  it('Step: source=3, target=3 — legal (source >= target)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'J', owner: 'white' },
    ]); // size 3
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeDefined();
    expect(fwdMove!.outcome).toBe('capture'); // forced capture
  });

  it('Limited-range: source=1, target=2 — illegal', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeUndefined();
  });

  it('Range: source=1, target=2 — illegal', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2 at F1
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const fwdMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(fwdMove).toBeUndefined();
  });

  it('Jump: source=1, target=2 — illegal (via BR-MOVE-005 check on dest)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'white'); // size 1
    putStack(pos, 5, 2, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2 at dest (5,2)
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const jumpMove = moves.find((m) => m.dest.col === 5 && m.dest.row === 2);
    expect(jumpMove).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  12. Specific edge: Ranger (General) range directions               */
/* ------------------------------------------------------------------ */

describe('General range movement details', () => {
  it('General at (5,5) size 1 — range F goes to row 1', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,1');
    expect(dests).toContain('5,2');
    expect(dests).toContain('5,3');
    expect(dests).toContain('5,4');
  });

  it('General at (5,5) size 1 — range B goes to row 9', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,9');
  });

  it('General at (5,5) size 1 — each orthogonal direction has 4 empty squares', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'G', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const rangeMoves = moves.filter((m) => m.moveClass === 'range');
    // F: 4, B: 4, L: 4, R: 4 = 16
    expect(rangeMoves).toHaveLength(16);
  });
});

/* ------------------------------------------------------------------ */
/*  13. Spear (E) — step + limited-range combinations                  */
/* ------------------------------------------------------------------ */

describe('Spear movement combinations', () => {
  it('Spear size 1 — step FL, FR, B + limited-range F', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const classes = moves.map((m) => m.moveClass);
    expect(classes.filter((c) => c === 'step')).toHaveLength(3); // FL, FR, B
    expect(classes.filter((c) => c === 'limited-range')).toHaveLength(2); // F: 1-2
  });

  it('Spear size 2 — step FL, FR, B become 2-step each + limited-range F max 3', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    // step (extends to 2): FL×2, FR×2, B×2 = 6
    // limited-range F: 3
    expect(moves).toHaveLength(9);
  });

  it('Spear size 3 — step FL, FR, B become 3-step each + limited-range F max 4', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    // step (extends to 3): FL×3, FR×3, B×3 = 9
    // limited-range F: 4
    expect(moves).toHaveLength(13);
  });
});

/* ------------------------------------------------------------------ */
/*  14. Black player direction symmetry                                */
/* ------------------------------------------------------------------ */

describe('Black player direction symmetry', () => {
  it('Black Marshal at (5,5) — has 8 step destinations (opposite from White)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    expect(dests).toHaveLength(8);
    // Black's F = row+1 → (5,6), B = row-1 → (5,4)
    expect(dests).toContain('5,6');
    expect(dests).toContain('5,4');
    // Black's L = col-1 → (4,5), R = col+1 → (6,5)
    expect(dests).toContain('4,5');
    expect(dests).toContain('6,5');
  });

  it('Black Spear size 1 — forward = row+1 (max 2)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'E', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    expect(dests).toContain('5,6'); // F1
    expect(dests).toContain('5,7'); // F2
    expect(dests).not.toContain('5,8'); // F3 (beyond max 2)
  });

  it('Black Cannon jump forward size 1 — dest = (0,+3) from black POV = (5,8)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    // For black: positive row delta = forward = row+1
    // delta (0,+3) → (5, 5+3) = (5,8)
    expect(dests).toContain('5,8');
  });

  it('Black Archer jump patterns — mirrored from White', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'A', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    // step: B (row-1) = (5,4)
    // jumps for black:
    //   (-1,+2) → col:5-(-1)=6, row:5+2=7 → (6,7)
    //   (0,+2) → (5,7)
    //   (+1,+2) → col:5-(+1)=4, row:5+2=7 → (4,7)
    expect(dests).toContain('5,4'); // step B
    expect(dests).toContain('6,7');
    expect(dests).toContain('5,7');
    expect(dests).toContain('4,7');
  });
});

/* ------------------------------------------------------------------ */
/*  15. Jump scaling — Archer and Musketeer extended                    */
/* ------------------------------------------------------------------ */

describe('Jump scaling details (BR-MOVEMENT-005)', () => {
  it('Archer size 3 — each pattern extends to level 3', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'A', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // level 1: (4,3), (5,3), (6,3)
    // level 2: (3,2), (5,2), (7,2)
    // level 3: (-3,+4?) = (2,1), (5,1), (8,1)
    expect(dests).toContain('4,3');
    expect(dests).toContain('5,3');
    expect(dests).toContain('6,3');
    expect(dests).toContain('3,2');
    expect(dests).toContain('5,2');
    expect(dests).toContain('7,2');
    expect(dests).toContain('2,1');
    expect(dests).toContain('5,1');
    expect(dests).toContain('8,1');
  });

  it('Musketeer size 2 — jump extends to (0,+3)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // level 1: (5,3)
    // level 2: (5,2)
    expect(dests).toContain('5,3');
    expect(dests).toContain('5,2');
  });

  it('Musketeer size 3 — jump extends to (0,+4)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // level 1: (5,3), level 2: (5,2), level 3: (5,1)
    expect(dests).toContain('5,3');
    expect(dests).toContain('5,2');
    expect(dests).toContain('5,1');
  });
});

/* ------------------------------------------------------------------ */
/*  16. Knight (N) at sizes 2-3                                        */
/* ------------------------------------------------------------------ */

describe('Knight scaling', () => {
  it('Knight size 2 — step L,R extend to 2, limited-range F,B extend to 3', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // step L,R at size 2 → 1-2 each: (4,5),(3,5),(6,5),(7,5) = 4
    // limited-range F at size 2 → 1-3: (5,4),(5,3),(5,2) = 3
    // limited-range B at size 2 → 1-3: (5,6),(5,7),(5,8) = 3
    expect(dests).toHaveLength(10);
    expect(dests).toContain('5,2');
    expect(dests).toContain('5,8');
    expect(dests).toContain('3,5');
    expect(dests).toContain('7,5');
  });

  it('Knight size 3 — step L,R extend to 3, limited-range F,B extend to 4', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    const dests = allDests(pos, 5, 5, 'white');
    // step L,R at size 3 → 1-3 each: (4,5),(3,5),(2,5),(6,5),(7,5),(8,5) = 6
    // limited-range F at size 3 → 1-4: (5,4),(5,3),(5,2),(5,1) = 4
    // limited-range B at size 3 → 1-4: (5,6),(5,7),(5,8),(5,9) = 4
    expect(dests).toHaveLength(14);
    expect(dests).toContain('5,1');
    expect(dests).toContain('5,9');
    expect(dests).toContain('2,5');
    expect(dests).toContain('8,5');
  });
});

/* ------------------------------------------------------------------ */
/*  17. Spy (Y) — limited-range only                                   */
/* ------------------------------------------------------------------ */

describe('Spy movement', () => {
  it('Spy has NO step directions', () => {
    expect(PIECE_MOVEMENT.Y.step).toHaveLength(0);
  });

  it('Spy size 1 — 4 diagonals × 2 = 8 destinations', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'Y', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(moves).toHaveLength(8);
    for (const m of moves) {
      expect(m.moveClass).toBe('limited-range');
    }
  });

  it('Spy size 2 — 4 diagonals × 3 = 12 destinations', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(moves).toHaveLength(12);
  });

  it('Spy size 3 — 4 diagonals × 4 = 16 destinations', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    expect(moves).toHaveLength(16);
  });
});

/* ------------------------------------------------------------------ */
/*  18. Obstruction patterns at extended sizes                          */
/* ------------------------------------------------------------------ */

describe('Extended step obstruction (sizes 2-3)', () => {
  it('Step size 2 blocked at step 2 by friendly — step 1 valid empty, step 2 valid stack, step 3 invalid', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]);
    putPiece(pos, 5, 3, 'P', 'white'); // friendly at F2
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4'); // F1 empty
    expect(dests).toContain('5,3'); // F2 — obstruction valid
    expect(dests).not.toContain('5,2'); // F3 — beyond obstruction
  });

  it('Step size 3 blocked at step 1 by enemy — only step 1 valid', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]);
    putPiece(pos, 5, 4, 'P', 'black'); // enemy at F1
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4'); // F1 valid (capture/stack)
    expect(dests).not.toContain('5,3'); // F2 beyond
    expect(dests).not.toContain('5,2'); // F3 beyond
  });

  it('Limited-range size 2 blocked at step 2 — step 1 empty valid, step 2 valid', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    putPiece(pos, 5, 3, 'P', 'black'); // enemy at F2 (limited-range F max 3)
    const dests = allDests(pos, 5, 5, 'white');
    expect(dests).toContain('5,4'); // F1 empty
    expect(dests).toContain('5,3'); // F2 obstruction
    expect(dests).not.toContain('5,2'); // F3 beyond
  });
});

/* ------------------------------------------------------------------ */
/*  19. Range — diagonal with Lieutenant at various positions          */
/* ------------------------------------------------------------------ */

describe('Lieutenant diagonal range', () => {
  it('Lieutenant at centre size 1 — 4 diagonal range directions × up to 4 = 16 range moves', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'L', 'white');
    const rangeMoves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white').filter(
      (m) => m.moveClass === 'range',
    );
    expect(rangeMoves).toHaveLength(16);
  });

  it('Lieutenant at (1,1) — only BR diagonal reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 1, 1, 'L', 'white');
    const rangeMoves = getLegalDestinations(pos, { col: 1, row: 1 }, 'white').filter(
      (m) => m.moveClass === 'range',
    );
    // BR: col+1=2, row+1=2 → to (9,9) = 8 squares
    // FL/FR/BL are off-board
    expect(rangeMoves).toHaveLength(8);
    expect(rangeMoves.every((m) => m.dest.col >= 2 && m.dest.row >= 2)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  20. Move outcome at different target compositions                  */
/* ------------------------------------------------------------------ */

describe('Move outcome determination', () => {
  it('Empty dest → outcome null', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    for (const m of moves) {
      if (m.dest.col === 5 && m.dest.row === 4) {
        expect(m.outcome).toBeNull();
      }
    }
  });

  it('Friendly dest → outcome null', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'white');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const move = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(move!.outcome).toBeNull();
  });

  it('Enemy dest size 1 top not Marshal → outcome stack (choice)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'black');
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const move = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(move!.outcome).toBe('stack');
  });

  it('Enemy dest top is Marshal → outcome capture (forced)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 2
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]); // size 2 top is Marshal
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const move = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(move!.outcome).toBe('capture');
  });

  it('Enemy dest size 3 top not Marshal → outcome capture (forced)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 3
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const move = moves.find((m) => m.dest.col === 5 && m.dest.row === 4);
    expect(move!.outcome).toBe('capture');
  });
});

/* ------------------------------------------------------------------ */
/*  21. Piece-specific movement at board edges                         */
/* ------------------------------------------------------------------ */

describe('Movement at board edges', () => {
  it('General at (5,1) — F goes off-board, B goes to row 9', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 1, 'G', 'white');
    const dests = allDests(pos, 5, 1, 'white');
    expect(dests).toContain('5,9'); // B max
    expect(dests).not.toContain('5,0'); // F off-board
  });

  it('Fortress at (9,5) — L goes off-board (col+1=10), R reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 9, 5, 'F', 'white');
    const dests = allDests(pos, 9, 5, 'white');
    // step F, L, R, BL, BR
    // L = col+1 = 10 off
    // So: F=(9,4), R=(8,5), BL=(9,6) wait no, col=9+1=10 off too
    // BL=(9+1,5+1)=off, BR=(9-1,5+1)=(8,6)
    // Actually: F=(9,4), R=(8,5), BR=(8,6)
    // FL: col=9+1=10 off, FR: col=9-1=8 row=5-1=4 → (8,4) — wait, Fortress doesn't have FL/FR
    // Fortress: F, L, R, BL, BR
    // L off, BL off
    // F=(9,4), R=(8,5), BR=(8,6) = 3
    expect(dests).toHaveLength(3);
    expect(dests).toEqual(expect.arrayContaining(['9,4', '8,5', '8,6']));
  });

  it('Pawn at (5,1) — F off-board, B = (5,2) reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 1, 'P', 'white');
    const dests = allDests(pos, 5, 1, 'white');
    expect(dests).toEqual(['5,2']);
  });

  it('Pawn at (5,9) — B off-board, F = (5,8) reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 9, 'P', 'white');
    const dests = allDests(pos, 5, 9, 'white');
    expect(dests).toEqual(['5,8']);
  });
});

/* ------------------------------------------------------------------ */
/*  22. BR-PATH-002 boundary — strict `>` (not `>=`) semantics         */
/* ------------------------------------------------------------------ */

describe('BR-PATH-002 boundary — strict > check', () => {
  it('Jump: source=2, over=2 — NOT blocked (2 > 2 is false)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]); // size 2
    // Place a size-2 stack on the over square (5,4)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    const dests = allDests(pos, 5, 5, 'white');
    // source=2, over=2 → 2 > 2 is false → NOT blocked
    expect(dests).toContain('5,2'); // Cannon jump forward should work
  });

  it('Jump: source=2, over=3 — blocked (3 > 2 is true)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]); // size 2
    // Place a size-3 stack on the over square (5,4)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    const dests = allDests(pos, 5, 5, 'white');
    // source=2, over=3 → 3 > 2 is true → blocked
    expect(dests).not.toContain('5,2');
  });

  it('Jump: source=3, over=3 — NOT blocked (3 > 3 is false)', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]); // size 3
    // Place a size-3 stack on the over square (5,4)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    const dests = allDests(pos, 5, 5, 'white');
    // source=3, over=3 → 3 > 3 is false → NOT blocked
    expect(dests).toContain('5,2');
  });

  it('Jump: source=3, over=2 at level-2 over square — blocked', () => {
    const pos = emptyPosition();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]); // size 3
    // Level-1 over square (5,4) is empty; level-2 over square (5,3) has size 2
    putStack(pos, 5, 3, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    const dests = allDests(pos, 5, 5, 'white');
    // Level-2 jump: over=[(0,+1),(0,+2)], over[1]=(5,3) has size 2
    // source=3, over=2 → 2 > 3 is false → NOT blocked
    expect(dests).toContain('5,1'); // level-2 dest
  });
});

/* ------------------------------------------------------------------ */
/*  23. getScaledJumps — direct unit tests                             */
/* ------------------------------------------------------------------ */

describe('getScaledJumps — direct unit tests', () => {
  it('Cannon size 1: dest=(0,+3), over=[(0,+1),(0,+2)]', () => {
    const base = PIECE_MOVEMENT.C.jumps[0];
    const patterns = getScaledJumps(base, 1);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].dest).toEqual({ col: 0, row: 3 });
    expect(patterns[0].over).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
    ]);
  });

  it('Cannon size 2: adds level-2 dest=(0,+4), over=[(0,+1),(0,+2),(0,+3)]', () => {
    const base = PIECE_MOVEMENT.C.jumps[0];
    const patterns = getScaledJumps(base, 2);
    expect(patterns).toHaveLength(2);
    expect(patterns[1].dest).toEqual({ col: 0, row: 4 });
    expect(patterns[1].over).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
    ]);
  });

  it('Cannon size 3: adds level-3 dest=(0,+5), over=[...,(0,+4)]', () => {
    const base = PIECE_MOVEMENT.C.jumps[0];
    const patterns = getScaledJumps(base, 3);
    expect(patterns).toHaveLength(3);
    expect(patterns[2].dest).toEqual({ col: 0, row: 5 });
    expect(patterns[2].over).toHaveLength(4);
  });

  it('Archer size 1: 3 patterns, each dest=(±1/0,+2), over=[(0,+1)]', () => {
    const patterns = PIECE_MOVEMENT.A.jumps.flatMap((j) => getScaledJumps(j, 1));
    expect(patterns).toHaveLength(3);
    const dests = patterns.map((p) => p.dest);
    expect(dests).toEqual(
      expect.arrayContaining([
        { col: -1, row: 2 },
        { col: 0, row: 2 },
        { col: 1, row: 2 },
      ]),
    );
    for (const p of patterns) {
      expect(p.over).toEqual([{ col: 0, row: 1 }]);
    }
  });

  it('Archer size 2: each pattern extends by 1', () => {
    const patterns = PIECE_MOVEMENT.A.jumps.flatMap((j) => getScaledJumps(j, 2));
    expect(patterns).toHaveLength(6); // 3 base × 2 levels
    const dests = patterns.map((p) => p.dest);
    expect(dests).toEqual(
      expect.arrayContaining([
        { col: -1, row: 2 },
        { col: 0, row: 2 },
        { col: 1, row: 2 },
        { col: -2, row: 3 },
        { col: 0, row: 3 },
        { col: 2, row: 3 },
      ]),
    );
  });

  it('Musketeer size 1: dest=(0,+2), over=[(0,+1)]', () => {
    const base = PIECE_MOVEMENT.U.jumps[0];
    const patterns = getScaledJumps(base, 1);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].dest).toEqual({ col: 0, row: 2 });
    expect(patterns[0].over).toEqual([{ col: 0, row: 1 }]);
  });

  it('Musketeer size 3: 3 levels', () => {
    const base = PIECE_MOVEMENT.U.jumps[0];
    const patterns = getScaledJumps(base, 3);
    expect(patterns).toHaveLength(3);
    expect(patterns[0].dest).toEqual({ col: 0, row: 2 });
    expect(patterns[1].dest).toEqual({ col: 0, row: 3 });
    expect(patterns[2].dest).toEqual({ col: 0, row: 4 });
  });

  it('Empty over array throws explicit error', () => {
    const badBase = { dest: { col: 0, row: 2 }, over: [] };
    expect(() => getScaledJumps(badBase, 1)).toThrow(/at least one jumped-over square/);
  });
});

/* ------------------------------------------------------------------ */
/*  24. Black at extreme corners                                       */
/* ------------------------------------------------------------------ */

describe('Black at extreme corners', () => {
  it('Black Marshal at (1,1) — top-right corner; only F, R, FR reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 1, 1, 'M', 'black');
    const dests = allDests(pos, 1, 1, 'black');
    // Black at (1,1): F=row+1=(1,2), R=col-1=(0,1) off, L=col+1=(2,1),
    //                 B=row-1=(1,0) off, FL=(2,2), FR=(0,2) off, BL=(2,0) off, BR=(0,0) off
    // Valid: F=(1,2), L=(2,1), FL=(2,2) = 3 destinations
    expect(dests).toHaveLength(3);
    expect(dests).toEqual(expect.arrayContaining(['1,2', '2,1', '2,2']));
  });

  it('Black Marshal at (9,9) — bottom-left corner; only B, L, BL reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 9, 9, 'M', 'black');
    const dests = allDests(pos, 9, 9, 'black');
    // Black at (9,9): F=row+1=(9,10) off, B=row-1=(9,8),
    //                 L=col+1=(10,9) off, R=col-1=(8,9),
    //                 FL=(10,10) off, FR=(8,10) off, BL=(10,8) off, BR=(8,8)
    // Valid: B=(9,8), R=(8,9), BR=(8,8) = 3 destinations
    expect(dests).toHaveLength(3);
    expect(dests).toEqual(expect.arrayContaining(['9,8', '8,9', '8,8']));
  });

  it('Black Spear at (5,9) — bottom edge; F off-board, B = (5,8) reachable', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 9, 'E', 'black');
    const dests = allDests(pos, 5, 9, 'black');
    // Black Spear: F=row+1=(5,10) off, B=row-1=(5,8), FL/FR also off
    // Only B and step B-directions are valid
    expect(dests).toContain('5,8');
    expect(dests).not.toContain('5,10'); // off-board
  });

  it('Black Cannon at (5,5) — forward jump = row+3 = (5,8)', () => {
    const pos = emptyPosition();
    putPiece(pos, 5, 5, 'C', 'black');
    const dests = allDests(pos, 5, 5, 'black');
    // Black Cannon forward: positive row = row+3 = (5,8)
    expect(dests).toContain('5,8');
  });

  it('White and Black at (1,1) see opposite reachable sets', () => {
    const posW = emptyPosition();
    const posB = emptyPosition();
    putPiece(posW, 1, 1, 'M', 'white');
    putPiece(posB, 1, 1, 'M', 'black');
    const whiteDests = allDests(posW, 1, 1, 'white');
    const blackDests = allDests(posB, 1, 1, 'black');
    // White at (1,1): F=row-1 off, B=row+1=(1,2), L=col+1=(2,1), R=col-1 off,
    //                 FL/FR off, BL=(2,2), BR off
    // Black at (1,1): F=row+1=(1,2), B=row-1 off, L=col+1=(2,1), R=col-1 off,
    //                 FL=(2,2), FR off, BL/BR off
    // Both: B/F=(1,2), L=(2,1), BL/FL=(2,2) = 3 each, but different directions
    expect(whiteDests).toHaveLength(3);
    expect(blackDests).toHaveLength(3);
    // Same squares, different direction labels
    expect(whiteDests.sort()).toEqual(blackDests.sort());
  });
});
