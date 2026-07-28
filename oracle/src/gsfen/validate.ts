/**
 * GSFEN semantic validator — checks that a parsed GameState satisfies the
 * semantic validity rules BR-GSFEN-VALID-001–005 from GSFEN.md.
 *
 * Semantic validity rules (GSFEN.md §Semantic Validity):
 *   - BR-GSFEN-VALID-001 — Marshal integrity (5 sub-codes)
 *   - BR-GSFEN-VALID-002 — Inventory conservation
 *   - BR-GSFEN-VALID-003 — Done flags
 *   - BR-GSFEN-VALID-004 — Deploy-phase constraints
 *   - BR-GSFEN-VALID-005 — Counter bounds
 *
 * All rules assume the string has already satisfied the grammar and
 * canonical-form rules (enforced by the parser).
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
import type { ValidationResult } from '../game/validation.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type { ValidationResult };

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a parsed GameState against the semantic validity rules (BR-GSFEN-VALID-001–005).
 *
 * Assumes the input has already passed the parser's canonical-form checks.
 * The parser enforces grammar and canonicity; this validator enforces only
 * what the parser cannot guarantee.
 *
 * @param state - The GameState to validate.
 * @throws {GameError} with rule:
 *   - 'BR-GSFEN-VALID-001-TOP'   — Marshal not at top of its stack (BR-STACK-004)
 *   - 'BR-GSFEN-VALID-001-COUNT' — Battle: Marshal appears ≠ 1 on board (BR-DEPLOY-003)
 *   - 'BR-GSFEN-VALID-001-HAND'  — Battle: Marshal in Hand (BR-DEPLOY-011)
 *   - 'BR-GSFEN-VALID-001-BOTH'  — Deploy: Marshal on board AND in Hand (BR-DEPLOY-003)
 *   - 'BR-GSFEN-VALID-001-FIRST' — Deploy: Marshal in Hand but player has pieces on board (BR-DEPLOY-003)
 *   - 'BR-GSFEN-VALID-002'       — Inventory conservation violated (BR-CAPTURE-004)
 *   - 'BR-GSFEN-VALID-003'       — Done flags inconsistent (BR-DEPLOY-007)
 *   - 'BR-GSFEN-VALID-004'       — Deploy-phase constraints violated (BR-DEPLOY-004, BR-DEPLOY-005)
 *   - 'BR-GSFEN-VALID-005'       — Counter bounds violated (BR-DEPLOY-002)
 */
export function validateState(state: GameState): ValidationResult {
  const isBattle = state.turn.phase === 'battle';

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-001 — Marshal integrity (BR-STACK-004, BR-DEPLOY-003, BR-DEPLOY-011)
  //
  // Five sub-codes let consumers branch on the specific violation:
  //   -TOP   — Marshal not at top of its stack group (BR-STACK-004)
  //   -COUNT — Battle phase: Marshal appears ≠ 1 time on board (BR-DEPLOY-003)
  //   -HAND  — Battle phase: Marshal in Hand (BR-DEPLOY-011)
  //   -BOTH  — Deploy phase: Marshal simultaneously on board and in Hand (BR-DEPLOY-003)
  //   -FIRST — Deploy phase: Marshal in Hand but player has pieces on board (BR-DEPLOY-003)
  // -----------------------------------------------------------------------
  for (const player of ['white', 'black'] as Player[]) {
    const boardMCount = countPieceOnBoard(state.position, 'M', player);
    const handMCount = state.hands[player].M;

    // BR-GSFEN-VALID-001-TOP: Every Marshal on board must be at the top (last index) of its stack
    const mPositions = findPieceOnBoard(state.position, 'M', player);
    for (const pos of mPositions) {
      const stack = state.position[pos.row][pos.col]!;
      if (pos.stackIndex !== stack.length - 1) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} Marshal at row ${pos.row + 1}, col ${pos.col + 1} is not at top of its stack (BR-GSFEN-VALID-001-TOP) — Marshal must be the last (top) letter in its stack group (BR-STACK-004)`,
            'BR-GSFEN-VALID-001-TOP',
          ),
        };
      }
    }

    if (isBattle) {
      // BR-GSFEN-VALID-001-COUNT: Battle phase — Marshal appears exactly once on board
      if (boardMCount !== 1) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} Marshal appears ${boardMCount} time(s) on board in battle phase (expected 1) (BR-GSFEN-VALID-001-COUNT — BR-DEPLOY-003)`,
            'BR-GSFEN-VALID-001-COUNT',
          ),
        };
      }
      // BR-GSFEN-VALID-001-HAND: Battle phase — Marshal never in Hand
      if (handMCount !== 0) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} Marshal is in hand during battle phase (BR-GSFEN-VALID-001-HAND) — Marshal must be on board in battle (BR-DEPLOY-011)`,
            'BR-GSFEN-VALID-001-HAND',
          ),
        };
      }
    } else {
      // Deploy phase checks
      // BR-GSFEN-VALID-001-BOTH: Marshal not simultaneously on board and in Hand
      if (boardMCount > 0 && handMCount > 0) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} Marshal is both on board and in hand during deploy phase (BR-GSFEN-VALID-001-BOTH) — Marshal must be in one place (BR-DEPLOY-003)`,
            'BR-GSFEN-VALID-001-BOTH',
          ),
        };
      }
      // BR-GSFEN-VALID-001-FIRST: If Marshal in Hand, player has no pieces on board
      if (handMCount > 0 && hasAnyBoardPieces(state.position, player)) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} Marshal is in hand but player has pieces on board (BR-GSFEN-VALID-001-FIRST) — Marshal must be placed first (BR-DEPLOY-003)`,
            'BR-GSFEN-VALID-001-FIRST',
          ),
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-002 — Inventory conservation (BR-CAPTURE-004)
  //
  // For each player and each Piece Type:
  //   - Any phase:    board[type] + hand[type] ≤ initial[type]
  //   - Deploy phase: board[type] + hand[type] = initial[type]
  //     (pieces only move from Hand to board during deploy; no captures yet)
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
            `${player === 'white' ? 'White' : 'Black'} ${type} count (board: ${boardCounts[type]}, hand: ${hand[type]}) = ${total} exceeds initial count ${initial} (BR-GSFEN-VALID-002 — total on board + in hand must not exceed initial count)`,
            'BR-GSFEN-VALID-002',
          ),
        };
      }

      // Deploy-phase strict equality: no captures during deploy
      if (!isBattle && total < initial) {
        return {
          ok: false,
          error: new GameError(
            `${player === 'white' ? 'White' : 'Black'} ${type} count (board: ${boardCounts[type]}, hand: ${hand[type]}) = ${total} is less than initial count ${initial} during deploy phase (BR-GSFEN-VALID-002 — deploy requires strict equality, no captures yet)`,
            'BR-GSFEN-VALID-002',
          ),
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-003 — Done flags consistency (BR-DEPLOY-007)
  //
  // At most one player has a Done flag (enforced by the Turn token grammar).
  // The placing player never carries the flag.
  // A Done player has at least their Marshal on the board (Done is declared
  // after a placement, BR-DEPLOY-007).
  // -----------------------------------------------------------------------
  const { done, activePlayer, phase } = state.turn;

  if (done !== null) {
    // Placing player never carries the flag
    if (done === activePlayer) {
      return {
        ok: false,
        error: new GameError(
          `Done flag set on the placing player (${activePlayer}) (BR-GSFEN-VALID-003) — the placing player never carries the done flag (BR-DEPLOY-007)`,
          'BR-GSFEN-VALID-003',
        ),
      };
    }

    // A Done player has at least their Marshal on the board
    const doneBoardMCount = countPieceOnBoard(state.position, 'M', done);
    if (doneBoardMCount < 1) {
      return {
        ok: false,
        error: new GameError(
          `${done === 'white' ? 'White' : 'Black'} has declared Done but does not have a Marshal on the board (BR-GSFEN-VALID-003) — Done requires Marshal placed (BR-DEPLOY-007)`,
          'BR-GSFEN-VALID-003',
        ),
      };
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-004 — Deploy-phase constraints (BR-DEPLOY-004, BR-DEPLOY-005)
  //
  // In deploy states (dw/db/dwB/dbW):
  //   - White's pieces appear only on Rows 7–9 (BR-DEPLOY-004)
  //   - Black's pieces appear only on Rows 1–3 (BR-DEPLOY-004)
  //   - Every stack is single-owner (BR-DEPLOY-005)
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
                  `Mixed-ownership stack at row ${r + 1}, col ${c + 1} during deploy phase (BR-GSFEN-VALID-004) — all pieces in a stack must belong to the same owner (BR-DEPLOY-005)`,
                  'BR-GSFEN-VALID-004',
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
                  `White piece at row ${r + 1} during deploy phase (only rows 7-9 allowed) (BR-GSFEN-VALID-004 — BR-DEPLOY-004)`,
                  'BR-GSFEN-VALID-004',
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
                  `Black piece at row ${r + 1} during deploy phase (only rows 1-3 allowed) (BR-GSFEN-VALID-004 — BR-DEPLOY-004)`,
                  'BR-GSFEN-VALID-004',
                ),
              };
            }
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // BR-GSFEN-VALID-005 — Counter bounds (BR-DEPLOY-002)
  //
  // In Deploy Phase, the counter must not exceed 50 (at most 25 placements
  // per player, BR-DEPLOY-002). In Battle Phase there is no upper bound.
  // The ≥ 1 guarantee is enforced by the parser (BR-GSFEN-CANON-COUNTER-POSITIVE).
  // -----------------------------------------------------------------------
  if (phase === 'deploy' && state.turn.counter > 50) {
    return {
      ok: false,
      error: new GameError(
        `Counter ${state.turn.counter} exceeds maximum 50 for deploy phase (BR-GSFEN-VALID-005 — at most 50 placements, BR-DEPLOY-002)`,
        'BR-GSFEN-VALID-005',
      ),
    };
  }

  return { ok: true };
}
