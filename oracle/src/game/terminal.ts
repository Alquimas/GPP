/**
 * Terminal condition evaluation for the Gungi game engine.
 *
 * Step  9: evaluateExposure  — Deploy→Battle boundary (BR-DEPLOY-012).
 * Step 11: checkTerminal     — Checkmate, Stalemate, Repetition (BR-GAME-004).
 *          hasLegalPlays     — Brute-force scan for any legal Play.
 *
 * @module
 */

import type { GameResult, GameState, Player, Position, Square } from '../types.js';
import { isExposed, isInCheck } from '../board/attack.js';
import { getLegalDestinations } from '../board/movement.js';
import {
  createStack,
  getStack,
  setStack,
  squareFromIndex,
  topPiece,
  trySquare,
} from '../board/board.js';
import { ALL_PIECE_TYPES } from '../constants.js';

/* ------------------------------------------------------------------ */
/*  evaluateExposure                                                   */
/* ------------------------------------------------------------------ */

/**
 * Evaluate Exposure at the Deploy→Battle boundary (BR-DEPLOY-012).
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

/* ------------------------------------------------------------------ */
/*  Internal helpers — Arata zone (duplicated from battle.ts)          */
/*  Kept private to avoid circular dependencies:                      */
/*    terminal → battle → apply → terminal                             */
/* ------------------------------------------------------------------ */

/** Compute the Arata placement zone for a player (BR-ARATA-003). */
function getArataZone(player: Player, state: GameState): { minRow: number; maxRow: number } {
  if (player === 'white') {
    let mostAdvanced = 9;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stack = state.position[r][c];
        if (stack === null) continue;
        for (const piece of stack) {
          if (piece.owner === 'white') {
            const row = r + 1; // 0-indexed → 1-indexed
            if (row < mostAdvanced) mostAdvanced = row;
          }
        }
      }
    }
    return { minRow: mostAdvanced, maxRow: 9 };
  }
  // Black
  let mostAdvanced = 1;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = state.position[r][c];
      if (stack === null) continue;
      for (const piece of stack) {
        if (piece.owner === 'black') {
          const row = r + 1;
          if (row > mostAdvanced) mostAdvanced = row;
        }
      }
    }
  }
  return { minRow: 1, maxRow: mostAdvanced };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers — inline move simulation (Self Check for moves)   */
/*  Duplicates minimal logic from apply.ts to avoid circular deps:     */
/*    terminal → battle → apply → terminal                             */
/* ------------------------------------------------------------------ */

/**
 * Simulate a Move with Stack outcome and check if it would leave the
 * moving player's Marshal in check (Self Check, BR-ACTION-002).
 *
 * Handles: empty target, friendly target (automatic stack),
 * enemy target with stacking outcome (moving piece on top).
 */
function isMoveSafe(position: Position, origin: Square, dest: Square, player: Player): boolean {
  const originStack = getStack(position, origin);
  if (!originStack) return false;
  const movingPiece = topPiece(originStack);

  // Detach from origin
  let newPos: Position;
  if (originStack.length === 1) {
    newPos = setStack(position, origin, null);
  } else {
    newPos = setStack(position, origin, createStack(originStack.slice(0, -1)));
  }

  // Resolve destination
  const targetStack = getStack(position, dest);

  if (targetStack === null) {
    // Empty target: piece sits alone
    newPos = setStack(newPos, dest, createStack([movingPiece]));
  } else {
    // BR-STACK-003: Cannot stack on a full stack
    if (targetStack.length >= 3) return false;
    // BR-STACK-004: No stacking on a Marshal (friendly or enemy)
    if (topPiece(targetStack).type === 'M') return false;
    const pieces = [...targetStack, movingPiece];
    newPos = setStack(newPos, dest, createStack(pieces));
  }

  return !isInCheck(newPos, player);
}

/**
 * Simulate a Move with Capture outcome and check Self Check.
 *
 * Removes all enemy pieces from the target stack, keeps friendly
 * pieces, and places the moving piece on top.
 */
function isCaptureSafe(position: Position, origin: Square, dest: Square, player: Player): boolean {
  const originStack = getStack(position, origin);
  if (!originStack) return false;
  const movingPiece = topPiece(originStack);

  // Detach from origin
  let newPos: Position;
  if (originStack.length === 1) {
    newPos = setStack(position, origin, null);
  } else {
    newPos = setStack(position, origin, createStack(originStack.slice(0, -1)));
  }

  // Resolve as Capture: remove all enemy pieces, keep friendly
  const targetStack = getStack(position, dest);
  if (targetStack === null) return false; // nothing to capture — shouldn't happen

  // BR-STACK-004: No stacking on a Marshal (friendly or enemy)
  if (topPiece(targetStack).type === 'M') return false;

  const remaining = targetStack.filter((p) => p.owner === player);
  if (remaining.length === 0) {
    newPos = setStack(newPos, dest, createStack([movingPiece]));
  } else {
    newPos = setStack(newPos, dest, createStack([...remaining, movingPiece]));
  }

  return !isInCheck(newPos, player);
}

/* ------------------------------------------------------------------ */
/*  hasLegalPlays — brute-force scan                                   */
/* ------------------------------------------------------------------ */

/**
 * Return true if the active player has at least one legal Play
 * (Move or Arata) available.
 *
 * Brute-force scan — evaluates every piece on the board (via
 * getLegalDestinations) and every possible Arata (by simulating in-line).
 * This is deliberately unoptimised per the naive-oracle principle.
 *
 * @param state - Current GameState.
 * @returns true if at least one legal Play exists.
 */
export function hasLegalPlays(state: GameState): boolean {
  const player = state.turn.activePlayer;

  // ── Check Moves ──────────────────────────────────────────────
  // For each of the player's pieces, evaluate every legal destination
  // AND verify Self Check (BR-ACTION-002) by simulating the move inline.
  // The inline simulation avoids circular imports (terminal → battle → apply).

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const stack = state.position[r][c];
      if (stack === null) continue;
      if (topPiece(stack).owner !== player) continue;
      const origin = squareFromIndex(r, c);
      const moves = getLegalDestinations(state.position, origin, player);
      for (const move of moves) {
        if (move.outcome === 'capture') {
          if (isCaptureSafe(state.position, origin, move.dest, player)) return true;
        } else {
          if (isMoveSafe(state.position, origin, move.dest, player)) return true;
          if (move.outcome === 'stack') {
            if (isCaptureSafe(state.position, origin, move.dest, player)) return true;
          }
        }
      }
    }
  }

  // ── Check Aratas ──────────────────────────────────────────────
  // For every piece type in hand, try every board square.
  // Inline the validation + Self Check to avoid circular imports.
  const hand = state.hands[player];
  const zone = getArataZone(player, state);

  for (const pt of ALL_PIECE_TYPES) {
    if (hand[pt] < 1) continue;
    // Marshal is never in battle hand (BR-DEPLOY-011), but the
    // hand check already rejects it — no explicit Marshal check needed.

    for (let dc = 1; dc <= 9; dc++) {
      for (let dr = 1; dr <= 9; dr++) {
        const dest = trySquare(dc, dr);
        if (dest === null) continue;

        // BR-ARATA-003: within arata zone
        if (dest.row < zone.minRow || dest.row > zone.maxRow) continue;

        // BR-ARATA-004/005/006/007: destination check
        const targetStack = getStack(state.position, dest);
        if (targetStack !== null) {
          const targetTop = topPiece(targetStack);
          // BR-ARATA-006: not on enemy stack
          if (targetTop.owner !== player) continue;
          // BR-ARATA-007: not on Marshal
          if (targetTop.type === 'M') continue;
          // BR-ARATA-005: stack size limit
          if (targetStack.length >= 3) continue;
        }

        // BR-ACTION-002: Self Check — simulate placement and check
        const placedPiece = { type: pt, owner: player };
        let newPosition: Position;
        if (targetStack === null) {
          newPosition = setStack(state.position, dest, createStack([placedPiece]));
        } else {
          const pieces = [...targetStack, placedPiece];
          newPosition = setStack(state.position, dest, createStack(pieces));
        }

        if (!isInCheck(newPosition, player)) {
          return true; // found a legal arata that doesn't self-check
        }
      }
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Repetition comparison helper                                       */
/* ------------------------------------------------------------------ */

/**
 * Structural equality of two GameStates for Repetition detection
 * (BR-REPETITION-001).
 *
 * Compares: activePlayer, position (all pieces), and both hands.
 * The turn counter is deliberately excluded — per GSFEN.md the counter
 * is metadata, not part of the Game State for repetition purposes.
 *
 * TODO: Inline this manually (check position cell-by-cell) rather than
 * serializing, to keep the naive-oracle principle of explicit comparison
 * logic and zero dependency on the serialiser.
 */
function statesEqualForRepetition(a: GameState, b: GameState): boolean {
  // Active player
  if (a.turn.activePlayer !== b.turn.activePlayer) return false;

  // Position — compare every cell
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

  // Hands — both players, all piece types
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
 * board and no pieces in either hand — a dead position where neither
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
 * 1. Checkmate (BR-TERMINATION-001) — in Check + no legal plays.
 * 2. Stalemate (BR-TERMINATION-002) — not in Check + no legal plays.
 * 3. Repetition (BR-REPETITION-001) — same state 4× in battle history.
 * 4. Insufficient Material (BR-TERMINATION-003) — both players have
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
  //    via checkmate/stalemate, per BR-GAME-004 ordering).
  if (countRepetitions(state, history) >= 4) {
    return { kind: 'repetition' };
  }

  // 4. Insufficient Material (BR-TERMINATION-003).
  if (hasInsufficientMaterial(state)) {
    return { kind: 'insufficient-material' };
  }

  return { kind: 'ongoing' };
}
