/**
 * GSFEN serializer --- converts a GameState into a canonical GSFEN string.
 *
 * The output is always canonical (see GSFEN.md §Canonicalization):
 * - BR-GSFEN-CANON-POSITION-SQUARE-COUNT:    exactly 9 squares per row
 * - BR-GSFEN-CANON-POSITION-COMPRESSION:     empty runs maximally merged (no adjacent digit items)
 * - BR-GSFEN-CANON-POSITION-STACK-SPELLING:  stack letters bottom->top, case encodes ownership
 * - BR-GSFEN-CANON-HANDS-ALPHABETICAL:       hands alphabetical within each section, counts omitted when 1
 * - BR-GSFEN-CANON-HANDS-SECTION-ORDER:      White's section (uppercase) precedes Black's (lowercase)
 * - BR-GSFEN-CANON-HANDS-EMPTY-MARKER:       `-` when both Hands are empty
 * - BR-GSFEN-CANON-COUNTER-LEADING-ZERO:     no leading zeros on counter
 * - BR-GSFEN-CANON-KEYWORD-CASE:             `startpos` keyword is never emitted (always expanded)
 *
 * @module
 */

import {
  type GameState,
  type Hand,
  type PieceType,
  type Position,
  type TurnState,
} from '../types.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { GameError } from '../errors.js';
import { validatePosition } from '../board/board.js';

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
 * Within each row, comma-separated items covering Columns 9 -> 1
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
        // Encode stack bottom->top (same as internal order)
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
 *
 * The done flag is omitted when it is derivable: a player whose hand is
 * empty is done by rule (auto-Done after placing the last piece, GSFEN.md
 * §Turn), so the canonical token for that state is the plain `dw`/`db`.
 * The flag is emitted only for a genuine Done declaration, i.e. when the
 * done-flagged player still holds pieces in hand.
 */
function serializeTurn(turn: TurnState, hands: GameState['hands']): string {
  const { phase, activePlayer, done } = turn;

  if (phase === 'battle') {
    return activePlayer === 'white' ? 'w' : 'b';
  }

  // Deploy phase
  if (done === null) {
    return activePlayer === 'white' ? 'dw' : 'db';
  }
  // A done flag exists --- the non-active player is done. If their hand is
  // empty the flag is derivable (auto-Done), so it is omitted from the
  // canonical token.
  if (handIsEmpty(hands[done])) {
    return activePlayer === 'white' ? 'dw' : 'db';
  }
  // Genuine Done declaration --- the player still has pieces in hand.
  if (done === 'black') {
    return 'dwB'; // White places next, Black has declared Done
  }
  return 'dbW'; // Black places next, White has declared Done
}

/** True when every piece count in the hand is 0. */
function handIsEmpty(hand: Hand): boolean {
  return ALL_PIECE_TYPES.every((t) => hand[t] === 0);
}

/**
 * Serialize the Hands field.
 *
 * BR-GSFEN-CANON-HANDS-* rules:
 *   - EMPTY-MARKER:  `-` when both Hands are empty
 *   - SECTION-ORDER: White's section (uppercase) precedes Black's (lowercase)
 *   - ALPHABETICAL:  letters alphabetical within each section
 *   - DUPLICATE:     each letter at most once per section
 *   - COUNT-FORMAT:  counts omitted when 1 (count ≥ 2 prefixed)
 */
function serializeHands(hands: {
  white: Record<PieceType, number>;
  black: Record<PieceType, number>;
}): string {
  const whiteEmpty = handIsEmpty(hands.white);
  const blackEmpty = handIsEmpty(hands.black);

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
 *
 * The state must satisfy the serialization contract: a 9×9 Position, hand
 * counts that are integers 0–4, and a counter ≥ 1. Out-of-contract states
 * (which would otherwise crash with a raw TypeError or serialize to a
 * string the parser rejects) raise a GameError instead.
 *
 * @param state - The GameState to serialize.
 * @throws {GameError} with rule:
 *   - 'BR-GSFEN-CANON-POSITION-ROW-COUNT'   --- position has ≠ 9 rows
 *   - 'BR-GSFEN-CANON-POSITION-SQUARE-COUNT' --- a row has ≠ 9 squares
 *   - 'BR-GSFEN-VALID-002'                  --- hand count not an integer 0–4
 *   - 'BR-GSFEN-CANON-COUNTER-LEADING-ZERO' --- counter < 1 (same rule the parser reports)
 * @returns A canonical GSFEN string (always expanded --- never the `startpos` keyword).
 */
export function serializeGSFEN(state: GameState): string {
  // Position shape: a row shorter than 9 makes serializePosition crash on
  // undefined; report a GameError instead (BR-GSFEN-CANON-POSITION-*).
  try {
    validatePosition(state.position);
  } catch (e) {
    const msg = (e as Error).message;
    const rule = msg.includes('9 rows')
      ? 'BR-GSFEN-CANON-POSITION-ROW-COUNT'
      : 'BR-GSFEN-CANON-POSITION-SQUARE-COUNT';
    throw new GameError(`Cannot serialize position: ${msg} (${rule})`, rule);
  }

  // Hand counts: non-integer or out-of-range counts serialize to strings
  // the parser rejects (e.g. "1.5P", "5P"); a count > 4 can never satisfy
  // inventory conservation (BR-GSFEN-VALID-002).
  for (const player of ['white', 'black'] as const) {
    const hand = state.hands[player];
    for (const type of ALL_PIECE_TYPES) {
      const count = hand[type];
      if (!Number.isInteger(count) || count < 0 || count > 4) {
        throw new GameError(
          `Cannot serialize: ${player} hand count for ${type} is ${count} (must be an integer 0-4) (BR-GSFEN-VALID-002 --- inventory conservation)`,
          'BR-GSFEN-VALID-002',
        );
      }
    }
  }

  // Counter: 0 or negative serializes to a string the parser rejects
  // ("0" fails /^[1-9]\d*$/, reported as BR-GSFEN-CANON-COUNTER-LEADING-ZERO).
  if (!Number.isInteger(state.turn.counter) || state.turn.counter < 1) {
    throw new GameError(
      `Cannot serialize: turn counter must be a positive integer >= 1, got ${state.turn.counter} (BR-GSFEN-CANON-COUNTER-LEADING-ZERO)`,
      'BR-GSFEN-CANON-COUNTER-LEADING-ZERO',
    );
  }
  // Upper bound mirrors the parser's precision cap (parseCounter rejects
  // > 7 digits) so the writer never emits a string its own parser rejects.
  if (state.turn.counter > 9_999_999) {
    throw new GameError(
      `Cannot serialize: turn counter ${state.turn.counter} exceeds the 7-digit canonical limit (BR-GSFEN-CANON-COUNTER-LENGTH)`,
      'BR-GSFEN-CANON-COUNTER-LENGTH',
    );
  }

  const pos = serializePosition(state.position);
  const turn = serializeTurn(state.turn, state.hands);
  const hands = serializeHands(state.hands);
  const counter = String(state.turn.counter);

  return `${pos} ${turn} ${hands} ${counter}`;
}
