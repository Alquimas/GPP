/**
 * GSFEN serializer — converts a GameState into a canonical GSFEN string.
 *
 * The output is always canonical (BR-GSFEN-CANON-001–007 compliant):
 * - BR-GSFEN-CANON-002: exactly 9 squares per row
 * - BR-GSFEN-CANON-003: empty runs maximally merged (no adjacent digit items)
 * - BR-GSFEN-CANON-004: stack letters bottom→top, case encodes ownership
 * - BR-GSFEN-CANON-005: hands alphabetical within each section, counts omitted when 1
 * - BR-GSFEN-CANON-006: no leading zeros on counter
 * - BR-GSFEN-CANON-007: `startpos` keyword is never emitted (always expanded)
 *
 * @module
 */

import { type GameState, type PieceType, type Position, type TurnState } from '../types.js';
import { ALL_PIECE_TYPES } from '../constants.js';

// ---------------------------------------------------------------------------
// Field serializers
// ---------------------------------------------------------------------------

/**
 * Serialize the Position field.
 *
 * Internal representation: position[row][col], row 0 = Row 1 (topmost),
 * col 0 = Col 1 (rightmost).
 *
 * GSFEN representation: Row 1 through Row 9 separated by `/`.
 * Within each row, comma-separated items covering Columns 9 → 1
 * (left to right in Standard Diagram).
 */
function serializePosition(position: Position): string {
  const rows: string[] = [];

  for (let r = 0; r < 9; r++) {
    const items: string[] = [];
    let emptyRun = 0;

    // Walk columns from Col 9 (idx 8) to Col 1 (idx 0),
    // which is the GSFEN left-to-right order.
    for (let c = 8; c >= 0; c--) {
      const stack = position[r][c];
      if (stack === null) {
        emptyRun++;
      } else {
        // Flush accumulated empty run
        if (emptyRun > 0) {
          items.push(String(emptyRun));
          emptyRun = 0;
        }
        // Encode stack bottom→top (same as internal order)
        const letters = stack
          .map((p) => (p.owner === 'white' ? p.type : p.type.toLowerCase()))
          .join('');
        items.push(letters);
      }
    }

    // Flush trailing empty run
    if (emptyRun > 0) {
      items.push(String(emptyRun));
    }

    rows.push(items.join(','));
  }

  return rows.join('/');
}

/**
 * Serialize the Turn field.
 *
 * | Token | Phase      | Active | Done   |
 * |-------|------------|--------|--------|
 * | w     | battle     | white  | null   |
 * | b     | battle     | black  | null   |
 * | dw    | deploy     | white  | null   |
 * | db    | deploy     | black  | null   |
 * | dwB   | deploy     | white  | black  |
 * | dbW   | deploy     | black  | white  |
 */
function serializeTurn(turn: TurnState): string {
  const { phase, activePlayer, done } = turn;

  if (phase === 'battle') {
    return activePlayer === 'white' ? 'w' : 'b';
  }

  // Deploy phase
  if (done === null) {
    return activePlayer === 'white' ? 'dw' : 'db';
  }
  // A done flag exists — the non-active player has declared Done
  if (done === 'black') {
    return 'dwB'; // White places next, Black has declared Done
  }
  // done === 'white'
  return 'dbW'; // Black places next, White has declared Done
}

/**
 * Serialize the Hands field.
 *
 * BR-GSFEN-CANON-005: White's section precedes Black's. Letters alphabetical within each
 * section, each at most once. Counts omitted when 1 (count ≥ 2 prefixed).
 * `-` when both Hands are empty.
 */
function serializeHands(hands: {
  white: Record<PieceType, number>;
  black: Record<PieceType, number>;
}): string {
  const whiteEmpty = ALL_PIECE_TYPES.every((t) => hands.white[t] === 0);
  const blackEmpty = ALL_PIECE_TYPES.every((t) => hands.black[t] === 0);

  if (whiteEmpty && blackEmpty) {
    return '-';
  }

  let result = '';

  // White section (uppercase letters, alphabetical)
  for (const type of ALL_PIECE_TYPES) {
    const count = hands.white[type];
    if (count === 0) continue;
    if (count >= 2) result += String(count);
    result += type; // uppercase = white
  }

  // Black section (lowercase letters, alphabetical)
  for (const type of ALL_PIECE_TYPES) {
    const count = hands.black[type];
    if (count === 0) continue;
    if (count >= 2) result += String(count);
    result += type.toLowerCase(); // lowercase = black
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a GameState into a canonical GSFEN string.
 * Assumes the GameState is valid (passes validateState).
 * No validation is performed — invalid input produces invalid output.
 *
 * @param state - The GameState to serialize.
 * @returns A canonical GSFEN string (always expanded — never the `startpos` keyword).
 */
export function serializeGSFEN(state: GameState): string {
  const pos = serializePosition(state.position);
  const turn = serializeTurn(state.turn);
  const hands = serializeHands(state.hands);
  const counter = String(state.turn.counter);

  return `${pos} ${turn} ${hands} ${counter}`;
}
