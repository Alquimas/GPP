/**
 * Terminal condition evaluation for the Gungi game engine.
 *
 * Step 9: evaluateExposure — deployed at the Deploy→Battle boundary (BR-DEPLOY-012).
 * Step 11: checkTerminal, hasLegalPlays — Checkmate, Stalemate, Repetition.
 *
 * @module
 */

import type { GameResult, Position } from '../types.js';
import { isExposed } from '../board/attack.js';

/* ------------------------------------------------------------------ */
/*  evaluateExposure                                                   */
/* ------------------------------------------------------------------ */

/**
 * Evaluate Exposure at the Deploy→Battle boundary (BR-DEPLOY-012).
 *
 * Checks if either player's Marshal is under attack when the Deploy Phase
 * ends. The outcome determines whether the game ends immediately or
 * proceeds to the Battle Phase.
 *
 * Returns:
 *   - `{ kind: 'ongoing' }`            — neither Marshal under attack → proceed to Battle Phase
 *   - `{ kind: 'exposure'; loser }`     — exactly one Marshal under attack → that player loses
 *   - `{ kind: 'exposure-draw' }`       — both Marshals under attack → draw
 *
 * @param position - The board position at the end of the Deploy Phase.
 * @returns The game result determined by exposure evaluation.
 */
export function evaluateExposure(position: Position): GameResult {
  const exposure = isExposed(position);
  const { white: w, black: b } = exposure;

  if (w && b) {
    return { kind: 'exposure-draw' };
  }
  if (w) {
    return { kind: 'exposure', loser: 'white' };
  }
  if (b) {
    return { kind: 'exposure', loser: 'black' };
  }
  return { kind: 'ongoing' };
}
