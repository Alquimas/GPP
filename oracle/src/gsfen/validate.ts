/**
 * GSFEN semantic validator — checks that a parsed GameState satisfies the
 * semantic validity rules BR-GSFEN-VALID-001–007 from GSFEN.md.
 *
 * @module
 */

import { type GameState, type Player } from '../types.js';
import { GameError } from '../errors.js';
import { INITIAL_COUNTS, ALL_PIECE_TYPES } from '../constants.js';
import {
  countBoardPieces,
  countPieceOnBoard,
  findPieceOnBoard,
  hasAnyBoardPieces,
} from '../board/board.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ValidationResult = { ok: true } | { ok: false; error: GameError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Board query helpers (countBoardPieces, hasAnyBoardPieces, countPieceOnBoard,
// findPieceOnBoard) are now imported from ../board/board.js.

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a parsed GameState against the semantic validity rules (BR-GSFEN-VALID-001–007).
 *
 * Note: BR-GSFEN-VALID-001 (grammar and canonicalization) is handled by the parser — this
 * validator assumes a well-formed parse.  BR-GSFEN-VALID-008 (empty hands marker) is a
 * parse-level concern.
 *
 * @param state - The GameState to validate.
 * @throws {GameError} with rule:
 *   - 'BR-GSFEN-VALID-002' if stack size not 1-3
 *   - 'BR-GSFEN-VALID-003' if Marshal integrity violated
 *   - 'BR-GSFEN-VALID-004' if inventory conservation violated
 *   - 'BR-GSFEN-VALID-005' if Done flags inconsistent
 *   - 'BR-GSFEN-VALID-006' if deploy-phase constraints violated
 *   - 'BR-GSFEN-VALID-007' if counter bounds violated
 */
export function validateState(state: GameState): ValidationResult {
  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-002 — Stack size (BR-STACK-001)
  // -----------------------------------------------------------------------
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = state.position[r][c];
      if (stack !== null) {
        if (stack.length < 1 || stack.length > 3) {
          return {
            ok: false,
          error: new GameError(
            `Stack at row ${r + 1}, col ${c + 1} has ${stack.length} pieces (must be 1-3) (BR-GSFEN-VALID-002 — BR-STACK-001)`,
            'BR-GSFEN-VALID-002',
          ),
          };
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-003 — Marshal integrity (BR-STACK-004, BR-DEPLOY-003, BR-DEPLOY-011)
  // -----------------------------------------------------------------------
  const isBattle = state.turn.phase === 'battle';

  for (const player of ['white', 'black'] as Player[]) {
    const boardMCount = countPieceOnBoard(state.position, 'M', player);
    const handMCount = state.hands[player].M;

    // Every Marshal on board must be at the top (last index) of its stack
    const mPositions = findPieceOnBoard(state.position, 'M', player);
    for (const pos of mPositions) {
      const stack = state.position[pos.row][pos.col]!;
      if (pos.stackIndex !== stack.length - 1) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} Marshal at row ${pos.row + 1}, col ${pos.col + 1} is not at top of its stack (BR-GSFEN-VALID-003) — Marshal must be the last (top) letter in its stack group (BR-STACK-004)`,
          'BR-GSFEN-VALID-003',
        ),
        };
      }
    }

    if (isBattle) {
      // Battle phase: Marshal appears exactly once on board, never in Hand
      if (boardMCount !== 1) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} Marshal appears ${boardMCount} time(s) on board in battle phase (expected 1) (BR-GSFEN-VALID-003 — BR-DEPLOY-003)`,
          'BR-GSFEN-VALID-003',
        ),
        };
      }
      if (handMCount !== 0) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} Marshal is in hand during battle phase (BR-GSFEN-VALID-003) — Marshal must be on board in battle (BR-DEPLOY-011)`,
          'BR-GSFEN-VALID-003',
        ),
        };
      }
    } else {
      // Deploy phase: Marshal either on board (as top of stack) OR in hand.
      // If in hand, that player has no pieces on board at all.
      if (boardMCount > 0 && handMCount > 0) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} Marshal is both on board and in hand during deploy phase (BR-GSFEN-VALID-003) — Marshal must be in one place (BR-DEPLOY-003)`,
          'BR-GSFEN-VALID-003',
        ),
        };
      }
      if (handMCount > 0 && hasAnyBoardPieces(state.position, player)) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} Marshal is in hand but player has pieces on board (BR-GSFEN-VALID-003) — Marshal must be placed first (BR-DEPLOY-003)`,
          'BR-GSFEN-VALID-003',
        ),
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-004 — Inventory conservation
  // -----------------------------------------------------------------------
  for (const player of ['white', 'black'] as Player[]) {
    const boardCounts = countBoardPieces(state.position, player);
    const hand = state.hands[player];

    for (const type of ALL_PIECE_TYPES) {
      const total = boardCounts[type] + hand[type];
      const initial = INITIAL_COUNTS[type];
      if (total > initial) {
        return {
          ok: false,
        error: new GameError(
          `${player === 'white' ? 'White' : 'Black'} ${type} count (board: ${boardCounts[type]}, hand: ${hand[type]}) = ${total} exceeds initial count ${initial} (BR-GSFEN-VALID-004 — total on board + in hand must not exceed initial count)`,
          'BR-GSFEN-VALID-004',
        ),
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-005 — Done flags consistency
  // -----------------------------------------------------------------------
  const { done, activePlayer, phase } = state.turn;

  if (done !== null) {
    // At most one Done flag (enforced by type — can't have both)
    // Placing player never carries the flag
    if (done === activePlayer) {
      return {
        ok: false,
        error: new GameError(`Done flag set on the placing player (${activePlayer}) (BR-GSFEN-VALID-005) — the placing player never carries the done flag (BR-DEPLOY-007)`, 'BR-GSFEN-VALID-005'),
      };
    }

    // A Done player has at least their Marshal on the board
    const doneBoardMCount = countPieceOnBoard(state.position, 'M', done);
    if (doneBoardMCount < 1) {
      return {
        ok: false,
        error: new GameError(
          `${done === 'white' ? 'White' : 'Black'} has declared Done but does not have a Marshal on the board (BR-GSFEN-VALID-005) — Done requires Marshal placed (BR-DEPLOY-007)`,
          'BR-GSFEN-VALID-005',
        ),
      };
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-006 — Deploy-phase constraints (BR-DEPLOY-004, BR-DEPLOY-005)
  // -----------------------------------------------------------------------
  if (phase === 'deploy') {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stack = state.position[r][c];
        if (stack !== null) {
          // BR-DEPLOY-005: every stack is single-owner
          const firstOwner = stack[0].owner;
          for (const piece of stack) {
            if (piece.owner !== firstOwner) {
              return {
                ok: false,
              error: new GameError(
                `Mixed-ownership stack at row ${r + 1}, col ${c + 1} during deploy phase (BR-GSFEN-VALID-006) — all pieces in a stack must belong to the same owner (BR-DEPLOY-005)`,
                'BR-GSFEN-VALID-006',
              ),
              };
            }
          }

          // BR-DEPLOY-004: White pieces only on Rows 7-9, Black only on Rows 1-3
          if (firstOwner === 'white') {
            if (r < 6) {
              // Row index 0-5 are rows 1-6 (non-white zone)
              return {
                ok: false,
              error: new GameError(
                `White piece at row ${r + 1} during deploy phase (only rows 7-9 allowed) (BR-GSFEN-VALID-006 — BR-DEPLOY-004)`,
                'BR-GSFEN-VALID-006',
              ),
              };
            }
          } else {
            // Black owner
            if (r > 2) {
              // Row index 3-8 are rows 4-9 (non-black zone)
              return {
                ok: false,
              error: new GameError(
                `Black piece at row ${r + 1} during deploy phase (only rows 1-3 allowed) (BR-GSFEN-VALID-006 — BR-DEPLOY-004)`,
                'BR-GSFEN-VALID-006',
              ),
              };
            }
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-007 — Counter bounds
  // -----------------------------------------------------------------------
  if (state.turn.counter < 1) {
    return {
      ok: false,
      error: new GameError(`Counter ${state.turn.counter} must be >= 1 (BR-GSFEN-VALID-007)`, 'BR-GSFEN-VALID-007'),
    };
  }

  if (phase === 'deploy' && state.turn.counter > 50) {
    return {
      ok: false,
        error: new GameError(
          `Counter ${state.turn.counter} exceeds maximum 50 for deploy phase (BR-GSFEN-VALID-007 — at most 50 placements, BR-DEPLOY-002)`,
          'BR-GSFEN-VALID-007',
        ),
    };
  }

  return { ok: true };
}
