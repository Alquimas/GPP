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
 * Play validation result — includes a SPECULATIVE post-action state on success.
 *
 * WARNING: `speculativeState` is NOT a committed next GameState.
 * It lacks: turn transition (active player flip), turn counter increment,
 * turncoat application, history recording, and terminal-condition evaluation.
 * Step 10 will replace it with a real committed state.
 *
 * Consumers MUST NOT treat `speculativeState` as the "next game state" for
 * any purpose other than Self-Check (BR-ACTION-002) evaluation.
 */
export type PlayValidation =
  | { ok: true; speculativeState: GameState }
  | { ok: false; error: GameError };
