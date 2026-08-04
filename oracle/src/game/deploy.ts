/**
 * Deploy-phase action validation (Step 8).
 *
 * Validates Placement actions against a Deploy Phase GameState.
 * Each rule check corresponds to a BR-xxx reference from RULES.md.
 *
 * @module
 */

import type { Action, GameState, Player } from '../types.js';
import { GameError } from '../errors.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { getStack, topPiece, stackSize, hasPlacedMarshal, trySquare } from '../board/board.js';
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
 * 2. BR-DEPLOY-002: Turn order (active player check --- implicit)
 * 3. BR-DEPLOY-003: Marshal must be first placement per player
 * 4. BR-DEPLOY-004: Destination within deploy zone
 * 5. BR-DEPLOY-005/006: Target is empty or friendly-topped stack under size 3
 * 6. BR-STACK-004: No stacking on a Marshal-topped target
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

  // 2. Piece must be in hand.
  //    Fail closed on unknown piece letters (untrusted Action input): an
  //    out-of-ALL_PIECE_TYPES letter would otherwise pass `hand[piece] < 1`
  //    (undefined < 1 === false) and later write NaN into the hand.
  if (!ALL_PIECE_TYPES.includes(piece) || hand[piece] < 1) {
    return {
      ok: false,
      error: new GameError(`Piece ${piece} is not in ${player}'s hand`, 'BR-DEPLOY-002'),
    };
  }

  // 3. BR-DEPLOY-003: Marshal must be first placement.
  //    Marshal placement needs no extra check (hand availability already
  //    verified above); every non-Marshal piece requires the Marshal to
  //    already be on the board.
  if (piece !== 'M' && !hasPlacedMarshal(state.position, player)) {
    return {
      ok: false,
      error: new GameError(`Must place Marshal before placing other pieces`, 'BR-DEPLOY-003'),
    };
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

  // 5+6. Check destination square (BR-DEPLOY-005/006).
  //    Dest comes from the untrusted Action --- fail closed on an
  //    out-of-bounds square (BR-PLAY-001) instead of letting getStack throw.
  //    Out-of-range rows are already rejected by the zone check above; this
  //    guard additionally covers out-of-range columns (BR-DEPLOY-004).
  const destSquare = trySquare(dest.col, dest.row);
  if (!destSquare) {
    return {
      ok: false,
      error: new GameError(
        `Destination (${dest.col}-${dest.row}) is out of bounds`,
        'BR-DEPLOY-004',
      ),
    };
  }
  const targetStack = getStack(state.position, destSquare);

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

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  validateDone                                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate a standalone Done Action against the current GameState.
 *
 * Done is a standalone Action (`!`) legal only in the Deploy Phase and only
 * after the declaring player's Marshal is deployed (BR-DEPLOY-003). It ends
 * that player's deploying (BR-DEPLOY-007) without changing position or hands
 * and without advancing the turn counter.
 *
 * Checks (in order):
 * 1. BR-GAN-VALID-001 / BR-DEPLOY-001: Must be in Deploy Phase
 * 2. BR-DEPLOY-003: The active player's Marshal must already be on the board
 *
 * @param state - Current GameState.
 * @returns ValidationResult.
 */
export function validateDone(state: GameState): ValidationResult {
  // 1. Phase check
  if (state.turn.phase !== 'deploy') {
    return {
      ok: false,
      error: new GameError('Done is only valid during the Deploy Phase', 'BR-GAN-VALID-001'),
    };
  }

  // 2. BR-DEPLOY-003: Marshal must be deployed before declaring Done
  const player = state.turn.activePlayer;
  if (!hasPlacedMarshal(state.position, player)) {
    return {
      ok: false,
      error: new GameError('Cannot declare Done before the Marshal is deployed', 'BR-DEPLOY-003'),
    };
  }

  return { ok: true };
}
