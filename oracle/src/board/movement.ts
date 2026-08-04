/**
 * Movement rules engine --- computes all legal destinations for any piece at
 * any stack size, applying the BR-MOVEMENT / BR-PATH / BR-MOVE-005 /
 * BR-STACK-003 / BR-STACK-004 rules.
 *
 * Landing prohibitions are enforced here, in the movement engine itself:
 * - BR-STACK-003: a destination on a friendly stack of size 3 is excluded
 *   (the stack size limit of 3 cannot be exceeded).
 * - BR-STACK-004: a destination whose target stack is topped by a Marshal
 *   (friendly or enemy) is excluded (no piece may be placed on top of a
 *   Marshal; the Marshal is never actually captured).
 *
 * Excluded squares are still obstructions (BR-PATH-001): traces stop at the
 * first occupied square regardless of whether a landing is permitted ---
 * excluded squares are never pass-through.
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

/**
 * Options for `getLegalDestinations`.
 *
 * - `skipStackingProhibitions`: when set, the BR-STACK-003 (friendly size-3)
 *   and BR-STACK-004 (Marshal-topped target) landing exclusions are NOT
 *   applied.  Used exclusively by threat/attack evaluation
 *   (`isSquareUnderAttack`), where reachability disregards landing
 *   restrictions per the BR-Attack definition.  All game-rule callers
 *   (validateMove, getLegalMoves, candidates) use the default (exclusions
 *   applied).
 */
export type GetLegalDestinationsOptions = {
  skipStackingProhibitions?: boolean;
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
 * - null      -> empty or friendly (automatic stack)
 * - 'stack'   -> enemy, size < 3, top is not Marshal (player may choose)
 * - 'capture' -> enemy, size = 3 OR top is Marshal (forced)
 *
 * ## BR-STACK-004 separation
 * This function does NOT itself enforce "no piece may be placed or moved on
 * top of a Marshal" --- that exclusion lives in `isLandingProhibited`, which
 * the movement handlers consult before a destination is emitted.  A
 * Marshal-topped target therefore never reaches this function on the default
 * (rule-legal) path; it can only be produced with
 * `skipStackingProhibitions` (attack/threat evaluation), where the
 * 'capture' outcome expresses "this square is reachable for capture".
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
 * BR-STACK-003 / BR-STACK-004 landing prohibitions.
 *
 * Returns `true` when landing on `targetStack` is prohibited by the stacking
 * rules (independent of the BR-MOVE-005 size comparison, which is checked by
 * `canLandOnStack`):
 * - BR-STACK-004: the target's top piece is a Marshal (friendly or enemy) ---
 *   no piece may ever be placed or moved on top of a Marshal, and the
 *   Marshal is never actually captured.
 * - BR-STACK-003: the target is a friendly stack of size 3 --- the stack
 *   size limit of 3 cannot be exceeded.
 *
 * With `opts.skipStackingProhibitions` (attack evaluation only) both
 * exclusions are skipped: reachability disregards landing restrictions.
 */
function isLandingProhibited(
  targetStack: Stack | null,
  player: Player,
  opts?: GetLegalDestinationsOptions,
): boolean {
  if (targetStack === null) return false;
  if (opts?.skipStackingProhibitions) return false;
  const top = topPiece(targetStack);
  if (top.type === 'M') return true; // BR-STACK-004
  if (top.owner === player && getStackSize(targetStack) === 3) return true; // BR-STACK-003
  return false;
}

/**
 * Convert a player-relative CoordDelta into an absolute board Square.
 * For White: positive row = forward (row-1), positive col = left (col+1).
 * For Black: negate both components.
 *
 * Returns `null` if the computed square lies outside the board --- callers
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
/*     Size 1 only --- exactly 1 square per allowed direction.          */
/* ------------------------------------------------------------------ */

function computeStepMovement(
  position: Position,
  square: Square,
  player: Player,
  directions: Direction[],
  opts?: GetLegalDestinationsOptions,
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
    if (isLandingProhibited(targetStack, player, opts)) continue;
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
 * (BR-PATH-001): the obstruction square itself may be a destination
 * (subject to BR-MOVE-005 and the BR-STACK-003/004 landing
 * prohibitions), but the path can never extend beyond it.
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
  opts?: GetLegalDestinationsOptions,
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
      if (!next) break; // off board --- stop tracing this direction

      const targetStack = getStack(position, next);

      if (targetStack !== null) {
        // BR-PATH-001: obstruction --- may land on it, but cannot go beyond.
        // Landing is allowed only if BR-MOVE-005 AND the BR-STACK-003/004
        // prohibitions both pass; the trace breaks regardless of landability
        // (excluded squares are never pass-through).
        if (
          canLandOnStack(sourceSize, targetStack) &&
          !isLandingProhibited(targetStack, player, opts)
        ) {
          results.push({
            dest: next,
            moveClass,
            outcome: determineOutcome(targetStack, player),
          });
        }
        break; // stop tracing past obstruction
      }

      // Empty square --- always a valid landing (BR-MOVE-005 is trivially
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
 * @throws if `base.over` is empty --- a jump pattern with no intervening
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
  opts?: GetLegalDestinationsOptions,
): LegalMove[] {
  const results: LegalMove[] = [];

  for (const base of baseJumps) {
    const patterns = getScaledJumps(base, sourceSize);
    for (const pattern of patterns) {
      // `applyCoordDelta` returns null for off-board destinations --- skip.
      const destSquare = applyCoordDelta(square, pattern.dest, player);
      if (!destSquare) continue;

      // BR-PATH-002: check all jumped-over squares.
      // An off-board over-square means the jump pattern itself is
      // geometrically impossible from this origin --- block.
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
      if (isLandingProhibited(targetStack, player, opts)) continue;

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
 *
 * The destination set applies the BR-STACK-003 (no landing on friendly
 * size-3 stacks) and BR-STACK-004 (no landing on Marshal-topped stacks)
 * exclusions by default.  Pass `opts.skipStackingProhibitions` to compute
 * plain reachability instead (attack/threat evaluation only) --- the
 * landing exclusions are then skipped, while path tracing, obstruction
 * semantics (BR-PATH-001/002) and the BR-MOVE-005 size comparison remain
 * unchanged.
 *
 * Destinations are deduplicated per square: the first LegalMove produced
 * for a given (col, row) wins (e.g. a size-3 Cannon's extended step trace
 * and its jump can overlap on the same square).
 */
export function getLegalDestinations(
  position: Position,
  square: Square,
  player: Player,
  opts?: GetLegalDestinationsOptions,
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
    results.push(...computeStepMovement(position, square, player, def.step, opts));
  } else {
    // Sizes 2-3: step becomes limited-range per BR-MOVEMENT-005
    results.push(...computeTraceMovement(position, square, player, def.step, sSize, 'step', opts));
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
        opts,
      ),
    );
  }

  // 3. Range movement (BR-MOVEMENT-003) --- unaffected by stack size
  if (def.range.length > 0) {
    results.push(...computeTraceMovement(position, square, player, def.range, 9, 'range', opts));
  }

  // 4. Jump movement (BR-MOVEMENT-004)
  if (def.jumps.length > 0) {
    results.push(...computeJumpMovement(position, square, player, def.jumps, sSize, opts));
  }

  // Deduplicate destinations: keep the first LegalMove per (col, row).
  // At size 3 a Cannon's extended step trace and its jump can land on the
  // same square, which would otherwise emit duplicate entries that
  // propagate into engine.legalActions.
  const seen = new Set<string>();
  const deduped: LegalMove[] = [];
  for (const move of results) {
    const key = `${move.dest.col},${move.dest.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(move);
  }

  return deduped;
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
