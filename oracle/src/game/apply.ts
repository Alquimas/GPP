/**
 * Action application functions for the Gungi game engine.
 *
 * Step 8 (Self Check scaffolding): applyMove, applyArata — minimal speculative
 *   state computation.
 * Step 9 (Deploy Phase): applyPlacement — full placement with turn management
 *   and deploy→battle transition.
 * Step 10 (Battle Phase): planned replacement of applyMove/applyArata with
 *   full turn management.
 *
 * @module
 */

import type { Action, GameResult, GameState, Hand, Piece, Player, PieceType } from '../types.js';
import { createStack, getStack, setStack, topPiece } from '../board/board.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { evaluateExposure } from './terminal.js';

/* ------------------------------------------------------------------ */
/*  ApplyResult — return type for state-mutating apply functions       */
/* ------------------------------------------------------------------ */

/**
 * The result of applying an action to a GameState.
 * - `state`: the resulting GameState after the action.
 * - `result`: the GameResult (ongoing, or terminal if the action ended the game).
 */
export type ApplyResult = { state: GameState; result: GameResult };

/* ------------------------------------------------------------------ */
/*  Type aliases (using Extract for clarity over intersection types)   */
/* ------------------------------------------------------------------ */

/** The Placement variant of the Action discriminated union. */
type PlacementAction = Extract<Action, { kind: 'placement' }>;

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
      row.map((cell) => (cell === null ? null : ([...cell] as typeof cell))),
    ),
    turn: { ...state.turn },
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
/*  Internal helpers for turn management                               */
/* ------------------------------------------------------------------ */

/** Return the opponent of a player. */
function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

/** Check if a player's hand is completely empty (all piece types at count 0). */
function isHandEmpty(hand: Hand): boolean {
  return ALL_PIECE_TYPES.every((pt: PieceType) => hand[pt] === 0);
}

/* ------------------------------------------------------------------ */
/*  applyPlacement — full deploy-phase placement                       */
/* ------------------------------------------------------------------ */

/**
 * Apply a validated Placement action to the current GameState.
 *
 * Handles:
 * 1. Deduct piece from the active player's hand
 * 2. Place piece on the destination square (empty or friendly stack)
 * 3. Advance turn counter
 * 4. Handle Done declaration (BR-DEPLOY-007/008):
 *    - If current player declares Done, set their done flag
 *    - If both players Done → end Deploy Phase → evaluate Exposure (BR-DEPLOY-012)
 *    - Otherwise, swap active player (BR-DEPLOY-002)
 * 5. If a player's hand becomes empty after placement, they are automatically Done
 *
 * Marshal-first enforcement is handled by validatePlacement (Step 8) and
 * is not re-checked here.
 *
 * @param state - The current GameState (must be Deploy Phase).
 * @param action - A validated Placement action.
 * @returns ApplyResult with the new state and game result.
 */
export function applyPlacement(state: GameState, action: PlacementAction): ApplyResult {
  const newState: GameState = cloneState(state);
  const { piece, dest, done: declaredDone } = action;
  const player = newState.turn.activePlayer;
  const pieceObj: Piece = { type: piece, owner: player };

  // 1. Deduct piece from hand
  newState.hands[player][piece]--;

  // 2. Place piece on board
  const targetStack = getStack(newState.position, dest);
  if (targetStack === null) {
    newState.position = setStack(newState.position, dest, createStack([pieceObj]));
  } else {
    // Friendly stack (already validated in Step 8), append to top
    const pieces = [...targetStack, pieceObj];
    newState.position = setStack(newState.position, dest, createStack(pieces));
  }

  // 3. Advance turn counter
  newState.turn.counter++;

  // 4. Handle Done declaration and turn management
  const playerDone = declaredDone || isHandEmpty(newState.hands[player]);

  if (playerDone) {
    // Current player is done — check if opponent is already done
    if (newState.turn.done !== null) {
      // Opponent already done → both done → Deploy Phase ends
      const result = evaluateExposure(newState.position);
      if (result.kind === 'ongoing') {
        // No exposure — transition to Battle Phase (BR-DEPLOY-010)
        newState.turn = {
          phase: 'battle',
          activePlayer: 'white',
          done: null,
          counter: 1,
        };
      }
      // If exposure triggered, state stays as deploy-final snapshot; result carries the terminal
      return { state: newState, result };
    }

    // Opponent not done yet — mark current player done, give turn to opponent
    newState.turn.done = player;
    newState.turn.activePlayer = opponent(player);
  } else {
    // Player did NOT declare Done
    if (newState.turn.done !== null) {
      // Opponent already done → non-done player keeps the turn
      // (activePlayer already is this player, so no change needed)
    } else {
      // No done yet — alternate (BR-DEPLOY-002)
      newState.turn.activePlayer = opponent(player);
    }
  }

  return { state: newState, result: { kind: 'ongoing' as const } };
}

/* ------------------------------------------------------------------ */
/*  applyMove — compute the post-move state                            */
/* ------------------------------------------------------------------ */

/**
 * Apply a Move action to produce the resulting GameState.
 *
 * @internal Step-8 scaffolding. Step 10 replaces this with full turn management.
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
 * @returns The new GameState after applying the move.  WARNING: this is a
 *   SPECULATIVE state — it is missing turn transition, turncoat, terminal
 *   conditions, and history.  See `PlayValidation.speculativeState`.
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
 * @internal Step-8 scaffolding. Step 10 replaces this with full turn management.
 *
 * @param state - The current GameState.
 * @param action - The validated Arata action.
 * @returns The new GameState after applying the arata.  WARNING: this is a
 *   SPECULATIVE state — it is missing turn transition, turncoat, terminal
 *   conditions, and history.  See `PlayValidation.speculativeState`.
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
