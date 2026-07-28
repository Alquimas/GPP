/**
 * Deploy-phase action validation (Step 8).
 *
 * Validates Placement actions against a Deploy Phase GameState.
 * Each rule check corresponds to a BR-xxx reference from BUSINESS_RULES.md.
 *
 * @module
 */

import type { Action, GameState, Player } from '../types.js';
import { GameError } from '../errors.js';
import { getStack, topPiece, stackSize } from '../board/board.js';
import type { ValidationResult } from './validation.js';

// Re-export ValidationResult so consumers can import from deploy.ts
export type { ValidationResult };

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Deploy zone rows per player (BR-DEPLOY-004). */
const DEPLOY_ZONE_ROWS: Record<Player, number[]> = {
  white: [7, 8, 9],
  black: [1, 2, 3],
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Check if a row is within a player's deploy zone. */
function isInDeployZone(row: number, player: Player): boolean {
  return DEPLOY_ZONE_ROWS[player].includes(row);
}

/* ------------------------------------------------------------------ */
/*  validatePlacement                                                  */
/* ------------------------------------------------------------------ */

/**
 * Validate a Placement action against the current GameState.
 *
 * Checks (in order):
 * 1. BR-DEPLOY-001: Must be in Deploy Phase
 * 2. BR-DEPLOY-002: Turn order (active player check — implicit)
 * 3. BR-DEPLOY-003: Marshal must be first placement per player
 * 4. BR-DEPLOY-004: Destination within deploy zone
 * 5. BR-DEPLOY-005/006: Target is empty or friendly-topped stack under size 3
 * 6. BR-STACK-004: No stacking on a Marshal-topped target
 * 7. BR-DEPLOY-007: Done declaration (syntactically valid if present)
 *
 * @param state - Current GameState.
 * @param action - The Placement action to validate.
 * @returns ValidationResult.
 */
export function validatePlacement(state: GameState, action: Action): ValidationResult {
  if (action.kind !== 'placement') {
    return {
      ok: false,
      error: new GameError('Action is not a placement', 'BR-DEPLOY-001'),
    };
  }
  const { piece, dest } = action;
  const player = state.turn.activePlayer;
  const hand = state.hands[player];

  // 1. BR-DEPLOY-001: Phase check
  if (state.turn.phase !== 'deploy') {
    return {
      ok: false,
      error: new GameError('Placement is only valid during the Deploy Phase', 'BR-DEPLOY-001'),
    };
  }

  // 2. Piece must be in hand
  if (hand[piece] < 1) {
    return {
      ok: false,
      error: new GameError(`Piece ${piece} is not in ${player}'s hand`, 'BR-DEPLOY-002'),
    };
  }

  // 3. BR-DEPLOY-003: Marshal must be first placement
  if (piece === 'M') {
    // Marshal placement is valid — but only if Marshal is still in hand
    // (which we already checked above). The "first placement" condition
    // is enforced below: if ANY of the player's non-Marshal pieces have
    // been placed (count on board > 0), then Marshal should already be placed.
  } else {
    // Non-Marshal piece: Marshal must already be placed
    // Marshal is in hand if count === 1 (initial value)
    // No Marshal in hand means it was already placed
    if (hand.M === 1) {
      return {
        ok: false,
        error: new GameError(`Must place Marshal before placing other pieces`, 'BR-DEPLOY-003'),
      };
    }
  }

  // 4. BR-DEPLOY-004: Deploy zone
  if (!isInDeployZone(dest.row, player)) {
    return {
      ok: false,
      error: new GameError(
        `Destination row ${dest.row} is outside ${player}'s deploy zone`,
        'BR-DEPLOY-004',
      ),
    };
  }

  // 5+6. Check destination square (BR-DEPLOY-005/006)
  const targetStack = getStack(state.position, dest);

  if (targetStack !== null) {
    const targetTop = topPiece(targetStack);

    // Enemy-topped square is illegal
    if (targetTop.owner !== player) {
      return {
        ok: false,
        error: new GameError(`Cannot place on an enemy-controlled square`, 'BR-DEPLOY-005'),
      };
    }

    // Cannot stack on a Marshal (BR-STACK-004)
    if (targetTop.type === 'M') {
      return {
        ok: false,
        error: new GameError('Cannot place a piece on top of a Marshal', 'BR-STACK-004'),
      };
    }

    // Stack size limit (BR-DEPLOY-005)
    if (stackSize(targetStack) >= 3) {
      return {
        ok: false,
        error: new GameError('Cannot place on a full stack (size 3)', 'BR-DEPLOY-005'),
      };
    }
  }

  // BR-DEPLOY-007: Done declaration is syntactically valid
  // (always OK — done=true is allowed on any valid placement)

  return { ok: true };
}
