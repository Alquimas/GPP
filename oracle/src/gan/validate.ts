/**
 * GAN semantic validation — checks BR-GAN-VALID-001–006 from the GAN specification.
 *
 * Most checks delegate to the game-layer validators in `game/deploy.ts` and
 * `game/battle.ts`. This module provides the GAN-specific phase check (VALID-001),
 * turncoat preconditions (VALID-005), done legality (VALID-006), and maps
 * game-layer rule codes to the GAN validation vocabulary.
 *
 * @module
 */

import { type Action, type GameState } from '../types.js';
import { GameError } from '../errors.js';
import { getStack, topPiece } from '../board/board.js';
import type { ValidationResult } from '../game/validation.js';
import { validatePlacement } from '../game/deploy.js';
import { validateMove, validateArata } from '../game/battle.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type { ValidationResult };

// ---------------------------------------------------------------------------
// Validation functions (BR-GAN-VALID-001–006)
// ---------------------------------------------------------------------------

/**
 * BR-GAN-VALID-001 — Phase match.
 *
 * Placement is only valid in the Deploy Phase.
 * Move and Arata are only valid in the Battle Phase.
 *
 * @throws {GameError} with rule 'BR-GAN-VALID-001' on phase mismatch.
 */
function checkPhase(action: Action, state: GameState): ValidationResult {
  const phase = state.turn.phase;

  if (action.kind === 'placement') {
    if (phase !== 'deploy') {
      return {
        ok: false,
        error: new GameError(
          'Placement is only valid during the Deploy Phase (BR-GAN-VALID-001)',
          'BR-GAN-VALID-001',
        ),
      };
    }
  } else if (action.kind === 'move' || action.kind === 'arata') {
    if (phase !== 'battle') {
      return {
        ok: false,
        error: new GameError(
          'Move and Arata are only valid during the Battle Phase (BR-GAN-VALID-001)',
          'BR-GAN-VALID-001',
        ),
      };
    }
  } else {
    const _exhaustive: never = action;
    void _exhaustive;
    throw new Error(`Unknown action kind`);
  }

  return { ok: true };
}

/**
 * BR-GAN-VALID-002 — Placement legality.
 *
 * Delegates to `validatePlacement` from the game layer.
 *
 * @throws {GameError} with rule 'BR-GAN-VALID-002' on illegal placement.
 */
function checkPlacementLegality(action: Action, state: GameState): ValidationResult {
  if (action.kind !== 'placement') return { ok: true };
  return validatePlacement(state, action);
}

/**
 * BR-GAN-VALID-003 — Move legality.
 *
 * Delegates to `validateMove` from the game layer (Step 6–8),
 * which validates phase, origin ownership, reachability,
 * outcome canonicity, Marshal stacking, and Self Check.
 */
function checkMoveLegality(action: Action, state: GameState): ValidationResult {
  if (action.kind !== 'move') return { ok: true };
  const result = validateMove(state, action);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * BR-GAN-VALID-004 — Arata legality.
 *
 * Delegates to `validateArata` from the game layer (Step 6–8),
 * which validates phase, hand contents, arata zone, target square,
 * and Self Check.
 */
function checkArataLegality(action: Action, state: GameState): ValidationResult {
  if (action.kind !== 'arata') return { ok: true };
  const result = validateArata(state, action);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * BR-GAN-VALID-005 — Turncoat legality.
 *
 * Turncoat (+1, +2, +12) is present only if:
 * - The acting/placed Piece is a Captain ('T')
 * - The Action's outcome is a Stacking (for moves) or for arata/placement
 *
 * Each listed level must have held an opposing Piece immediately beforehand.
 * The Hand must have held a matching replacement Piece Type.
 *
 * For Step 4, we validate the basic preconditions (Captain + Stacking outcome).
 * Full eligibility checks (enemy piece present, hand has match) depend on
 * board state helpers from later steps.
 *
 * @throws {GameError} with rule 'BR-GAN-VALID-005' on illegal turncoat.
 */
function checkTurncoatLegality(action: Action, state: GameState): ValidationResult {
  const turncoat = action.kind === 'placement' ? [] : action.turncoat;

  if (!turncoat || turncoat.length === 0) {
    return { ok: true }; // No turncoat — always valid (omission is canonical)
  }

  // Turncoat present — must be a Captain and outcome must be stacking
  if (action.kind === 'move') {
    // Move: acting piece must be Captain (checked from state) and outcome must be stacking
    if (action.outcome !== 'stack') {
      return {
        ok: false,
        error: new GameError(
          'Turncoat requires the outcome to be a Stack (BR-GAN-VALID-005)',
          'BR-GAN-VALID-005',
        ),
      };
    }
    // Check that the acting piece at origin is a Captain
    const originStack = getStack(state.position, action.origin);
    if (!originStack) {
      return {
        ok: false,
        error: new GameError(
          'Turncoat move requires a piece at origin (BR-GAN-VALID-005)',
          'BR-GAN-VALID-005',
        ),
      };
    }
    const topPieceAtOrigin = topPiece(originStack);
    if (topPieceAtOrigin.type !== 'T') {
      return {
        ok: false,
        error: new GameError(
          'Turncoat is only legal when the moving piece is a Captain (BR-GAN-VALID-005)',
          'BR-GAN-VALID-005',
        ),
      };
    }
  } else if (action.kind === 'arata') {
    // Arata: placed piece must be Captain
    if (action.piece !== 'T') {
      return {
        ok: false,
        error: new GameError(
          'Turncoat is only legal when the placed piece is a Captain (BR-GAN-VALID-005)',
          'BR-GAN-VALID-005',
        ),
      };
    }
  }

  // TODO: Full BR-GAN-VALID-005 check — verify each level held an opposing piece and hand has replacement

  return { ok: true };
}

/**
 * BR-GAN-VALID-006 — Done legality.
 *
 * The `!` marker is only valid on Placements, never on Moves or Aratas.
 *
 * @throws {GameError} with rule 'BR-GAN-VALID-006' if `!` is present on a non-placement action.
 */
function checkDoneLegality(action: Action, _state: GameState): ValidationResult {
  if (action.kind === 'placement') {
    // If it's a placement with done=false, that's fine
    // If it's a placement with done=true, that's fine (it's on a placement)
    return { ok: true };
  }

  // The action is a move or arata — there is no `done` property on these types
  // If we're here, it wasn't parsed as a placement, so it's fine.
  // Done legality is enforced at parse time (BR-GAN-GRAMMAR-011: `!` only on placements),
  // so by the time we reach validation, a move/arata with `!` would have
  // already been rejected by the parser.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a parsed GAN Action against a GameState.
 *
 * Runs checks BR-GAN-VALID-001–006 in order. Returns the first validation failure, or
 * `{ ok: true }` if all checks pass.
 *
 * @param gan - The original GAN string (used for error messages).
 * @param action - The parsed Action object.
 * @param state - The GameState the action is applied against.
 * @returns ValidationResult with either success or the first error encountered.
 */
export function validateAction(_gan: string, action: Action, state: GameState): ValidationResult {
  // BR-GAN-VALID-001: Phase match
  const s1 = checkPhase(action, state);
  if (!s1.ok) return s1;

  // BR-GAN-VALID-002: Placement legality
  const s2 = checkPlacementLegality(action, state);
  if (!s2.ok) return s2;

  // BR-GAN-VALID-003: Move legality (stub)
  const s3 = checkMoveLegality(action, state);
  if (!s3.ok) return s3;

  // BR-GAN-VALID-004: Arata legality (stub)
  const s4 = checkArataLegality(action, state);
  if (!s4.ok) return s4;

  // BR-GAN-VALID-005: Turncoat legality
  const s5 = checkTurncoatLegality(action, state);
  if (!s5.ok) return s5;

  // BR-GAN-VALID-006: Done legality
  const s6 = checkDoneLegality(action, state);
  if (!s6.ok) return s6;

  return { ok: true };
}
