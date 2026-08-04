/**
 * Action application functions for the Gungi game engine.
 *
 * These functions assume their Action has already been validated.
 * They are deliberately unaware of history and terminal conditions.
 *
 * @module
 */

import type {
  Action,
  GameState,
  Hand,
  Piece,
  Player,
  PieceType,
  Stack,
  TurncoatLevels,
} from '../types.js';
import { createStack, getStack, setStack, stackSize, topPiece } from '../board/board.js';
import { ALL_PIECE_TYPES } from '../constants.js';

/** Placement transition plus a signal that both players are Done. */
export type PlacementResult = { state: GameState; deployEnded: boolean };

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
  if (!stack) throw new Error('detachTop called on null stack --- caller must validate first');
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
/*  applyPlacement --- full deploy-phase placement                       */
/* ------------------------------------------------------------------ */

/**
 * Apply a validated Placement action to the current GameState.
 *
 * Handles:
 * 1. Deduct piece from the active player's hand
 * 2. Place piece on the destination square (empty or friendly stack)
 * 3. Advance turn counter
 * 4. Auto-Done when the player's hand empties (derived per GSFEN --- the
 *    player is done with deploying; NOT a Done declaration)
 * 5. Turn management (BR-DEPLOY-002):
 *    - If the player is auto-Done and the opponent is already Done -> signal
 *      the Deploy Phase boundary
 *    - Otherwise, swap active player (BR-DEPLOY-002), except when the
 *      opponent is already Done and this player keeps placing
 *
 * Marshal-first enforcement is handled by validatePlacement and
 * is not re-checked here.
 *
 * @param state - The current GameState (must be Deploy Phase).
 * @param action - A validated Placement action.
 * @returns The new state and whether both players are Done.
 */
export function applyPlacement(state: GameState, action: PlacementAction): PlacementResult {
  const newState: GameState = cloneState(state);
  const { piece, dest } = action;
  const player = newState.turn.activePlayer;
  const pieceObj: Piece = { type: piece, owner: player };

  // 1. Deduct piece from hand
  newState.hands[player][piece]--;

  // 2. Place piece on board
  const targetStack = getStack(newState.position, dest);
  if (targetStack === null) {
    newState.position = setStack(newState.position, dest, createStack([pieceObj]));
  } else {
    // Friendly stack (already validated), append to top
    const pieces = [...targetStack, pieceObj];
    newState.position = setStack(newState.position, dest, createStack(pieces));
  }

  // 3. Advance turn counter
  newState.turn.counter++;

  // 4. Auto-Done when the hand empties (derived, not a Done declaration)
  const playerDone = isHandEmpty(newState.hands[player]);

  // 5. Turn management
  if (playerDone) {
    // Current player is done --- check if opponent is already done. "Done"
    // is derived from an empty hand (GSFEN canonical form omits the flag),
    // so a reloaded state without the flag still behaves identically.
    const opponentDone = newState.turn.done !== null || isHandEmpty(newState.hands[opponent(player)]);
    if (opponentDone) {
      // Opponent already done -> both done. The engine evaluates Exposure
      // before deciding whether the Battle Phase starts.
      return { state: newState, deployEnded: true };
    }

    // Opponent not done yet --- mark current player done, give turn to opponent
    newState.turn.done = player;
    newState.turn.activePlayer = opponent(player);
  } else {
    // Player is NOT done
    const opponentDone = newState.turn.done !== null || isHandEmpty(newState.hands[opponent(player)]);
    if (opponentDone) {
      // Opponent already done -> non-done player keeps the turn
      // (activePlayer already is this player, so no change needed)
    } else {
      // No done yet --- alternate (BR-DEPLOY-002)
      newState.turn.activePlayer = opponent(player);
    }
  }

  return { state: newState, deployEnded: false };
}

/**
 * Apply a standalone Done Action to the current GameState.
 *
 * Done ends the declaring player's deploying (BR-DEPLOY-007): it sets their
 * GSFEN Done flag, changes NO position and NO hands, and does NOT advance the
 * turn counter (GSFEN Field 4 counts Placements only).
 *
 * - If the opponent already declared Done, both players are Done -> the
 *   Deploy Phase boundary is signaled (deployEnded).
 * - Otherwise the turn passes to the opponent (BR-DEPLOY-002).
 *
 * @param state - The current GameState (must be Deploy Phase, validated).
 * @returns The new state and whether both players are Done.
 */
export function applyDone(state: GameState): PlacementResult {
  const newState: GameState = cloneState(state);
  const player = newState.turn.activePlayer;

  // Set the GSFEN Done flag; no position/hands/counter changes.
  newState.turn.done = player;

  if (state.turn.done !== null || isHandEmpty(state.hands[opponent(player)])) {
    // Opponent already done -> both done -> Deploy Phase boundary.
    return { state: newState, deployEnded: true };
  }

  // Pass the turn to the opponent.
  newState.turn.activePlayer = opponent(player);
  return { state: newState, deployEnded: false };
}

/* ------------------------------------------------------------------ */
/*  applyMove --- compute the post-move state                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Turncoat swap helper (BR-STACK-006)                                */
/* ------------------------------------------------------------------ */

/**
 * Apply Turncoat swaps to a stack and hand.
 *
 * For each elected level:
 * 1. The enemy piece at that level is removed from the game.
 * 2. A friendly piece of the same type is taken from hand and placed
 *    at that level.
 *
 * The caller guarantees (via validation) that:
 * - Each level is occupied by an enemy piece.
 * - The hand contains a matching piece type for each swap.
 *
 * Levels are processed in ascending order (bottom->top). Swapping a
 * lower level does not shift higher-level positions because each
 * replacement is in-place.
 *
 * @param stack    - The post-move/post-arata stack (Captain already on top).
 * @param levels   - Elected turncoat levels (validated before calling).
 * @param hand     - The player's hand (will be mutated).
 * @param player   - The player performing the swaps.
 * @returns The modified stack and hand.
 */
function applyTurncoatSwaps(
  stack: Stack,
  levels: TurncoatLevels,
  hand: Hand,
  player: Player,
): { stack: Stack; hand: Hand } {
  const newStack = [...stack] as Piece[];
  const newHand: Hand = { ...hand };

  for (const level of levels) {
    const idx = level - 1; // 0-indexed from bottom
    const enemyPiece = newStack[idx];
    // Validated before: enemyPiece exists and belongs to opponent
    newStack[idx] = { type: enemyPiece.type, owner: player };
    newHand[enemyPiece.type]--;
    // Defensive: validation accounts for all elected levels cumulatively;
    // never allow the hand ledger to go negative (would corrupt material).
    const remaining = newHand[enemyPiece.type];
    if (!Number.isInteger(remaining) || remaining < 0) {
      throw new Error(
        `Turncoat swap would overdraw ${player}'s hand (${enemyPiece.type} = ${remaining}) --- validation bug`,
      );
    }
  }

  return { stack: createStack(newStack), hand: newHand };
}

/* ------------------------------------------------------------------ */
/*  applyMove --- full battle-phase state transition                     */
/* ------------------------------------------------------------------ */

/**
 * Apply a validated Move action to the current GameState.
 *
 * Performs (in order):
 * 1. Detach top piece from origin stack.
 * 2. Resolve outcome (Capture or Stack) per BR-STACK/BR-CAPTURE.
 * 3. Apply Turncoat swaps (BR-STACK-006) if elected.
 * 4. Flip active player (BR-TURN-002).
 * 5. Increment turn counter.
 *
 * Terminal-condition evaluation and history recording are handled by
 * the pure game engine, not here.
 *
 * @param state  - The current GameState (pre-validated).
 * @param action - The validated Move action.
 * @returns The new GameState.
 */
export function applyMove(state: GameState, action: MoveAction): GameState {
  const newState = cloneState(state);
  const { origin, dest, outcome } = action;
  const player = newState.turn.activePlayer;

  // 1. Detach top piece from origin
  const originStack = getStack(newState.position, origin);
  if (!originStack) {
    throw new Error('applyMove requires a validated action with an occupied origin');
  }
  const { newStack: updatedOrigin, piece: movingPiece } = detachTop(originStack);
  newState.position = setStack(newState.position, origin, updatedOrigin);

  // 2. Resolve destination
  const targetStack = getStack(newState.position, dest);

  let destStack: Stack | null;

  if (targetStack === null) {
    // Empty square --- place piece alone
    destStack = createStack([movingPiece]);
  } else if (outcome === 'capture') {
    // Capture with an explicit outcome token (validated: a choice existed).
    // Remove enemy pieces, keep friendly, then add moving piece on top.
    const remaining = removeEnemyPieces(targetStack, movingPiece.owner);
    if (remaining === null) {
      destStack = createStack([movingPiece]);
    } else {
      const pieces = [...remaining, movingPiece];
      destStack = createStack(pieces);
    }
  } else if (outcome === null && topPiece(targetStack).owner !== movingPiece.owner) {
    // Canonical forced capture (GAN.md: the outcome token is OMITTED for
    // forced outcomes; candidates.ts normalizes forced captures to null).
    // This mirrors validateOutcome's forced-capture classification: a null
    // outcome on an enemy top can only reach applyMove through a validated
    // action when the capture is forced --- enemy target at max size (3) or
    // source stack size < target stack size.
    const targetSize = stackSize(targetStack);
    if (targetSize < 3 && targetSize <= originStack.length) {
      // Neither forced-capture condition holds --- this is a capture the
      // validator would have required an explicit outcome token for. Never
      // silently capture; fail loudly (matches this module's throw style).
      throw new Error(
        `applyMove requires a validated action: null outcome on an enemy top must be a forced capture (target size 3 or source < target); got target size ${targetSize}, source size ${originStack.length}`,
      );
    }
    // Capture: remove enemy pieces, keep friendly, then add moving piece on top
    const remaining = removeEnemyPieces(targetStack, movingPiece.owner);
    if (remaining === null) {
      destStack = createStack([movingPiece]);
    } else {
      const pieces = [...remaining, movingPiece];
      destStack = createStack(pieces);
    }
  } else {
    // Stack: moving piece becomes new top
    const pieces = [...targetStack, movingPiece];

    // 3. Turncoat swaps (BR-STACK-006) --- only for Stack outcome
    if (movingPiece.type === 'T' && action.turncoat.length > 0) {
      const result = applyTurncoatSwaps(
        createStack(pieces),
        action.turncoat,
        newState.hands[player],
        player,
      );
      destStack = result.stack;
      newState.hands[player] = result.hand;
    } else {
      destStack = createStack(pieces);
    }
  }

  newState.position = setStack(newState.position, dest, destStack);

  // 4. Flip active player (BR-TURN-002)
  newState.turn.activePlayer = opponent(player);

  // 5. Increment turn counter
  newState.turn.counter++;

  return newState;
}

/* ------------------------------------------------------------------ */
/*  applyArata --- full battle-phase state transition                    */
/* ------------------------------------------------------------------ */

/**
 * Apply a validated Arata action to the current GameState.
 *
 * Performs (in order):
 * 1. Remove piece from hand.
 * 2. Place on destination (empty or friendly stack).
 * 3. Apply Turncoat swaps (BR-STACK-006) if elected.
 * 4. Flip active player (BR-TURN-002).
 * 5. Increment turn counter.
 *
 * @param state  - The current GameState (pre-validated).
 * @param action - The validated Arata action.
 * @returns The new GameState.
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
  let destStack: Stack;

  if (targetStack === null) {
    destStack = createStack([pieceObj]);
  } else {
    const pieces = [...targetStack, pieceObj];

    // 3. Turncoat swaps (BR-STACK-006)
    if (piece === 'T' && action.turncoat.length > 0) {
      const result = applyTurncoatSwaps(
        createStack(pieces),
        action.turncoat,
        newState.hands[player],
        player,
      );
      destStack = result.stack;
      newState.hands[player] = result.hand;
    } else {
      destStack = createStack(pieces);
    }
  }

  newState.position = setStack(newState.position, dest, destStack);

  // 4. Flip active player (BR-TURN-002)
  newState.turn.activePlayer = opponent(player);

  // 5. Increment turn counter
  newState.turn.counter++;

  return newState;
}
