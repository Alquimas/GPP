/**
 * Attack & Check detection — determines if a square is under threat and if
 * a Marshal is in check or exposed.
 *
 * Pure domain logic with no I/O.  Every function treats Position as immutable.
 *
 * @module
 */

import type { Player, Position, Square } from '../types.js';
import { getLegalDestinations } from './movement.js';
import { findPieceOnBoard, topPiece, stackSize } from './board.js';

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
 * the correct attack set — no separate attack-specific path is needed.
 *
 * @param position       Current board position.
 * @param targetSquare   The square being tested for attack.
 * @param byPlayer       The player whose pieces are the potential attackers.
 * @param sourceStackSize Optional: if provided, only pieces with exactly
 *                        this stack size are considered.
 */
export function isSquareUnderAttack(
  position: Position,
  targetSquare: Square,
  byPlayer: Player,
  sourceStackSize?: number,
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
      const sourceSquare: Square = { col: c + 1, row: r + 1 };

      // getLegalDestinations already applies BR-MOVE-005 (stack size
      // landing restriction) and allows landing on enemy Marshals
      // (outcome = 'capture'), so no special attack-path is needed.
      const moves = getLegalDestinations(position, sourceSquare, byPlayer);

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
export function isInCheck(position: Position, player: Player): boolean {
  // BR-STACK-004 ensures the Marshal is always the topmost piece, but
  // we search all levels for robustness.
  const locations = findPieceOnBoard(position, 'M', player);
  if (locations.length === 0) return false;

  // Convert 0-indexed position indices to 1-indexed Square
  const marshalSquare: Square = {
    col: locations[0].col + 1,
    row: locations[0].row + 1,
  };

  const opponent: Player = player === 'white' ? 'black' : 'white';
  return isSquareUnderAttack(position, marshalSquare, opponent);
}

/* ------------------------------------------------------------------ */
/*  isExposed                                                          */
/* ------------------------------------------------------------------ */

/**
 * Exposure evaluation (BR-DEPLOY-012): checks if each player's Marshal is
 * under attack at the Deploy→Battle boundary.
 *
 * Returns a pair of booleans indicating whether each Marshal is exposed
 * (under attack).  Unlike Check, there is no escape attempt — exposure
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
