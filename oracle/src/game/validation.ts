/**
 * Shared validation result types for the game engine.
 *
 * These types are used by both deploy.ts and battle.ts validators,
 * ensuring a single canonical definition instead of duplicates.
 *
 * @module
 */

import type { GameState } from '../types.js';
import { GameError } from '../errors.js';

/* ------------------------------------------------------------------ */
/*  ValidationResult                                                   */
/* ------------------------------------------------------------------ */

/**
 * Basic validation result: ok (no payload), or error.
 *
 * Used by deploy-phase validation where no post-action state is
 * pre-computed (deploy actions don't need Self Check evaluation).
 */
export type ValidationResult = { ok: true } | { ok: false; error: GameError };

/* ------------------------------------------------------------------ */
/*  PlayValidation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Play validation result — always includes pre-computed afterState
 * on success for Self Check evaluation.
 *
 * Used by battle-phase validators (validateMove, validateArata,
 * validatePlay) which apply the action speculatively to check that
 * the Active Player's Marshal is not left in Check (BR-ACTION-002).
 */
export type PlayValidation =
  | { ok: true; afterState: GameState }
  | { ok: false; error: GameError };
