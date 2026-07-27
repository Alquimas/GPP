/**
 * Board query helpers — general-purpose utilities for inspecting a Gungi
 * Position (the 9×9 board).  Pure domain logic with no I/O.
 *
 * These live here instead of the validator or movement modules so that all
 * board queries share one import seam and one consistent convention for
 * indexing and ownership.
 *
 * @module
 */

import type {
  BoardCoord,
  Direction,
  Piece,
  PieceType,
  Player,
  Position,
  Square,
  Stack,
} from '../types.js';

/* ------------------------------------------------------------------ */
/*  Private helper – iterates each occupied square on the board        */
/* ------------------------------------------------------------------ */

type OccupiedSquare = { row: number; col: number; stack: Stack };

function forEachOccupiedSquare(position: Position, fn: (cell: OccupiedSquare) => void): void {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = position[r][c];
      if (stack !== null) {
        fn({ row: r, col: c, stack });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Public query helpers                                               */
/* ------------------------------------------------------------------ */

/** Count occurrences of each piece type for a given owner on the board. */
export function countBoardPieces(position: Position, owner: Player): Record<PieceType, number> {
  const counts: Record<PieceType, number> = {
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
  };
  forEachOccupiedSquare(position, ({ stack }) => {
    for (const piece of stack) {
      if (piece.owner === owner) {
        counts[piece.type]++;
      }
    }
  });
  return counts;
}

/** Check if a player has any pieces on the board. */
export function hasAnyBoardPieces(position: Position, owner: Player): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = position[r][c];
      if (stack === null) continue;
      for (const piece of stack) {
        if (piece.owner === owner) return true;
      }
    }
  }
  return false;
}

/** Count occurrences of a specific piece type for a specific owner. */
export function countPieceOnBoard(position: Position, type: PieceType, owner: Player): number {
  let count = 0;
  forEachOccupiedSquare(position, ({ stack }) => {
    for (const piece of stack) {
      if (piece.type === type && piece.owner === owner) count++;
    }
  });
  return count;
}

/**
 * Location of a piece on the board.
 */
export type PieceLocation = {
  row: number;
  col: number;
  stackIndex: number;
};

/** Find all positions of a specific piece type for a specific owner. */
export function findPieceOnBoard(
  position: Position,
  type: PieceType,
  owner: Player,
): PieceLocation[] {
  const result: PieceLocation[] = [];
  forEachOccupiedSquare(position, ({ row, col, stack }) => {
    for (let si = 0; si < stack.length; si++) {
      const piece = stack[si];
      if (piece.type === type && piece.owner === owner) {
        result.push({ row, col, stackIndex: si });
      }
    }
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  Board primitives (Step 6 — Movement Rules Engine)                  */
/* ------------------------------------------------------------------ */

/** Return the stack at a square, or null if empty. */
export function getStack(position: Position, square: Square): Stack | null {
  if (!squareInBounds(square)) {
    throw new Error(`Square (${square.col}, ${square.row}) is out of bounds`);
  }
  return position[square.row - 1][square.col - 1] ?? null;
}

/**
 * Return a new Position with the stack at the given square replaced.
 * Does NOT mutate the original Position.
 */
export function setStack(position: Position, square: Square, stack: Stack | null): Position {
  if (!squareInBounds(square)) {
    throw new Error(`Square (${square.col}, ${square.row}) is out of bounds`);
  }
  const newPos = position.map((row) => [...row]);
  newPos[square.row - 1][square.col - 1] = stack;
  return newPos;
}

/** Check whether a Square is within the 9×9 board. */
export function squareInBounds(square: Square): boolean {
  return square.col >= 1 && square.col <= 9 && square.row >= 1 && square.row <= 9;
}

/**
 * White-relative direction deltas.
 * F = row-1, B = row+1, L = col+1, R = col-1.
 * For Black every component is negated.
 */
const WHITE_DIR_DELTA: Record<Direction, { col: number; row: number }> = {
  F: { col: 0, row: -1 },
  B: { col: 0, row: 1 },
  L: { col: 1, row: 0 },
  R: { col: -1, row: 0 },
  FL: { col: 1, row: -1 },
  FR: { col: -1, row: -1 },
  BL: { col: 1, row: 1 },
  BR: { col: -1, row: 1 },
};

/**
 * Compute the adjacent Square in the given player-relative direction.
 * Returns null if the result would be off the board.
 *
 * @param col - 1-indexed column
 * @param row - 1-indexed row
 */
export function applyDirection(
  col: BoardCoord,
  row: BoardCoord,
  direction: Direction,
  player: Player,
): Square | null {
  if (!squareInBounds({ col, row })) {
    throw new Error(`Input coordinates (${col}, ${row}) are out of bounds`);
  }
  const base = WHITE_DIR_DELTA[direction];
  const dc = player === 'white' ? base.col : -base.col;
  const dr = player === 'white' ? base.row : -base.row;
  const newCol = col + dc;
  const newRow = row + dr;
  if (newCol < 1 || newCol > 9 || newRow < 1 || newRow > 9) return null;
  return { col: newCol as BoardCoord, row: newRow as BoardCoord };
}

/** True if the square has a stack whose top piece belongs to `player`. */
export function isOccupiedBy(position: Position, square: Square, player: Player): boolean {
  const stack = getStack(position, square);
  return stack !== null && topPiece(stack).owner === player;
}

/** Return the top piece of a stack (highest level). */
export function topPiece(stack: Stack): Piece {
  return stack[stack.length - 1];
}

/** Return the number of pieces in a stack (1–3). */
export function stackSize(stack: Stack): number {
  return stack.length;
}
