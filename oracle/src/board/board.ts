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

import type { PieceType, Player, Position, Stack } from '../types.js';

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
