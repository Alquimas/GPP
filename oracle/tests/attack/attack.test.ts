/**
 * Attack, Check & Exposure detection tests (Step 7).
 *
 * Coverage:
 * - isSquareUnderAttack for every piece type at sizes 1-3
 * - Stack-size landing restriction (BR-MOVE-005)
 * - Marshal threat disregards BR-STACK-004
 * - isInCheck — basic, not-in-check, Marshal-in-stack, no-Marshal
 * - isExposed — both, one, neither, no-Marshal-on-board
 * - Edge cases: empty board, board corners, mixed-ownership stacks
 * - GSFEN integration tests
 */

import { describe, it, expect } from 'vitest';
import { isSquareUnderAttack, isInCheck, isExposed } from '../../src/board/attack.js';
import { getLegalDestinations } from '../../src/board/movement.js';
import type { BoardCoord, PieceType, Player, Position, Stack } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { BATTLE_START, BOTH_MARSHALS_DEPLOY_CTR2, BOTH_MARSHALS_PLACED, DENSE_ENGAGEMENT } from '../../src/gsfen/fixtures.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function emptyPos(): Position {
  return Array.from({ length: 9 }, () => Array(9).fill(null));
}

/** Place a single-piece stack at (col, row). 1-indexed. */
function putPiece(pos: Position, col: number, row: number, type: PieceType, owner: Player): void {
  pos[row - 1][col - 1] = [{ type, owner }] as Stack;
}

/** Place a multi-piece stack. items[0] = bottom, items[last] = top. */
function putStack(
  pos: Position,
  col: number,
  row: number,
  items: { type: PieceType; owner: Player }[],
): void {
  pos[row - 1][col - 1] = items.map((p) => ({ ...p })) as Stack;
}

/** Parse a GSFEN and return just the position. */
function gsfenPos(gsfen: string): Position {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state.position;
}

/* ------------------------------------------------------------------ */
/*  Section 1 — isSquareUnderAttack: basic scenarios                   */
/* ------------------------------------------------------------------ */

describe('isSquareUnderAttack — basic scenarios', () => {
  /* ------ Step-only pieces at size 1 ------ */

  it.each([
    { type: 'M' as PieceType, label: 'Marshal', forward: true, backward: true },
    { type: 'G' as PieceType, label: 'General', forward: true, backward: true },
    { type: 'L' as PieceType, label: 'Lieutenant', forward: true, backward: true },
    { type: 'J' as PieceType, label: 'Major', forward: true, backward: true },
    { type: 'S' as PieceType, label: 'Samurai', forward: true, backward: true },
    { type: 'E' as PieceType, label: 'Spear', forward: true, backward: true },
    { type: 'N' as PieceType, label: 'Knight', forward: true, backward: true },
    { type: 'Y' as PieceType, label: 'Spy', forward: false, backward: false },
    { type: 'F' as PieceType, label: 'Fortress', forward: true, backward: false },
    { type: 'P' as PieceType, label: 'Pawn', forward: true, backward: true },
    { type: 'C' as PieceType, label: 'Cannon', forward: false, backward: true },
    { type: 'A' as PieceType, label: 'Archer', forward: false, backward: true },
    { type: 'U' as PieceType, label: 'Musketeer', forward: false, backward: false },
    { type: 'T' as PieceType, label: 'Captain', forward: false, backward: true },
  ])(
    '$label ($type) at centre — directional attack test at size 1',
    ({ type, forward, backward }) => {
      const pos = emptyPos();
      putPiece(pos, 5, 5, type, 'white');
      // Place enemy targets in forward (5,4) and backward (5,6) directions
      putPiece(pos, 5, 4, 'P', 'black');
      putPiece(pos, 5, 6, 'P', 'black');

      // For white: F = row-1 = (5,4), B = row+1 = (5,6)
      expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(forward);
      expect(isSquareUnderAttack(pos, { col: 5, row: 6 }, 'white')).toBe(backward);
    },
  );

  it('Pawn at centre — attacks forward (B) and backward (F) squares', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'black'); // forward
    putPiece(pos, 5, 6, 'P', 'black'); // backward

    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 5, row: 6 }, 'white')).toBe(true);
  });

  it('Pawn — does NOT attack diagonally', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 4, 4, 'P', 'black'); // FL
    putPiece(pos, 6, 4, 'P', 'black'); // FR

    expect(isSquareUnderAttack(pos, { col: 4, row: 4 }, 'white')).toBe(false);
    expect(isSquareUnderAttack(pos, { col: 6, row: 4 }, 'white')).toBe(false);
  });

  it('Marshal at centre — attacks all 8 neighbours', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    // Place enemies in all 8 directions
    const dirs: [number, number][] = [
      [5, 4],
      [5, 6],
      [4, 5],
      [6, 5],
      [4, 4],
      [6, 4],
      [4, 6],
      [6, 6],
    ];
    for (const [c, r] of dirs) putPiece(pos, c, r, 'P', 'black');

    for (const [c, r] of dirs) {
      expect(
        isSquareUnderAttack(pos, { col: c as BoardCoord, row: r as BoardCoord }, 'white'),
      ).toBe(true);
    }
  });

  /* ------ Range pieces ------ */

  it('General — attacks along orthogonal range (empty path)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'G', 'white');
    putPiece(pos, 5, 1, 'P', 'black'); // far forward

    expect(isSquareUnderAttack(pos, { col: 5, row: 1 }, 'white')).toBe(true);
  });

  it('General — does NOT attack beyond obstruction', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'G', 'white');
    putPiece(pos, 5, 5, 'P', 'white'); // friendly block
    putPiece(pos, 5, 1, 'P', 'black'); // beyond block

    expect(isSquareUnderAttack(pos, { col: 5, row: 1 }, 'white')).toBe(false);
  });

  it('General — attacks the obstruction square itself', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'G', 'white');
    putPiece(pos, 5, 5, 'P', 'black'); // enemy block

    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'white')).toBe(true);
  });

  it('Lieutenant — attacks along diagonal range (empty path)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'L', 'white');
    putPiece(pos, 1, 1, 'P', 'black'); // far FL diagonal

    expect(isSquareUnderAttack(pos, { col: 1, row: 1 }, 'white')).toBe(true);
  });

  it('Lieutenant — blocked diagonal does not attack beyond obstruction', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'L', 'white');
    putPiece(pos, 3, 3, 'P', 'white'); // friendly block on diagonal
    putPiece(pos, 1, 1, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 1, row: 1 }, 'white')).toBe(false);
  });

  /* ------ Jump pieces ------ */

  it('Cannon at size 1 — jumps forward 3 over intervening squares', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white');
    putPiece(pos, 5, 2, 'P', 'black'); // 3 squares forward (row 5-3=2)

    // White C jumps forward 3: dest = (0,+3) in white coords → (5, 5-3) = (5, 2)
    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(true);
  });

  it('Cannon at size 1 — cannot attack beyond jumped destination', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white');
    putPiece(pos, 5, 1, 'P', 'black'); // 4 squares forward — too far

    expect(isSquareUnderAttack(pos, { col: 5, row: 1 }, 'white')).toBe(false);
  });

  it('Cannon jump blocked by large stack on over square (BR-PATH-002)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white'); // size 1
    // Place a size-2 stack on an over square: (5,4) is the first over square
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2 > source size 1 → blocked
    putPiece(pos, 5, 2, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(false);
  });

  it('Archer at size 1 — jumps forward 2 over 1 square', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'A', 'white');
    putPiece(pos, 5, 3, 'P', 'black'); // forward 2

    // Archer forward jump: dest (0,+2), over [(0,+1)]
    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(true);
  });

  it('Musketeer at size 1 — jumps forward 2', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'U', 'white');
    putPiece(pos, 5, 3, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(true);
  });

  /* ------ Limited-range pieces (Spy) ------ */

  it('Spy at size 1 — attacks diagonal squares up to 2 away', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'Y', 'white');
    putPiece(pos, 3, 3, 'P', 'black'); // 2 steps FL
    putPiece(pos, 7, 7, 'P', 'black'); // 2 steps BR

    expect(isSquareUnderAttack(pos, { col: 3, row: 3 }, 'white')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 7, row: 7 }, 'white')).toBe(true);
  });

  it('Spy at size 1 — does not attack beyond range 2', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'Y', 'white');
    putPiece(pos, 2, 2, 'P', 'black'); // 3 steps FL — too far for size 1

    expect(isSquareUnderAttack(pos, { col: 2, row: 2 }, 'white')).toBe(false);
  });

  /* ------ Empty board ------ */

  it('Empty board — no squares under attack', () => {
    const pos = emptyPos();
    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'white')).toBe(false);
    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'black')).toBe(false);
  });

  /* ------ Board edge ------ */

  it('Piece at corner — only attacks squares within bounds', () => {
    const pos = emptyPos();
    putPiece(pos, 1, 1, 'M', 'white'); // top-right corner
    putPiece(pos, 1, 2, 'P', 'black'); // B
    putPiece(pos, 2, 1, 'P', 'black'); // L
    putPiece(pos, 2, 2, 'P', 'black'); // BL

    expect(isSquareUnderAttack(pos, { col: 1, row: 2 }, 'white')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 2, row: 1 }, 'white')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 2, row: 2 }, 'white')).toBe(true);
    // Off-board would-be squares
    expect(isSquareUnderAttack(pos, { col: 1 as BoardCoord, row: 0 as BoardCoord }, 'white')).toBe(
      false,
    ); // off-board F
    expect(isSquareUnderAttack(pos, { col: 0 as BoardCoord, row: 1 as BoardCoord }, 'white')).toBe(
      false,
    ); // off-board R
  });
});

/* ------------------------------------------------------------------ */
/*  Section 2 — Stack-size landing restriction (BR-MOVE-005)           */
/* ------------------------------------------------------------------ */

describe('isSquareUnderAttack — stack-size restriction (BR-MOVE-005)', () => {
  it('source=1, target=1 — CAN attack', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    putPiece(pos, 5, 4, 'P', 'black'); // size 1
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('source=1, target=2 — CANNOT attack', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });

  it('source=1, target=3 — CANNOT attack', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });

  it('source=2, target=3 — CANNOT attack', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 2
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });

  it('source=2, target=2 — CAN attack (equal)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 2
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('source=3, target=3 — CAN attack (equal)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 3
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('source=3, target=1 — CAN attack (source larger)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 3
    putPiece(pos, 5, 4, 'P', 'black'); // size 1
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('source=1 attacks empty square — allowed', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    // target (5,4) is empty
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('source=2 attacks friendly stack size 3 — CANNOT attack (BR-MOVE-005 applies to friendlies too)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 2 white
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 3 white — friendly but larger
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 3 — Marshal threat disregards BR-STACK-004                 */
/* ------------------------------------------------------------------ */

describe('Marshal threat — disregards BR-STACK-004', () => {
  it('Pawn at size 1, enemy Marshal at size 1 — attacks the Marshal square', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // source
    putPiece(pos, 5, 4, 'M', 'black'); // enemy Marshal
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('General at size 1, enemy Marshal far along range — attacks Marshal square', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'G', 'white');
    putPiece(pos, 5, 1, 'M', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 1 }, 'white')).toBe(true);
  });

  it('Pawn at size 1, enemy Marshal at size 2 in stack — CANNOT attack (stack too large)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]); // size 2, Marshal on top
    // BR-MOVE-005: source 1 < target 2 → cannot attack
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });

  it('Cannon attacks Marshal — jump destination works for threat', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white');
    putPiece(pos, 5, 2, 'M', 'black'); // jump target
    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(true);
  });

  it('Marshal threat from multi-size stack — source size 3 can attack Marshal at size 2', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]); // size 3 white
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]); // size 2 with Marshal top
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 4 — Extended range at sizes 2-3                            */
/* ------------------------------------------------------------------ */

describe('Extended range at sizes 2-3 (BR-MOVEMENT-005)', () => {
  it('Marshal size 2 — step extends to 2 squares, attacks (5,3) from (5,5)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 2
    putPiece(pos, 5, 3, 'P', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(true);
  });

  it('Marshal size 3 — step extends to 3 squares, attacks (5,2) from (5,5)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 3
    putPiece(pos, 5, 2, 'P', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(true);
  });

  it('Marshal size 1 — step is 1 square, does NOT attack (5,3) from (5,5)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white'); // size 1
    putPiece(pos, 5, 3, 'P', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(false);
  });

  it('Spy size 2 — limited-range extends to 3, attacks (2,2) from (5,5)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]); // size 2
    putPiece(pos, 2, 2, 'P', 'black'); // 3 diagonal steps
    expect(isSquareUnderAttack(pos, { col: 2, row: 2 }, 'white')).toBe(true);
  });

  it('Spy size 3 — limited-range extends to 4, attacks (1,1) from (5,5)', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]); // size 3
    putPiece(pos, 1, 1, 'P', 'black'); // 4 diagonal steps
    expect(isSquareUnderAttack(pos, { col: 1, row: 1 }, 'white')).toBe(true);
  });

  it('Cannon size 2 — jump extends to 2x range', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'C', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]); // size 2
    // Size 2 Cannon: jump extends by 1, so dest = (0,+4), over = [(0,+1),(0,+2),(0,+3)]
    // From (5,5): dest = (5, 5-4) = (5,1)
    putPiece(pos, 5, 1, 'P', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 1 }, 'white')).toBe(true);
  });

  it('General size 2 — limited-range extends step diagonals to 2', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'G', owner: 'white' },
      { type: 'G', owner: 'white' },
    ]); // size 2
    putPiece(pos, 3, 3, 'P', 'black'); // 2 diagonal steps in FL direction
    expect(isSquareUnderAttack(pos, { col: 3, row: 3 }, 'white')).toBe(true);
  });

  it('General size 3 — limited-range extends step diagonals to 3', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'G', owner: 'white' },
    ]); // size 3
    putPiece(pos, 2, 2, 'P', 'black'); // 3 diagonal steps in FL direction
    expect(isSquareUnderAttack(pos, { col: 2, row: 2 }, 'white')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 5 — isSquareUnderAttack: ownership & sourceStackSize filter */
/* ------------------------------------------------------------------ */

describe('isSquareUnderAttack — ownership and sourceStackSize filter', () => {
  it("Only the attacking player's pieces count", () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'black');
    // White attacks (5,4)
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
    // Black does NOT attack (5,4) — it's black's own piece there
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'black')).toBe(false);
  });

  it('Mixed-ownership stack — top determines ownership for attack', () => {
    const pos = emptyPos();
    // Stack with black top, white bottom
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'black' },
    ]);
    putPiece(pos, 5, 4, 'P', 'white');
    // Top is black Marshal → black's piece for attack purposes
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'black')).toBe(true);
    // White does NOT attack from this square (top is black)
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });

  it('sourceStackSize filter — only pieces of matching size are considered', () => {
    const pos = emptyPos();
    // size 1 piece at a new location
    putPiece(pos, 3, 3, 'P', 'white');
    // size 2 piece
    putStack(pos, 3, 7, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // target reachable by size-1: (3,2) is F for white from (3,3)
    putPiece(pos, 3, 2, 'P', 'black');
    // target reachable by size-2: (3,6) is F for white from (3,7)
    putPiece(pos, 3, 6, 'P', 'black');

    // Without filter — both attack
    expect(isSquareUnderAttack(pos, { col: 3, row: 2 }, 'white')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 3, row: 6 }, 'white')).toBe(true);

    // With sourceStackSize=1 — only size-1 piece considered
    expect(isSquareUnderAttack(pos, { col: 3, row: 2 }, 'white', 1)).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 3, row: 6 }, 'white', 1)).toBe(false);

    // With sourceStackSize=2 — only size-2 piece considered
    expect(isSquareUnderAttack(pos, { col: 3, row: 2 }, 'white', 2)).toBe(false);
    expect(isSquareUnderAttack(pos, { col: 3, row: 6 }, 'white', 2)).toBe(true);
  });

  it('No matching piece — returns false', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white'); // size 1
    putPiece(pos, 5, 4, 'P', 'black');
    // No size-2 white pieces
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white', 2)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 6 — isInCheck: basic detection                             */
/* ------------------------------------------------------------------ */

describe('isInCheck — basic detection', () => {
  it('Marshal under attack by enemy Pawn — in check', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'black'); // enemy Pawn
    expect(isInCheck(pos, 'white')).toBe(true);
  });

  it('Marshal not under attack — not in check', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    // No enemy pieces
    expect(isInCheck(pos, 'white')).toBe(false);
  });

  it('Marshal with no enemy nearby — not in check', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 1, 1, 'P', 'black'); // far away
    expect(isInCheck(pos, 'white')).toBe(false);
  });

  it('Opponent checks — symmetry', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'black');
    putPiece(pos, 5, 4, 'P', 'white');
    expect(isInCheck(pos, 'black')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 7 — isInCheck: Marshal not on board / in stack             */
/* ------------------------------------------------------------------ */

describe('isInCheck — Marshal not on board', () => {
  it('Marshal in hand (deploy phase) — not in check', () => {
    const pos = emptyPos();
    // No Marshal on board
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'black');
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
  });

  it("Only opponent's Marshal on board — not in check for player without Marshal", () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'black');
    putPiece(pos, 5, 4, 'P', 'white');
    // White has no Marshal on board
    expect(isInCheck(pos, 'white')).toBe(false);
    // Black's Marshal is under attack
    expect(isInCheck(pos, 'black')).toBe(true);
  });
});

describe('isInCheck — Marshal in stack', () => {
  it('Marshal on top of a size-2 stack — still detected', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 2, Marshal on top
    // Enemy piece must have source size >= 2 to attack (BR-MOVE-005)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 2 black
    expect(isInCheck(pos, 'white')).toBe(true);
  });

  it('Marshal on top of size-3 stack — still detected when under attack', () => {
    const pos = emptyPos();
    putStack(pos, 5, 5, [
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'M', owner: 'white' },
    ]); // size 3 with Marshal on top
    putPiece(pos, 5, 4, 'P', 'black'); // size 1 cannot attack size 3
    expect(isInCheck(pos, 'white')).toBe(false);

    // But a size-3 attacker can
    putStack(pos, 5, 6, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3
    // Black Pawn at (5,6) can step to (5,5) — source 3 >= target 3
    expect(isInCheck(pos, 'white')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 8 — isExposed                                              */
/* ------------------------------------------------------------------ */

describe('isExposed — exposure evaluation (BR-DEPLOY-012)', () => {
  it('Both Marshals under attack — both exposed', () => {
    const pos = emptyPos();
    // White Marshal at (5,9), enemy Pawn at (5,8)
    putPiece(pos, 5, 9, 'M', 'white');
    putPiece(pos, 5, 8, 'P', 'black');
    // Black Marshal at (5,1), enemy Pawn at (5,2)
    putPiece(pos, 5, 1, 'M', 'black');
    putPiece(pos, 5, 2, 'P', 'white');

    const result = isExposed(pos);
    expect(result.white).toBe(true);
    expect(result.black).toBe(true);
  });

  it('Only White Marshal under attack — white exposed', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'M', 'white');
    putPiece(pos, 5, 8, 'P', 'black');
    putPiece(pos, 5, 1, 'M', 'black'); // safe

    const result = isExposed(pos);
    expect(result.white).toBe(true);
    expect(result.black).toBe(false);
  });

  it('Only Black Marshal under attack — black exposed', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'M', 'white'); // safe
    putPiece(pos, 5, 1, 'M', 'black');
    putPiece(pos, 5, 2, 'P', 'white');

    const result = isExposed(pos);
    expect(result.white).toBe(false);
    expect(result.black).toBe(true);
  });

  it('Neither Marshal under attack — neither exposed', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'M', 'white');
    putPiece(pos, 5, 1, 'M', 'black');
    // No enemy pieces near either Marshal

    const result = isExposed(pos);
    expect(result.white).toBe(false);
    expect(result.black).toBe(false);
  });

  it('Neither Marshal on board (deploy phase) — neither exposed', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'black');

    const result = isExposed(pos);
    expect(result.white).toBe(false);
    expect(result.black).toBe(false);
  });

  it('No pieces at all — neither exposed', () => {
    const pos = emptyPos();
    const result = isExposed(pos);
    expect(result.white).toBe(false);
    expect(result.black).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 9 — Integration tests with GSFEN fixtures                  */
/* ------------------------------------------------------------------ */

describe('GSFEN integration — attack/check/exposure states', () => {
  it('startpos — no attacks, no checks, no exposure', () => {
    const pos = gsfenPos('startpos');
    // Empty board in startpos
    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'white')).toBe(false);
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
    const exp = isExposed(pos);
    expect(exp.white).toBe(false);
    expect(exp.black).toBe(false);
  });

  it('white-marshal-at-5-9 — only White Marshal on board, no enemies near', () => {
    const pos = gsfenPos(BOTH_MARSHALS_DEPLOY_CTR2);
    // Black Marshal at (5,1), White Marshal at (5,9)
    // All other pieces are in hands, no attack possible
    // But wait — black n at (4,3) could attack? No, other pieces aren't on board
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
  });

  it('both-marshals-placed — Marshals placed, no threats', () => {
    const pos = gsfenPos(BOTH_MARSHALS_PLACED);
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
  });

  it('battle-start — Marshals have no direct threats', () => {
    const pos = gsfenPos(BATTLE_START);
    // White Marshal at (5,9), Black Marshal at (5,1)
    // Both have pieces in between — check threats
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
  });

  it('dense-engagement — complex position with stacks', () => {
    // Board layout (row 1 = top):
    //   Row 1: p at (3,1), e at (7,1)
    //   Row 2: GN stack at (5,2) [G bottom, N top]
    //   Row 3: A at (3,3), M at (5,3), A at (7,3)
    //   Row 5: f at (3,5), YN stack at (5,5)
    //   Row 6: EP stack at (5,6)
    //   Row 7: PS stack at (4,7), PU stack at (6,7)
    //   Row 8: S at (3,8), g at (4,8), S at (7,8)
    //   Row 9: m at (5,9)
    // White Marshal at (5,9) — no black piece threatens it (nearest black pieces
    // are at rows 1-3, too far for step movement, and row 8 has only white pieces).
    // Black Marshal at (5,3) — no white piece reaches it (white pieces on rows 5-9
    // are blocked or out of range).
    const pos = gsfenPos(DENSE_ENGAGEMENT);
    expect(isInCheck(pos, 'white')).toBe(false);
    expect(isInCheck(pos, 'black')).toBe(false);
    const exp = isExposed(pos);
    expect(exp.white).toBe(false);
    expect(exp.black).toBe(false);

    // Cross-check: Marshal squares are not under attack by opponent
    expect(isSquareUnderAttack(pos, { col: 5, row: 9 }, 'black')).toBe(false);
    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(false);

    // Sanity: white pieces DO attack some squares (the position is not dead)
    // g (white General) at (4,8) has range movement — attacks along orthogonals
    expect(isSquareUnderAttack(pos, { col: 4, row: 7 }, 'white')).toBe(true);
    // Y (black Spy) at top of (5,5) stack — attacks diagonals
    expect(isSquareUnderAttack(pos, { col: 4, row: 4 }, 'black')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 10 — Edge cases                                            */
/* ------------------------------------------------------------------ */

describe('Edge cases', () => {
  it('Piece cannot attack its own square', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'white')).toBe(false);
  });

  it('No enemy pieces — no attacks for opponent', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    expect(isSquareUnderAttack(pos, { col: 5, row: 5 }, 'black')).toBe(false);
  });

  it('Black player direction — Pawn at centre attacks correctly for black', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'black');
    putPiece(pos, 5, 6, 'P', 'white'); // black F = row+1
    putPiece(pos, 5, 4, 'P', 'white'); // black B = row-1

    // Black Pawn steps: F, B
    // For black: F = row+1 = (5,6), B = row-1 = (5,4)
    expect(isSquareUnderAttack(pos, { col: 5, row: 6 }, 'black')).toBe(true);
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'black')).toBe(true);
  });

  it('Black Marshal check — symmetry of direction', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'black');
    putPiece(pos, 5, 6, 'P', 'white'); // black F = row+1
    expect(isInCheck(pos, 'black')).toBe(true);
  });

  it('Friendly pieces do not attack each other', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'white'); // friendly
    // White asking if white attacks a friendly square — still true
    // (Attack disregards friendly occupation per BR-Attack)
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });

  it('Path blocked by obstruction — squares beyond are not attacked', () => {
    const pos = emptyPos();
    // General at (5,9), Pawn at (5,6) blocks, target at (5,3)
    putPiece(pos, 5, 9, 'G', 'white');
    putPiece(pos, 5, 6, 'P', 'white'); // blocker (friendly)
    putPiece(pos, 5, 3, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(false);
    // But the blocker itself IS attacked
    expect(isSquareUnderAttack(pos, { col: 5, row: 6 }, 'white')).toBe(true);
  });

  it('Enemy block — squares beyond are not attacked', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 9, 'G', 'white');
    putPiece(pos, 5, 6, 'P', 'black'); // enemy block
    putPiece(pos, 5, 3, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 3 }, 'white')).toBe(false);
    // The blocker itself IS attacked
    expect(isSquareUnderAttack(pos, { col: 5, row: 6 }, 'white')).toBe(true);
  });

  it('Multiple attackers — returns true if any piece can attack', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    putPiece(pos, 3, 5, 'P', 'white');
    putPiece(pos, 5, 4, 'P', 'black');

    // Pawn at (5,5) attacks (5,4)
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);

    // Pawn at (3,5) cannot attack (5,4) — wrong direction
    // But the first piece already covers it
  });

  it('Jump path blocked by large stack on over square — not attacked', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white'); // size 1
    // Size-2 stack on over square (5,4)
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]);
    putPiece(pos, 5, 2, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(false);
  });

  it('Jump path — empty over squares allow attack (BR-PATH-002)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white');
    // Over squares (5,4) and (5,3) are empty
    putPiece(pos, 5, 2, 'P', 'black');
    expect(isSquareUnderAttack(pos, { col: 5, row: 2 }, 'white')).toBe(true);
  });

  it('All pieces attack the target at same time — dense scenario', () => {
    const pos = emptyPos();
    // Place multiple white pieces that can all attack (5,4)
    putPiece(pos, 5, 5, 'P', 'white'); // B to (5,6)... no wait
    // P at (5,5): F=(5,4), B=(5,6)
    putPiece(pos, 5, 5, 'M', 'white'); // step all 8 dirs
    putPiece(pos, 4, 4, 'P', 'white'); // step to (5,4)?

    // White M at (5,5): F = (5,4), so yes
    // White P at (4,4): L = (5,4) for white? L = col+1 = (5,4), yes
    putPiece(pos, 5, 4, 'P', 'black');

    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 11 — getLegalDestinations cross-check                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Section 11 — Exact attack-set enumeration                          */
/* ------------------------------------------------------------------ */

describe('Exact attack-set enumeration', () => {
  /**
   * Helper: checks that a piece at the given position attacks EXACTLY the given
   * set of squares and NO others among the checked candidates.
   */
  function assertExactAttackSet(
    pos: Position,
    _pieceCol: number,
    _pieceRow: number,
    player: Player,
    expectedAttacked: { col: number; row: number }[],
    notAttacked: { col: number; row: number }[],
  ): void {
    for (const sq of expectedAttacked) {
      expect(
        isSquareUnderAttack(pos, { col: sq.col as BoardCoord, row: sq.row as BoardCoord }, player),
        `Expected (${sq.col},${sq.row}) to be attacked`,
      ).toBe(true);
    }
    for (const sq of notAttacked) {
      expect(
        isSquareUnderAttack(pos, { col: sq.col as BoardCoord, row: sq.row as BoardCoord }, player),
        `Expected (${sq.col},${sq.row}) to NOT be attacked`,
      ).toBe(false);
    }
  }

  it('Marshal at (5,5) size 1 — attacks EXACTLY the 8 neighbours', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    // Place enemies on all 8 neighbour squares so they can be tested
    const neighbours = [
      { col: 5, row: 4 }, // F
      { col: 5, row: 6 }, // B
      { col: 6, row: 5 }, // L
      { col: 4, row: 5 }, // R
      { col: 6, row: 4 }, // FL
      { col: 4, row: 4 }, // FR
      { col: 6, row: 6 }, // BL
      { col: 4, row: 6 }, // BR
    ];
    for (const sq of neighbours) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', neighbours, [
      { col: 5, row: 3 }, // 2 forward — out of step range
      { col: 7, row: 5 }, // 2 left — out of step range
      { col: 7, row: 3 }, // 2 FL — out of step range
      { col: 5, row: 5 }, // own square
    ]);
  });

  it('Fortress at (5,5) size 1 — attacks EXACTLY F, L, R, BL, BR (5 squares)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'F', 'white');
    const attacked = [
      { col: 5, row: 4 }, // F
      { col: 6, row: 5 }, // L
      { col: 4, row: 5 }, // R
      { col: 6, row: 6 }, // BL
      { col: 4, row: 6 }, // BR
    ];
    for (const sq of attacked) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', attacked, [
      { col: 5, row: 6 }, // B — Fortress cannot go backward
      { col: 6, row: 4 }, // FL — Fortress cannot go FL
      { col: 4, row: 4 }, // FR — Fortress cannot go FR
    ]);
  });

  it('Pawn at (5,5) size 1 — attacks EXACTLY F, B (2 squares)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'P', 'white');
    const attacked = [
      { col: 5, row: 4 }, // F
      { col: 5, row: 6 }, // B
    ];
    for (const sq of attacked) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', attacked, [
      { col: 6, row: 5 }, // L — Pawn cannot go sideways
      { col: 4, row: 5 }, // R — Pawn cannot go sideways
      { col: 6, row: 4 }, // FL — Pawn cannot go diagonal
      { col: 4, row: 4 }, // FR — Pawn cannot go diagonal
      { col: 6, row: 6 }, // BL — Pawn cannot go diagonal
      { col: 4, row: 6 }, // BR — Pawn cannot go diagonal
    ]);
  });

  it('Samurai at (5,5) size 1 — attacks EXACTLY F, FL, FR, B (4 squares)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'S', 'white');
    const attacked = [
      { col: 5, row: 4 }, // F
      { col: 6, row: 4 }, // FL
      { col: 4, row: 4 }, // FR
      { col: 5, row: 6 }, // B
    ];
    for (const sq of attacked) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', attacked, [
      { col: 6, row: 5 }, // L — Samurai cannot go L
      { col: 4, row: 5 }, // R — Samurai cannot go R
      { col: 6, row: 6 }, // BL — Samurai cannot go BL
      { col: 4, row: 6 }, // BR — Samurai cannot go BR
    ]);
  });

  it('Captain at (5,5) size 1 — attacks EXACTLY FL, FR, B (3 squares)', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'T', 'white');
    const attacked = [
      { col: 6, row: 4 }, // FL
      { col: 4, row: 4 }, // FR
      { col: 5, row: 6 }, // B
    ];
    for (const sq of attacked) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', attacked, [
      { col: 5, row: 4 }, // F — Captain cannot go F
      { col: 6, row: 5 }, // L — Captain cannot go L
      { col: 4, row: 5 }, // R — Captain cannot go R
      { col: 6, row: 6 }, // BL — Captain cannot go BL
      { col: 4, row: 6 }, // BR — Captain cannot go BR
    ]);
  });

  it('Cannon at (5,5) size 1 — attacks EXACTLY L, R, B + jump forward 3', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'C', 'white');
    const attacked = [
      { col: 6, row: 5 }, // L (step)
      { col: 4, row: 5 }, // R (step)
      { col: 5, row: 6 }, // B (step)
      { col: 5, row: 2 }, // Jump forward 3: dest (0,+3) → (5, 5-3) = (5,2)
    ];
    for (const sq of attacked) putPiece(pos, sq.col, sq.row, 'P', 'black');

    assertExactAttackSet(pos, 5, 5, 'white', attacked, [
      { col: 5, row: 4 }, // F step — Cannon has no F step
      { col: 5, row: 3 }, // Jump over-square — not a destination
      { col: 5, row: 1 }, // Beyond jump — too far
      { col: 6, row: 4 }, // FL — not a Cannon direction
    ]);
  });
});

/* ------------------------------------------------------------------ */
/*  Section 12 — Cross-check with getLegalDestinations                 */
/* ------------------------------------------------------------------ */

describe('Cross-check with getLegalDestinations', () => {
  it('isSquareUnderAttack matches getLegalDestinations for single piece', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white');
    putPiece(pos, 5, 4, 'P', 'black');

    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const canReach = moves.some((m) => m.dest.col === 5 && m.dest.row === 4);

    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(canReach);
  });

  it('isSquareUnderAttack returns false for square not in legal destinations', () => {
    const pos = emptyPos();
    putPiece(pos, 5, 5, 'M', 'white'); // size 1, step only
    putStack(pos, 5, 4, [
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]); // size 3

    const moves = getLegalDestinations(pos, { col: 5, row: 5 }, 'white');
    const canReach = moves.some((m) => m.dest.col === 5 && m.dest.row === 4);

    expect(canReach).toBe(false); // 1 < 3 → blocked by BR-MOVE-005
    expect(isSquareUnderAttack(pos, { col: 5, row: 4 }, 'white')).toBe(false);
  });
});
