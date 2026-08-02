/**
 * Terminal condition evaluation for the Gungi game engine.
 *
 * evaluateExposure handles the Deploy->Battle boundary (BR-DEPLOY-012).
 * checkTerminal handles Battle Phase terminal conditions (BR-GAME-004).
 *
 * @module
 */

import type { GameResult, GameState, Player, Position } from '../types.js';
import { isExposed, isInCheck } from '../board/attack.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { playCandidates } from './candidates.js';
import { validatePlay } from './battle.js';

/** Return the opponent of a player. */
function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

/* ------------------------------------------------------------------ */
/*  evaluateExposure                                                   */
/* ------------------------------------------------------------------ */

/**
 * Evaluate Exposure at the Deploy->Battle boundary (BR-DEPLOY-012).
 *
 * @param position - The board position at the end of the Deploy Phase.
 * @returns The game result determined by exposure evaluation.
 */
export function evaluateExposure(position: Position): GameResult {
  const exposure = isExposed(position);
  const { white: w, black: b } = exposure;

  if (w && b) return { kind: 'exposure-draw' };
  if (w) return { kind: 'exposure', loser: 'white' };
  if (b) return { kind: 'exposure', loser: 'black' };
  return { kind: 'ongoing' };
}

/**
 * Return true if the active player has at least one legal Play
 * (Move or Arata) available.
 *
 * Candidate generation is deliberately brute-force. Every candidate is
 * checked by validatePlay, the same validator used to apply real actions.
 *
 * @param state - Current GameState.
 * @returns true if at least one legal Play exists.
 */
export function hasLegalPlays(state: GameState): boolean {
  return playCandidates(state).some((action) => validatePlay(state, action).ok);
}

/* ------------------------------------------------------------------ */
/*  Repetition comparison helper                                       */
/* ------------------------------------------------------------------ */

/**
 * Structural equality of two GameStates for Repetition detection
 * (BR-REPETITION-001).
 *
 * Compares: activePlayer, position (all pieces), and both hands.
 * The turn counter is deliberately excluded --- per GSFEN.md the counter
 * is metadata, not part of the Game State for repetition purposes.
 */
function statesEqualForRepetition(a: GameState, b: GameState): boolean {
  // Active player
  if (a.turn.activePlayer !== b.turn.activePlayer) return false;

  // Position --- compare every cell
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const sa = a.position[r][c];
      const sb = b.position[r][c];
      if (sa === null && sb === null) continue;
      if (sa === null || sb === null) return false;
      if (sa.length !== sb.length) return false;
      for (let i = 0; i < sa.length; i++) {
        if (sa[i].type !== sb[i].type || sa[i].owner !== sb[i].owner) return false;
      }
    }
  }

  // Hands --- both players, all piece types
  for (const pt of ALL_PIECE_TYPES) {
    if (a.hands.white[pt] !== b.hands.white[pt]) return false;
    if (a.hands.black[pt] !== b.hands.black[pt]) return false;
  }

  return true;
}

/**
 * Count how many times `state` appears in `history` (battle-phase only).
 * The final count is history-matches + 1 (the current state itself).
 */
function countRepetitions(state: GameState, history: GameState[]): number {
  let count = 1; // current state
  for (const h of history) {
    if (h.turn.phase !== 'battle') continue;
    if (statesEqualForRepetition(state, h)) count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  hasInsufficientMaterial                                            */
/* ------------------------------------------------------------------ */

/**
 * Check whether the game is in an Insufficient Material state
 * (BR-TERMINATION-003).
 *
 * Returns true when both players have exactly their Marshal on the
 * board and no pieces in either hand --- a dead position where neither
 * can ever deliver checkmate.
 *
 * @param state - Current GameState.
 * @returns true if the material is insufficient to continue.
 */
export function hasInsufficientMaterial(state: GameState): boolean {
  let whiteCount = 0;
  let blackCount = 0;
  let whiteHasMarshal = false;
  let blackHasMarshal = false;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = state.position[r][c];
      if (stack === null) continue;
      for (const piece of stack) {
        if (piece.owner === 'white') {
          whiteCount++;
          if (piece.type === 'M') whiteHasMarshal = true;
        } else {
          blackCount++;
          if (piece.type === 'M') blackHasMarshal = true;
        }
      }
    }
  }

  if (whiteCount !== 1 || !whiteHasMarshal) return false;
  if (blackCount !== 1 || !blackHasMarshal) return false;

  for (const pt of ALL_PIECE_TYPES) {
    if (state.hands.white[pt] !== 0) return false;
    if (state.hands.black[pt] !== 0) return false;
  }

  return true;
}

/* ------------------------------------------------------------------ */
/*  checkTerminal                                                      */
/* ------------------------------------------------------------------ */

/**
 * Evaluate terminal conditions before a Battle Phase Turn
 * (BR-GAME-004 evaluation order).
 *
 * 1. Checkmate (BR-TERMINATION-001) --- in Check + no legal plays.
 * 2. Stalemate (BR-TERMINATION-002) --- not in Check + no legal plays.
 * 3. Repetition (BR-REPETITION-001 / BR-TERMINATION-004) --- same state 4×
 *    in battle history; the repeating player (the one whose Action produced
 *    the 4th occurrence, i.e. the OPPONENT of the active player) loses.
 * 4. Insufficient Material (BR-TERMINATION-003) --- both players have
 *    only their Marshals (no other pieces, empty hands).
 *
 * Returns `{ kind: 'ongoing' }` if the game continues.
 *
 * @param state   - Current GameState (about to enter a Turn).
 * @param history - Prior states (for Repetition counting).
 * @returns The terminal condition result.
 */
export function checkTerminal(state: GameState, history: GameState[]): GameResult {
  // 1+2. Checkmate / Stalemate
  if (!hasLegalPlays(state)) {
    if (isInCheck(state.position, state.turn.activePlayer)) {
      return { kind: 'checkmate', loser: state.turn.activePlayer };
    }
    return { kind: 'stalemate', loser: state.turn.activePlayer };
  }

  // 3. Repetition (only after confirming the game is not already over
  //    via checkmate/stalemate, per BR-GAME-004 ordering). The repeating
  //    player --- the one whose Action produced the 4th occurrence --- is the
  //    OPPONENT of the active player (BR-REPETITION-001, BR-TERMINATION-004).
  if (countRepetitions(state, history) >= 4) {
    return { kind: 'repetition', loser: opponent(state.turn.activePlayer) };
  }

  // 4. Insufficient Material (BR-TERMINATION-003).
  if (hasInsufficientMaterial(state)) {
    return { kind: 'insufficient-material' };
  }

  return { kind: 'ongoing' };
}
