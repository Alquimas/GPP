/**
 * Minimal action application for Self Check evaluation (BR-ACTION-002).
 *
 * These functions temporarily apply a validated move or arata to compute
 * the post-action GameState, which is then checked to ensure the acting
 * player's Marshal is not under attack.
 *
 * ## Forward reference
 * These are minimal implementations sufficient for Step 8 (Action Validation).
 * Step 10 replaces them with the full game-engine apply functions that also
 * handle turn management, history recording, and terminal condition evaluation.
 *
 * @module
 */

import type { Action, GameState, Piece, Player } from '../types.js';
import { createStack, getStack, setStack, topPiece } from '../board/board.js';

/* ------------------------------------------------------------------ */
/*  Type aliases (using Extract for clarity over intersection types)   */
/* ------------------------------------------------------------------ */

/** The Move variant of the Action discriminated union. */
type MoveAction = Extract<Action, { kind: 'move' }>;

/** The Arata variant of the Action discriminated union. */
type ArataAction = Extract<Action, { kind: 'arata' }>;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Deep-clone a GameState (avoids mutating the original). */
function cloneState(state: GameState): GameState {
  return {
    position: state.position.map((row) =>
      row.map((cell) => (cell === null ? null : ([...cell] as const as typeof cell))),
    ),
    turn: { ...state.turn, done: state.turn.done },
    hands: {
      white: { ...state.hands.white },
      black: { ...state.hands.black },
    },
  };
}

/** Remove the top piece from a stack and return both the new stack and the removed piece. */
function detachTop(stack: ReturnType<typeof getStack>): { newStack: typeof stack; piece: Piece } {
  if (!stack) throw new Error('detachTop called on null stack — caller must validate first');
  const removed = topPiece(stack);
  if (stack.length === 1) {
    return { newStack: null, piece: removed };
  }
  const remaining = stack.slice(0, -1);
  return { newStack: createStack(remaining), piece: removed };
}

/** Remove all enemy pieces from a stack (capture), keep friendly ones. */
function removeEnemyPieces(
  stack: NonNullable<ReturnType<typeof getStack>>,
  friendlyOwner: Player,
): ReturnType<typeof getStack> {
  const remaining = stack.filter((p) => p.owner === friendlyOwner);
  if (remaining.length === 0) return null;
  return createStack(remaining);
}

/* ------------------------------------------------------------------ */
/*  applyMove — compute the post-move state                            */
/* ------------------------------------------------------------------ */

/**
 * Apply a Move action to produce the resulting GameState.
 *
 * Does NOT handle:
 * - Turn transition (active player flip)
 * - Turncoat (Captain swaps)
 * - Terminal condition evaluation
 * - History recording
 *
 * Those are added in Step 10.
 *
 * @param state - The current GameState.
 * @param action - The validated Move action.
 * @returns The new GameState after applying the move.
 */
export function applyMove(state: GameState, action: MoveAction): GameState {
  const newState = cloneState(state);
  const { origin, dest, outcome } = action;

  // 1. Detach top piece from origin
  const originStack = getStack(newState.position, origin);
  if (!originStack) return newState; // should not happen — caller validates first
  const { newStack: updatedOrigin, piece: movingPiece } = detachTop(originStack);
  newState.position = setStack(newState.position, origin, updatedOrigin);

  // 2. Resolve destination
  const targetStack = getStack(newState.position, dest);

  if (targetStack === null) {
    // Empty square — place piece alone
    newState.position = setStack(newState.position, dest, createStack([movingPiece]));
  } else if (
    outcome === 'capture' ||
    (outcome === null && topPiece(targetStack).owner !== movingPiece.owner)
  ) {
    // Capture: outcome is either explicit 'capture', or null with enemy-topped target
    // (null on enemy-topped target means capture is forced — validated by validateOutcome).
    // Remove enemy pieces, keep friendly, then add moving piece on top.
    const remaining = removeEnemyPieces(targetStack, movingPiece.owner);
    if (remaining === null) {
      newState.position = setStack(newState.position, dest, createStack([movingPiece]));
    } else {
      const pieces = [...remaining, movingPiece];
      newState.position = setStack(newState.position, dest, createStack(pieces));
    }
  } else {
    // Stack: moving piece becomes new top (friendly-topped target, or outcome='stack')
    const pieces = [...targetStack, movingPiece];
    newState.position = setStack(newState.position, dest, createStack(pieces));
  }

  return newState;
}

/* ------------------------------------------------------------------ */
/*  applyArata — compute the post-arata state                          */
/* ------------------------------------------------------------------ */

/**
 * Apply an Arata action to produce the resulting GameState.
 *
 * @param state - The current GameState.
 * @param action - The validated Arata action.
 * @returns The new GameState after applying the arata.
 */
export function applyArata(state: GameState, action: ArataAction): GameState {
  const newState = cloneState(state);
  const { piece, dest } = action;
  const player = newState.turn.activePlayer;
  const pieceObj: Piece = { type: piece, owner: player };

  // 1. Remove piece from hand
  newState.hands[player][piece]--;

  // 2. Place on destination
  const targetStack = getStack(newState.position, dest);

  if (targetStack === null) {
    newState.position = setStack(newState.position, dest, createStack([pieceObj]));
  } else {
    // Stack on top of friendly stack (validated already)
    const pieces = [...targetStack, pieceObj];
    newState.position = setStack(newState.position, dest, createStack(pieces));
  }

  return newState;
}
