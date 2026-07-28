/**
 * Battle-phase action validation (Step 8).
 *
 * Validates Move and Arata actions against a Battle Phase GameState.
 * Each rule check corresponds to a BR-xxx reference from BUSINESS_RULES.md.
 *
 * @module
 */

import type { Action, BoardCoord, GameState, Player } from '../types.js';
import { GameError } from '../errors.js';
import { getStack, squareFromIndex, topPiece, stackSize } from '../board/board.js';
import { getLegalDestinations } from '../board/movement.js';
import { isInCheck } from '../board/attack.js';
import { applyMove, applyArata } from './apply.js';
import type { PlayValidation } from './validation.js';

// Re-export PlayValidation so consumers can import from battle.ts
export type { PlayValidation };

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate the action's declared outcome against the engine-computed outcome.
 *
 * The movement engine (determineOutcome) already classified the target:
 *   - null     → empty or friendly (automatic stacking)
 *   - 'stack'  → enemy, size < 3, not Marshal (player may choose)
 *   - 'capture'→ enemy, size = 3 OR top is Marshal (forced capture)
 *
 * This function reuses the engine's classification instead of re-deriving
 * the reason.  The targetStack parameter is used only for error-message
 * specificity (empty vs. friendly), not for decision logic.
 */
function validateOutcome(
  engineOutcome: 'stack' | 'capture' | null,
  targetStack: ReturnType<typeof getStack>,
  actionOutcome: 'stack' | 'capture' | null,
): GameError | null {
  if (engineOutcome === null) {
    // Engine says no capture possible — empty or friendly target
    if (actionOutcome !== null) {
      if (targetStack === null) {
        return new GameError('Cannot specify outcome when landing on an empty square', 'BR-MOVE-004');
      }
      return new GameError('Cannot specify outcome when stacking on a friendly piece', 'BR-MOVE-004');
    }
    return null;
  }

  if (engineOutcome === 'capture') {
    // Engine says capture is forced (size 3 or Marshal top) — outcome must be omitted
    if (actionOutcome !== null) {
      return new GameError('Capture is forced — cannot specify outcome token', 'BR-CAPTURE-002');
    }
    return null;
  }

  // Engine says choice exists (stack or capture legal) — outcome must be present
  if (actionOutcome === null) {
    return new GameError(
      'Outcome must be specified (stack/capture) when both are legal',
      'BR-STACK-002',
    );
  }

  return null;
}

/**
 * Compute the Arata placement zone for a player (BR-ARATA-003).
 *
 * Returns the inclusive row range within which an Arata placement
 * is permitted:
 *   - White: from the most advanced (smallest-row) White piece's row
 *            up to row 9 (own edge).
 *   - Black: from row 1 (own edge) up to the most advanced
 *            (largest-row) Black piece's row.
 *
 * INVENTION: BR-ARATA-003 does not specify behavior when the player
 * has no board pieces. The zone collapses to the player's own edge
 * row only. This case is unreachable in legal play (the first action
 * must be a deploy placement, which places the Marshal on the board).
 */
function getArataZone(
  player: Player,
  state: GameState,
): { minRow: BoardCoord; maxRow: BoardCoord } {
  if (player === 'white') {
    // White: between Row 9 (own edge) and the smallest Row containing any White piece
    let mostAdvanced: BoardCoord = 9; // default: no pieces → own edge only
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stack = state.position[r][c];
        if (stack !== null) {
          for (const piece of stack) {
            if (piece.owner === 'white') {
              const row = squareFromIndex(r, c).row;
              if (row < mostAdvanced) {
                mostAdvanced = row;
              }
            }
          }
        }
      }
    }
    return { minRow: mostAdvanced, maxRow: 9 };
  } else {
    // Black: between Row 1 (own edge) and the largest Row containing any Black piece
    let mostAdvanced: BoardCoord = 1; // default: no pieces → own edge only
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stack = state.position[r][c];
        if (stack !== null) {
          for (const piece of stack) {
            if (piece.owner === 'black') {
              const row = squareFromIndex(r, c).row;
              if (row > mostAdvanced) {
                mostAdvanced = row;
              }
            }
          }
        }
      }
    }
    return { minRow: 1, maxRow: mostAdvanced };
  }
}

/* ------------------------------------------------------------------ */
/*  validateMove                                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate a Move action against the current GameState.
 *
 * Checks performed here (in order):
 *   0. BR-PLAY-002: Phase must be 'battle'
 *   1. BR-MOVE-002: Origin contains player's own piece
 *   2. BR-MOVE-003: Destination is reachable (calls movement.ts)
 *   3. Outcome validation (BR-STACK-002/003/004, BR-CAPTURE-001/002/003)
 *   4. BR-STACK-006: Turncoat (defensively rejected until Step 10)
 *   5. BR-STACK-004: No stacking on Marshal
 *   6. BR-ACTION-002: Self Check — own Marshal not under attack after move
 *
 * Rules enforced upstream (not checked here):
 *   - BR-MOVE-001 (piece is top of its stack): enforced by
 *     `getLegalDestinations` in `board/movement.ts`. If the piece is not
 *     the top of its stack, no legal destination is returned.
 *   - BR-MOVE-005 (stack size landing restriction): enforced by
 *     `getLegalDestinations` in `board/movement.ts`, which filters out
 *     oversized targets via `canLandOnStack` before this validator
 *     sees them.
 *
 * @param state - Current GameState.
 * @param action - The Move action to validate.
 * @returns PlayValidation with speculativeState on success.
 */
export function validateMove(state: GameState, action: Action): PlayValidation {
  if (action.kind !== 'move') {
    return {
      ok: false,
      error: new GameError('Action is not a move', 'BR-MOVE-002'),
    };
  }

  // 0. Phase check (BR-PLAY-002): Move is a Play, only valid in battle phase
  if (state.turn.phase !== 'battle') {
    return {
      ok: false,
      error: new GameError('Move is only valid during the Battle Phase', 'BR-PLAY-002'),
    };
  }

  const { origin, dest, outcome } = action;
  const player = state.turn.activePlayer;

  // 1. BR-MOVE-002: Origin must contain player's own piece
  const originStack = getStack(state.position, origin);
  if (!originStack) {
    return {
      ok: false,
      error: new GameError(`No piece at origin (${origin.col}-${origin.row})`, 'BR-MOVE-002'),
    };
  }
  const originTop = topPiece(originStack);
  if (originTop.owner !== player) {
    return {
      ok: false,
      error: new GameError(
        `Piece at origin (${origin.col}-${origin.row}) does not belong to ${player}`,
        'BR-MOVE-002',
      ),
    };
  }

  // 2+3. BR-MOVE-003: Destination must be reachable
  const legalMoves = getLegalDestinations(state.position, origin, player);
  const matchingMove = legalMoves.find((m) => m.dest.col === dest.col && m.dest.row === dest.row);
  if (!matchingMove) {
    return {
      ok: false,
      error: new GameError(
        `Destination (${dest.col}-${dest.row}) is not reachable from (${origin.col}-${origin.row})`,
        'BR-MOVE-003',
      ),
    };
  }

  // 5. Outcome validation — reuse the engine's classification (determineOutcome),
  //    no longer re-derives the reason (BR-STACK-002/004, BR-CAPTURE-001/002/003).
  const targetStack = getStack(state.position, dest);
  const outcomeError = validateOutcome(matchingMove.outcome, targetStack, outcome);
  if (outcomeError) {
    return { ok: false, error: outcomeError };
  }

  // BR-STACK-006: Turncoat — explicitly rejected until Step 10
  if (action.turncoat.length > 0) {
    return {
      ok: false,
      error: new GameError('Turncoat validation is not yet implemented (Step 10)', 'BR-STACK-006'),
    };
  }

  // 6. BR-STACK-004: No stacking on Marshal (friendly or enemy)
  // The Marshal is never actually captured — Checkmate ends the Game first.
  // BR-STACK-004 prohibits any piece from being placed or moved on top of a Marshal.
  if (targetStack !== null && targetStack.length > 0) {
    const targetTop = topPiece(targetStack);
    if (targetTop.type === 'M') {
      return {
        ok: false,
        error: new GameError('Cannot land on a square occupied by a Marshal', 'BR-STACK-004'),
      };
    }
  }

  // 7. BR-ACTION-002: Self Check — apply the move and check
  const speculativeState = applyMove(state, action);
  if (isInCheck(speculativeState.position, player)) {
    return {
      ok: false,
      error: new GameError('Move would leave own Marshal in check', 'BR-ACTION-002'),
    };
  }

  return { ok: true, speculativeState };
}

/* ------------------------------------------------------------------ */
/*  validateArata                                                      */
/* ------------------------------------------------------------------ */

/**
 * Validate an Arata action against the current GameState.
 *
 * Checks (in order):
 * 0. Phase must be 'battle' (BR-ARATA-001)
 * 1. BR-ARATA-002: Piece is in hand (and not Marshal)
 * 2. BR-ARATA-003: Destination is within Arata placement zone
 * 3. BR-ARATA-004/005: Target is empty or friendly-topped stack under size 3
 * 4. BR-ARATA-006: Not on enemy stack
 * 5. BR-ARATA-007: Not on Marshal
 * 6. BR-ACTION-002: Self Check after placement
 *
 * @param state - Current GameState.
 * @param action - The Arata action to validate.
 * @returns PlayValidation with speculativeState on success.
 */
export function validateArata(state: GameState, action: Action): PlayValidation {
  if (action.kind !== 'arata') {
    return {
      ok: false,
      error: new GameError('Action is not an arata', 'BR-ARATA-001'),
    };
  }

  // 0. BR-ARATA-001: Phase check — Arata is a Play, only valid in battle phase
  if (state.turn.phase !== 'battle') {
    return {
      ok: false,
      error: new GameError('Arata is only valid during the Battle Phase', 'BR-ARATA-001'),
    };
  }

  const { piece, dest } = action;
  const player = state.turn.activePlayer;

  // 1. BR-ARATA-002: Piece must be in hand
  if (state.hands[player][piece] < 1) {
    return {
      ok: false,
      error: new GameError(`Piece ${piece} is not in ${player}'s hand`, 'BR-ARATA-002'),
    };
  }

  // Marshal is never in hand during battle phase (BR-DEPLOY-011),
  // so the BR-ARATA-002 hand check above already catches this case.
  // No explicit Marshal check needed here.

  // 2. BR-ARATA-003: Arata placement zone
  const zone = getArataZone(player, state);
  if (dest.row < zone.minRow || dest.row > zone.maxRow) {
    return {
      ok: false,
      error: new GameError(
        `Destination (${dest.col}-${dest.row}) is outside ${player}'s Arata zone (rows ${zone.minRow}-${zone.maxRow})`,
        'BR-ARATA-003',
      ),
    };
  }

  // 3+4+5. Check destination square
  const targetStack = getStack(state.position, dest);

  if (targetStack !== null) {
    const targetTop = topPiece(targetStack);

    // BR-ARATA-006: Not on enemy stack
    if (targetTop.owner !== player) {
      return {
        ok: false,
        error: new GameError('Cannot arata onto an enemy-controlled square', 'BR-ARATA-006'),
      };
    }

    // BR-ARATA-007: Not on Marshal
    if (targetTop.type === 'M') {
      return {
        ok: false,
        error: new GameError('Cannot arata onto a Marshal', 'BR-ARATA-007'),
      };
    }

    // BR-ARATA-005: Stack size limit
    if (stackSize(targetStack) >= 3) {
      return {
        ok: false,
        error: new GameError('Cannot arata onto a full stack (size 3)', 'BR-ARATA-005'),
      };
    }
  }

  // BR-STACK-006: Turncoat — explicitly rejected until Step 10
  if (action.turncoat.length > 0) {
    return {
      ok: false,
      error: new GameError('Turncoat validation is not yet implemented (Step 10)', 'BR-STACK-006'),
    };
  }

  // 6. BR-ACTION-002: Self Check
  const speculativeState = applyArata(state, action);
  if (isInCheck(speculativeState.position, player)) {
    return {
      ok: false,
      error: new GameError('Arata would leave own Marshal in check', 'BR-ACTION-002'),
    };
  }

  return { ok: true, speculativeState };
}

/* ------------------------------------------------------------------ */
/*  validatePlay                                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate a Play action (Move or Arata) against the current GameState.
 *
 * Dispatches to validateMove or validateArata based on action.kind.
 * Rejects placement actions during battle phase.
 *
 * The returned PlayValidation always includes the pre-computed speculativeState
 * on success, which the caller (Game.applyAction) can use directly.
 *
 * @param state - Current GameState.
 * @param action - The Play action to validate.
 * @returns PlayValidation with speculativeState on success.
 */
export function validatePlay(state: GameState, action: Action): PlayValidation {
  if (action.kind === 'placement') {
    return {
      ok: false,
      error: new GameError('Placement is only valid during the Deploy Phase', 'BR-DEPLOY-001'),
    };
  }

  if (action.kind === 'move') {
    return validateMove(state, action);
  }

  if (action.kind === 'arata') {
    return validateArata(state, action);
  }

  const _exhaustive: never = action;
  void _exhaustive;
  return {
    ok: false,
    error: new GameError(`Unknown action kind`, 'BR-ACTION-001'),
  };
}
