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
 * Play validation result --- includes the FULL committed post-action state on success.
 *
 * The state includes: board position, hand contents, active player flip
 * (BR-TURN-002), turn counter increment, and Turncoat swap resolution (BR-STACK-006).
 *
 * What it still lacks (added in Steps 11–12):
 *   - Terminal-condition evaluation (Checkmate, Stalemate, Repetition)
 *   - History recording for Repetition detection
 *
 * The pure engine uses `speculativeState` directly as the next GameState
 * after a successful Play.
 */
export type PlayValidation =
  { ok: true; speculativeState: GameState } | { ok: false; error: GameError };
