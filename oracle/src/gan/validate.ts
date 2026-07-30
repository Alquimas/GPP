/**
 * Validate a parsed GAN Action against a GameState.
 *
 * GAN parsing owns grammar and canonical-form checks. Domain validators own
 * action legality; this adapter only maps phase mismatches to GAN's error
 * vocabulary.
 */

import type { Action, GameState } from '../types.js';
import { GameError } from '../errors.js';
import type { ValidationResult } from '../game/validation.js';
import { validatePlacement } from '../game/deploy.js';
import { validatePlay } from '../game/battle.js';

export type { ValidationResult };

export function validateAction(action: Action, state: GameState): ValidationResult {
  const phaseMatches =
    (action.kind === 'placement' && state.turn.phase === 'deploy') ||
    (action.kind !== 'placement' && state.turn.phase === 'battle');

  if (!phaseMatches) {
    return {
      ok: false,
      error: new GameError('Action does not match the current phase', 'BR-GAN-VALID-001'),
    };
  }

  if (action.kind === 'placement') {
    return validatePlacement(state, action);
  }

  const result = validatePlay(state, action);
  return result.ok ? { ok: true } : result;
}
