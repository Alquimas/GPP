/**
 * Attack & Check detection --- determines if a square is under threat and if
 * a Marshal is in check or exposed.
 *
 * Pure domain logic with no I/O.  Every function treats Position as immutable.
 *
 * @module
 */

import type { Player, Position, Square } from '../types.js';
import { getLegalDestinations } from './movement.js';
import { findPieceOnBoard, getStack, squareFromIndex, topPiece, stackSize } from './board.js';

/* ------------------------------------------------------------------ */
/*  isSquareUnderAttack                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns `true` if any piece belonging to `byPlayer` can reach
 * `targetSquare` considering movement rules and board boundaries.
 *
 * Per the BR-Attack definition:
 * - The restriction on landing on a Marshal's Square is disregarded for
 *   threat evaluation (Checkmate ends the Game before Capture resolves).
 * - The stack-size landing restriction (BR-MOVE-005) still applies: a
 *   piece cannot attack a square whose stack size exceeds its own source
 *   stack size.
 *
 * Because `getLegalDestinations()` already permits landing on an enemy
 * Marshal (outcome = 'capture') and enforces BR-MOVE-005 via
 * `canLandOnStack`, the standard movement computation directly yields
 * the correct attack set --- no separate attack-specific path is needed.
 *
 * Since the movement engine now excludes BR-STACK-003/004 landing
 * prohibitions (friendly size-3 stacks and Marshal-topped targets) from
 * its default destination set, attack evaluation passes
 * `skipStackingProhibitions` so that reachability --- which is what
 * attack means --- disregards landing restrictions exactly as before.
 * Path tracing (BR-PATH-001/002) and BR-MOVE-005 remain fully applied.
 *
 * @param position       Current board position.
 * @param targetSquare   The square being tested for attack.
 * @param byPlayer       The player whose pieces are the potential attackers.
 * @param sourceStackSize Optional: if provided, only pieces with exactly
 *                        this stack size (1, 2, or 3) are considered.
 */
export function isSquareUnderAttack(
  position: Position,
  targetSquare: Square,
  byPlayer: Player,
  sourceStackSize?: 1 | 2 | 3,
): boolean {
  const tc = targetSquare.col;
  const tr = targetSquare.row;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = position[r][c];
      if (stack === null) continue;

      // BR-Attack: only pieces belonging to the attacking player
      if (topPiece(stack).owner !== byPlayer) continue;

      // Optional filter: only pieces of a specific stack size
      if (sourceStackSize !== undefined && stackSize(stack) !== sourceStackSize) continue;

      // Convert 0-indexed position to 1-indexed Square
      const sourceSquare = squareFromIndex(r, c);

      // getLegalDestinations applies BR-MOVE-005 (stack size landing
      // restriction) and allows landing on enemy Marshals (outcome =
      // 'capture'), so no special attack-path is needed.  The
      // skipStackingProhibitions flag keeps BR-STACK-003/004 exclusions
      // out of threat evaluation: friendly occupation and Marshal tops do
      // not stop a square from being attacked.
      const moves = getLegalDestinations(position, sourceSquare, byPlayer, {
        skipStackingProhibitions: true,
      });

      for (const move of moves) {
        if (move.dest.col === tc && move.dest.row === tr) {
          return true;
        }
      }
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  isInCheck                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns `true` if the player's Marshal square is under attack by the
 * opponent (BR-Attack / Check definition).
 *
 * If the Marshal is not on the board (e.g. still in the player's hand
 * during the Deploy Phase) the function returns `false`.
 *
 * @param position  Current board position.
 * @param player    The player whose Marshal is being checked.
 */
/**
 * Whether `player`'s Marshal is under attack.
 *
 * PRECONDITION: the position must pass `validateState` (in particular the
 * BR-STACK-004 invariant that the Marshal is the topmost piece of its
 * stack). Callers that feed unvalidated positions (e.g. tooling parsing
 * GSFEN directly) will get a thrown Error on a buried Marshal instead of
 * a silent `false`.
 */
export function isInCheck(position: Position, player: Player): boolean {
  // BR-STACK-004 guarantees the Marshal is always the topmost piece of its
  // stack (no piece may ever be placed or moved on top of a Marshal), so a
  // buried Marshal cannot arise in a rule-legal game.  Attack evaluation
  // (`isSquareUnderAttack`) only inspects the top of each stack, so a
  // buried Marshal would silently under-report checks.  Fail loudly on
  // such a position instead of pretending to search all levels.
  const locations = findPieceOnBoard(position, 'M', player);
  if (locations.length === 0) return false;

  const opponent: Player = player === 'white' ? 'black' : 'white';

  // There should be exactly one Marshal, but loop to stay robust against
  // malformed positions; each located Marshal must be its stack's top.
  for (const loc of locations) {
    // squareFromIndex is safe here: loc.col/loc.row are 0-indexed from findPieceOnBoard.
    const marshalStack = getStack(position, squareFromIndex(loc.row, loc.col));
    if (marshalStack === null || loc.stackIndex !== marshalStack.length - 1) {
      throw new Error(
        `BR-STACK-004 violated: ${player} Marshal at (${loc.col + 1}, ${loc.row + 1}) is not the topmost piece of its stack (index ${loc.stackIndex} of ${marshalStack?.length ?? 0}); check evaluation cannot proceed`,
      );
    }
    const marshalSquare = squareFromIndex(loc.row, loc.col);
    if (isSquareUnderAttack(position, marshalSquare, opponent)) {
      return true;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  isExposed                                                          */
/* ------------------------------------------------------------------ */

/**
 * Exposure evaluation (BR-DEPLOY-012): checks if each player's Marshal is
 * under attack at the Deploy->Battle boundary.
 *
 * Returns a pair of booleans indicating whether each Marshal is exposed
 * (under attack).  Unlike Check, there is no escape attempt --- exposure
 * immediately ends the game.
 *
 * @param position  Current board position.
 */
export function isExposed(position: Position): { white: boolean; black: boolean } {
  return {
    white: isInCheck(position, 'white'),
    black: isInCheck(position, 'black'),
  };
}
