/**
 * Movement rules engine — computes all legal destinations for any piece at
 * any stack size, applying the BR-MOVEMENT / BR-PATH / BR-MOVE-005 rules.
 *
 * Pure domain logic with no I/O.  Every function treats Position as immutable.
 *
 * @module
 */

import type {
  CoordDelta,
  Direction,
  JumpPattern,
  MoveClass,
  Player,
  Position,
  Square,
  Stack,
} from '../types.js';
import { PIECE_MOVEMENT } from '../constants.js';
import {
  applyDirection,
  getStack,
  squareFromIndex,
  stackSize as getStackSize,
  topPiece,
  trySquare,
} from './board.js';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type MoveOutcome = 'stack' | 'capture';

export type LegalMove = {
  dest: Square;
  moveClass: MoveClass;
  outcome: MoveOutcome | null;
};

/* ------------------------------------------------------------------ */
/*  Private helpers                                                    */
/* ------------------------------------------------------------------ */

/** BR-MOVE-005: source stack size >= target stack size. */
function canLandOnStack(sourceSize: number, targetStack: Stack | null): boolean {
  if (targetStack === null) return true;
  return sourceSize >= getStackSize(targetStack);
}

/**
 * Determine move outcome based on target ownership and stack composition.
 * - null      → empty or friendly (automatic stack)
 * - 'stack'   → enemy, size < 3, top is not Marshal (player may choose)
 * - 'capture' → enemy, size = 3 OR top is Marshal (forced)
 *
 * ## BR-STACK-004 separation
 * This function does NOT enforce "no piece may be placed or moved on top
 * of a Marshal."  The movement engine computes every geometrically
 * reachable square; the semantic prohibition on stacking onto a Marshal
 * is enforced by the validator (Step 8 — `validateMove` / `validateArata`)
 * which rejects moves whose target top is a friendly Marshal.  Callers
 * that need only the rule-legal move set must therefore run the result
 * through the validator — `getLegalDestinations` alone is necessary but
 * not sufficient for legality.
 */
function determineOutcome(targetStack: Stack | null, player: Player): MoveOutcome | null {
  if (targetStack === null) return null;
  const top = topPiece(targetStack);
  if (top.owner === player) return null;
  const tSize = getStackSize(targetStack);
  if (tSize === 3 || top.type === 'M') return 'capture';
  return 'stack';
}

/**
 * Convert a player-relative CoordDelta into an absolute board Square.
 * For White: positive row = forward (row-1), positive col = left (col+1).
 * For Black: negate both components.
 *
 * Returns `null` if the computed square lies outside the board — callers
 * should treat null as "off-board destination" (skip / block, depending
 * on movement class).
 */
function applyCoordDelta(origin: Square, delta: CoordDelta, player: Player): Square | null {
  const col = player === 'white' ? origin.col + delta.col : origin.col - delta.col;
  const row = player === 'white' ? origin.row - delta.row : origin.row + delta.row;
  return trySquare(col, row);
}

/* ------------------------------------------------------------------ */
/*  1. Step movement (BR-MOVEMENT-001)                                 */
/*     Size 1 only — exactly 1 square per allowed direction.          */
/* ------------------------------------------------------------------ */

function computeStepMovement(
  position: Position,
  square: Square,
  player: Player,
  directions: Direction[],
): LegalMove[] {
  const results: LegalMove[] = [];
  const sourceStack = getStack(position, square);
  if (!sourceStack) return results;
  const sourceSize = getStackSize(sourceStack);

  for (const dir of directions) {
    const dest = applyDirection(square.col, square.row, dir, player);
    if (!dest) continue;

    const targetStack = getStack(position, dest);
    if (!canLandOnStack(sourceSize, targetStack)) continue;
    results.push({
      dest,
      moveClass: 'step',
      outcome: determineOutcome(targetStack, player),
    });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  2 / 3. Trace movement (limited-range & range)                     */
/*         BR-MOVEMENT-002 / BR-MOVEMENT-003 / BR-PATH-001            */
/* ------------------------------------------------------------------ */

/**
 * Trace a single direction up to `maxRange` steps, adding every valid
 * square along the way.  Stops at the **first obstruction**
 * (BR-PATH-001): the obstruction square itself is a valid destination,
 * but the path cannot extend beyond it.
 *
 * Reused for:
 * - step directions at sizes 2-3 (step becomes limited-range)
 * - limited-range directions (base max 2, scales per stack size)
 * - range directions (maxRange = 9, effectively board edge)
 */
function computeTraceMovement(
  position: Position,
  square: Square,
  player: Player,
  directions: Direction[],
  maxRange: number,
  moveClass: MoveClass,
): LegalMove[] {
  const results: LegalMove[] = [];
  const sourceStack = getStack(position, square);
  if (!sourceStack) return results;
  const sourceSize = getStackSize(sourceStack);

  for (const dir of directions) {
    let col = square.col;
    let row = square.row;

    for (let step = 1; step <= maxRange; step++) {
      const next = applyDirection(col, row, dir, player);
      if (!next) break; // off board — stop tracing this direction

      const targetStack = getStack(position, next);

      if (targetStack !== null) {
        // BR-PATH-001: obstruction — may land on it, but cannot go beyond
        if (canLandOnStack(sourceSize, targetStack)) {
          results.push({
            dest: next,
            moveClass,
            outcome: determineOutcome(targetStack, player),
          });
        }
        break; // stop tracing past obstruction
      }

      // Empty square — always a valid landing (BR-MOVE-005 is trivially
      // satisfied for an empty target; `canLandOnStack(sourceSize, null)`
      // is always true, so we push unconditionally rather than re-check).
      results.push({ dest: next, moveClass, outcome: null });

      col = next.col;
      row = next.row;
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  4. Jump movement (BR-MOVEMENT-004 / BR-PATH-002)                  */
/* ------------------------------------------------------------------ */

/**
 * Generate all jump patterns for a given base pattern up to a target
 * stack size, following the scaling rule in BR-MOVEMENT-005.
 *
 * Each extension adds the vector `dest - farthest(over)` from the base
 * pattern.  The previous level's destination becomes part of the jumped-
 * over set.
 */
/**
 * Generate all jump patterns for a given base pattern up to a target
 * stack size, following the scaling rule in BR-MOVEMENT-005.
 *
 * Each extension adds the vector `dest - farthest(over)` from the base
 * pattern.  The previous level's destination becomes part of the jumped-
 * over set.
 *
 * @throws if `base.over` is empty — a jump pattern with no intervening
 *   squares is not a meaningful jump (it would be a step) and signals a
 *   data error in `PIECE_MOVEMENT`.  Failing loudly here prevents silent
 *   divergence under differential testing against a future Core.
 */
export function getScaledJumps(
  base: JumpPattern,
  upToLevel: number,
): { dest: CoordDelta; over: CoordDelta[] }[] {
  const patterns: { dest: CoordDelta; over: CoordDelta[] }[] = [];

  if (base.over.length === 0) {
    throw new Error(
      `Jump pattern must have at least one jumped-over square; got dest=${JSON.stringify(base.dest)}, over=[]`,
    );
  }

  // Extension vector: dest - farthest(over)
  const farthestOver = base.over[base.over.length - 1];
  const extCol = base.dest.col - farthestOver.col;
  const extRow = base.dest.row - farthestOver.row;

  // If extension vector is zero, no meaningful scaling possible beyond level 1
  if (extCol === 0 && extRow === 0) {
    patterns.push({
      dest: { col: base.dest.col, row: base.dest.row },
      over: base.over.map((o) => ({ col: o.col, row: o.row })),
    });
    return patterns;
  }

  // Level 1
  let prevDest: CoordDelta = { col: base.dest.col, row: base.dest.row };
  let prevOver: CoordDelta[] = base.over.map((o) => ({ col: o.col, row: o.row }));
  patterns.push({ dest: { ...prevDest }, over: prevOver.map((o) => ({ ...o })) });

  // Levels 2 .. upToLevel
  for (let level = 2; level <= upToLevel; level++) {
    const newDest: CoordDelta = {
      col: prevDest.col + extCol,
      row: prevDest.row + extRow,
    };
    const newOver: CoordDelta[] = [
      ...prevOver.map((o) => ({ ...o })),
      { col: prevDest.col, row: prevDest.row },
    ];
    patterns.push({ dest: newDest, over: newOver });
    prevDest = newDest;
    prevOver = newOver;
  }

  return patterns;
}

/**
 * Compute legal destinations for jump movement (BR-MOVEMENT-004).
 *
 * BR-PATH-002: a jump is blocked if any jumped-over square has a stack
 * whose size > the jumping piece's source stack size.
 */
function computeJumpMovement(
  position: Position,
  square: Square,
  player: Player,
  baseJumps: JumpPattern[],
  sourceSize: number,
): LegalMove[] {
  const results: LegalMove[] = [];

  for (const base of baseJumps) {
    const patterns = getScaledJumps(base, sourceSize);
    for (const pattern of patterns) {
      // `applyCoordDelta` returns null for off-board destinations — skip.
      const destSquare = applyCoordDelta(square, pattern.dest, player);
      if (!destSquare) continue;

      // BR-PATH-002: check all jumped-over squares.
      // An off-board over-square means the jump pattern itself is
      // geometrically impossible from this origin — block.
      let blocked = false;
      for (const over of pattern.over) {
        const overSquare = applyCoordDelta(square, over, player);
        if (!overSquare) {
          blocked = true;
          break;
        }
        const overStack = getStack(position, overSquare);
        if (overStack && getStackSize(overStack) > sourceSize) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // BR-MOVE-005: source size >= target size
      const targetStack = getStack(position, destSquare);
      if (!canLandOnStack(sourceSize, targetStack)) continue;

      results.push({
        dest: destSquare,
        moveClass: 'jump',
        outcome: determineOutcome(targetStack, player),
      });
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Entry points                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return all legal destinations for the **top piece** at `square`
 * belonging to `player`.
 *
 * Dispatches to the four movement class handlers and pools the results.
 * Returns an empty array if the square is empty or the top piece does not
 * belong to `player`.
 */
export function getLegalDestinations(
  position: Position,
  square: Square,
  player: Player,
): LegalMove[] {
  const stack = getStack(position, square);
  if (!stack) return [];
  const top = topPiece(stack);
  if (top.owner !== player) return [];
  const sSize = getStackSize(stack);
  const def = PIECE_MOVEMENT[top.type];

  const results: LegalMove[] = [];

  // 1. Step movement (BR-MOVEMENT-001)
  if (sSize === 1) {
    // Size 1: exact 1-square step
    results.push(...computeStepMovement(position, square, player, def.step));
  } else {
    // Sizes 2-3: step becomes limited-range per BR-MOVEMENT-005
    results.push(...computeTraceMovement(position, square, player, def.step, sSize, 'step'));
  }

  // 2. Limited range movement (BR-MOVEMENT-002)
  if (def.limitedRange.length > 0) {
    // max = stackSize + 1  (base 2 at size 1, 3 at size 2, 4 at size 3)
    const maxRange = sSize + 1;
    results.push(
      ...computeTraceMovement(
        position,
        square,
        player,
        def.limitedRange,
        maxRange,
        'limited-range',
      ),
    );
  }

  // 3. Range movement (BR-MOVEMENT-003) — unaffected by stack size
  if (def.range.length > 0) {
    results.push(...computeTraceMovement(position, square, player, def.range, 9, 'range'));
  }

  // 4. Jump movement (BR-MOVEMENT-004)
  if (def.jumps.length > 0) {
    results.push(...computeJumpMovement(position, square, player, def.jumps, sSize));
  }

  return results;
}

/**
 * Convenience function: returns **all** legal destinations for every
 * piece belonging to `player` on the board.
 *
 * Useful for checkmate / stalemate detection and action visualisers.
 */
export function getLegalMoves(position: Position, player: Player): LegalMove[] {
  const results: LegalMove[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = position[r][c];
      if (!stack) continue;
      if (topPiece(stack).owner === player) {
        // squareFromIndex is safe here: r, c ∈ [0,8] ⇒ +1 ∈ [1,9].
        const square = squareFromIndex(r, c);
        results.push(...getLegalDestinations(position, square, player));
      }
    }
  }
  return results;
}
