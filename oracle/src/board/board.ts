/**
 * Board query helpers --- general-purpose utilities for inspecting a Gungi
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
/*  Runtime-validated narrowing helpers                                */
/*                                                                     */
/*  These are the SINGLE points of truth for narrowing `number` ->      */
/*  `BoardCoord` and `Piece[]` -> `Stack`.  Every other call site in    */
/*  the codebase should route through one of these helpers instead of  */
/*  using a raw `as BoardCoord` / `as Stack` cast.                     */
/* ------------------------------------------------------------------ */

/**
 * Type guard: true iff `n` is an integer in 1..9.
 *
 * Narrows `n` to `BoardCoord` on the true branch, so downstream code
 * can build a `Square` without a cast.
 */
export function isBoardCoord(n: number): n is BoardCoord {
  return Number.isInteger(n) && n >= 1 && n <= 9;
}

/**
 * Build a Square from raw coordinates. Returns null if either component
 * is outside the 1..9 board range.
 *
 * Prefer this over a manual `as BoardCoord` cast --- the type predicate
 * in `isBoardCoord` does the narrowing.
 */
export function trySquare(col: number, row: number): Square | null {
  if (!isBoardCoord(col) || !isBoardCoord(row)) return null;
  return { col, row };
}

/**
 * Build a Square from 0-indexed position indices (r, c each in 0..8).
 *
 * The cast is provably safe here: c ∈ [0,8] ⇒ c+1 ∈ [1,9].  Isolating
 * the cast in one helper keeps the invariant auditable.
 *
 * @throws if either index is not an integer in 0..8 --- same loud style as
 *   `getStack`/`setStack` so a buggy caller fails loudly instead of silently
 *   fabricating an out-of-bounds Square (e.g. squareFromIndex(9, 0) used to
 *   return { col: 1, row: 10 }).
 */
export function squareFromIndex(r: number, c: number): Square {
  if (!Number.isInteger(r) || r < 0 || r > 8 || !Number.isInteger(c) || c < 0 || c > 8) {
    throw new Error(`squareFromIndex index (${r}, ${c}) is out of bounds (expected r, c in 0..8)`);
  }
  return { col: (c + 1) as BoardCoord, row: (r + 1) as BoardCoord };
}

/**
 * Build a Stack from a piece array with runtime length validation.
 *
 * @throws if `pieces.length` is not 1, 2, or 3.
 *
 * Use this at parser boundaries and anywhere a Stack is constructed
 * from dynamic data.  The `as Stack` cast is safe because the length
 * check above is the Stack tuple type's only non-type-level invariant.
 */
export function createStack(pieces: Piece[]): Stack {
  if (pieces.length < 1 || pieces.length > 3) {
    throw new Error(`Stack must have 1–3 pieces, got ${pieces.length}`);
  }
  return pieces as Stack;
}

/**
 * Validate that a Position has the required 9×9 shape.
 *
 * @throws if the shape is wrong.  Cheap enough to call at construction
 * time (e.g. after parsing a GSFEN) but not on every query.
 */
export function validatePosition(pos: Position): void {
  if (pos.length !== 9) {
    throw new Error(`Position must have 9 rows, got ${pos.length}`);
  }
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(pos[r]) || pos[r].length !== 9) {
      throw new Error(`Position row ${r} must be an array of length 9`);
    }
  }
}

/** Build an empty 9×9 Position (every square null). */
export function emptyPosition(): Position {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
}

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
 * Returns true iff the given player's Marshal has already been placed on the board.
 *
 * Canonical implementation of BR-DEPLOY-003 (Marshal-first) and BR-DEPLOY-011.
 * Both callers (deploy.ts and gsfen/validate.ts) should use this instead of
 * inferring Marshal placement from hand contents or scanning independently.
 */
export function hasPlacedMarshal(position: Position, player: Player): boolean {
  return countPieceOnBoard(position, 'M', player) >= 1;
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
/*  Board primitives (Step 6 --- Movement Rules Engine)                  */
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
  // trySquare narrows via the isBoardCoord type predicate --- no cast needed.
  return trySquare(col + dc, row + dr);
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
