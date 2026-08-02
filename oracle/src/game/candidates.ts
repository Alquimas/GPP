import type { Action, GameState, TurncoatLevels } from '../types.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { getStack, squareFromIndex, topPiece, trySquare } from '../board/board.js';
import { getLegalDestinations } from '../board/movement.js';

const TURNCOAT_OPTIONS: TurncoatLevels[] = [[], [1], [2], [1, 2]];

/** Generate every plausible Placement. Legality is decided elsewhere. */
export function placementCandidates(state: GameState): Action[] {
  const candidates: Action[] = [];
  const hand = state.hands[state.turn.activePlayer];

  for (const piece of ALL_PIECE_TYPES) {
    if (hand[piece] < 1) continue;

    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const dest = trySquare(col, row);
        if (dest === null) continue;
        // One candidate per (piece, dest). Done is a standalone Action and is
        // added separately by the engine's legalActions().
        candidates.push({ kind: 'placement', piece, dest });
      }
    }
  }

  return candidates;
}

/** Generate every plausible Move and Arata. Legality is decided elsewhere. */
export function playCandidates(state: GameState): Action[] {
  const candidates: Action[] = [];
  const player = state.turn.activePlayer;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const stack = state.position[row][col];
      if (stack === null || topPiece(stack).owner !== player) continue;

      const origin = squareFromIndex(row, col);
      const piece = topPiece(stack);

      for (const move of getLegalDestinations(state.position, origin, player)) {
        const outcomes: Array<'stack' | 'capture' | null> =
          move.outcome === 'stack' ? ['stack', 'capture'] : [null];
        const target = getStack(state.position, move.dest);
        const isStacking =
          move.outcome === 'stack' ||
          (move.outcome === null && target !== null && topPiece(target).owner === player);

        for (const outcome of outcomes) {
          const turncoats =
            piece.type === 'T' && isStacking && outcome !== 'capture'
              ? TURNCOAT_OPTIONS
              : [[] as TurncoatLevels];

          for (const turncoat of turncoats) {
            candidates.push({
              kind: 'move',
              origin,
              dest: move.dest,
              outcome,
              turncoat: [...turncoat],
            });
          }
        }
      }
    }
  }

  const hand = state.hands[player];
  for (const piece of ALL_PIECE_TYPES) {
    if (hand[piece] < 1) continue;

    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const dest = trySquare(col, row);
        if (dest === null) continue;
        const turncoats = piece === 'T' ? TURNCOAT_OPTIONS : [[] as TurncoatLevels];

        for (const turncoat of turncoats) {
          candidates.push({
            kind: 'arata',
            piece,
            dest,
            turncoat: [...turncoat],
          });
        }
      }
    }
  }

  return candidates;
}
