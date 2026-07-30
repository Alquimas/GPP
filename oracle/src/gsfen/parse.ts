/**
 * GSFEN parser — parses Gungi Stacking Forsyth-Edwards Notation strings
 * into GameState objects, validating canonical form.
 *
 * Canonical-form rules are organised by the field they constrain
 * (see GSFEN.md §Canonicalization):
 *   - BR-GSFEN-CANON-SEPARATOR-*   — field separation
 *   - BR-GSFEN-CANON-POSITION-*    — Position field
 *   - BR-GSFEN-CANON-TURN-*        — Turn field
 *   - BR-GSFEN-CANON-HANDS-*       — Hands field
 *   - BR-GSFEN-CANON-COUNTER-*     — Counter field
 *   - BR-GSFEN-CANON-KEYWORD-*     — startpos keyword
 *
 * @module
 */

import {
  type GameState,
  type Hand,
  type Phase,
  type Piece,
  type PieceType,
  type Player,
  type Position,
  type Stack,
  type TurnState,
} from '../types.js';
import { GameError } from '../errors.js';
import { EMPTY_HAND, START_GSFEN, ALL_PIECE_TYPES } from '../constants.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ParseResult = { ok: true; state: GameState } | { ok: false; error: GameError };

/**
 * Internal result type for individual field parsers.
 * Separated from ParseResult to avoid conflicting `.state` / `.value` shapes.
 */
type FieldResult<T> = { ok: true; value: T } | { ok: false; error: GameError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_PIECE_SET = new Set<string>(ALL_PIECE_TYPES);

/** Safe cast: an already-validated piece letter → PieceType (centralises the unsafe cast). */
function isPieceType(ch: string): ch is PieceType {
  return VALID_PIECE_SET.has(ch);
}

/** Check if a character is a valid count digit (2–4). */
function isCountDigit(ch: string): boolean {
  return ch >= '2' && ch <= '4';
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

/**
 * Parse the Position field.
 *
 * GSFEN row items are written Col 9 → Col 1 (left to right in Standard
 * Diagram).  Our internal Position uses position[row][col-1] where col 1
 * = rightmost, so we reverse the mapping.
 *
 * Canonical-form rules enforced (GSFEN.md §Canonicalization → Position rules):
 *   - BR-GSFEN-CANON-POSITION-ROW-COUNT     — exactly 9 rows
 *   - BR-GSFEN-CANON-POSITION-SQUARE-COUNT   — each row sums to 9 squares
 *   - BR-GSFEN-CANON-POSITION-COMPRESSION    — no adjacent empty-run items
 *   - BR-GSFEN-CANON-POSITION-STACK-SPELLING — valid piece letters, stack depth 1–3
 *   - BR-GSFEN-CANON-POSITION-EMPTY-ITEM     — no bare commas or empty segments
 */
function parsePosition(posStr: string): FieldResult<Position> {
  const rows = posStr.split('/');

  // BR-GSFEN-CANON-POSITION-ROW-COUNT: exactly 9 rows
  if (rows.length !== 9) {
    return {
      ok: false,
      error: new GameError(
        `Position field must have exactly 9 rows (slashes), got ${rows.length}`,
        'BR-GSFEN-CANON-POSITION-ROW-COUNT',
      ),
    };
  }

  const position: Position = [];

  for (let r = 0; r < 9; r++) {
    const rowStr = rows[r];
    if (rowStr === '') {
      return {
        ok: false,
        error: new GameError(`Row ${r + 1} is empty`, 'BR-GSFEN-CANON-POSITION-EMPTY-ITEM'),
      };
    }

    const items = rowStr.split(',');
    // Start from the rightmost column index (Col 9 → idx 8) and work left.
    let pos = 8;
    let prevWasDigit = false;
    const row: (Stack | null)[] = new Array<Stack | null>(9).fill(null);

    for (const item of items) {
      if (item === '') {
        return {
          ok: false,
          error: new GameError(`Empty item in row ${r + 1}`, 'BR-GSFEN-CANON-POSITION-EMPTY-ITEM'),
        };
      }

      // --- Empty run: a single digit 1-9 ---
      if (/^[1-9]$/.test(item)) {
        // BR-GSFEN-CANON-POSITION-COMPRESSION: No adjacent empty runs
        if (prevWasDigit) {
          return {
            ok: false,
            error: new GameError(
              `Row ${r + 1}: adjacent empty-run items must be merged (BR-GSFEN-CANON-POSITION-COMPRESSION) — write 5, not 4,1`,
              'BR-GSFEN-CANON-POSITION-COMPRESSION',
            ),
          };
        }
        const count = parseInt(item, 10);
        for (let i = 0; i < count; i++) {
          if (pos < 0) {
            return {
              ok: false,
              error: new GameError(
                `Row ${r + 1} exceeds 9 squares`,
                'BR-GSFEN-CANON-POSITION-SQUARE-COUNT',
              ),
            };
          }
          row[pos] = null;
          pos--;
        }
        prevWasDigit = true;
        continue;
      }

      // --- Stack: 1-3 piece letters ---
      prevWasDigit = false;

      // BR-GSFEN-CANON-POSITION-STACK-SPELLING: stack depth 1–3 (defence-in-depth, BR-STACK-001)
      if (item.length < 1 || item.length > 3) {
        return {
          ok: false,
          error: new GameError(
            `Stack must have 1-3 pieces in row ${r + 1}, got "${item}" (BR-GSFEN-CANON-POSITION-STACK-SPELLING)`,
            'BR-GSFEN-CANON-POSITION-STACK-SPELLING',
          ),
        };
      }

      const pieces: Piece[] = [];
      for (const ch of item) {
        const upper = ch.toUpperCase();
        if (!isPieceType(upper)) {
          return {
            ok: false,
            error: new GameError(
              `Unknown piece letter "${ch}" in row ${r + 1} (BR-GSFEN-CANON-POSITION-STACK-SPELLING)`,
              'BR-GSFEN-CANON-POSITION-STACK-SPELLING',
            ),
          };
        }
        const owner: Player = ch === upper ? 'white' : 'black';
        pieces.push({ type: upper, owner });
      }
      // SAFETY: the cast is safe because `item.length` was validated to be
      // in 1..3 at the top of this branch (see the `item.length < 1 || item.length > 3`
      // guard above).  Each character produces exactly one Piece, so
      // `pieces.length === item.length ∈ {1,2,3}`, satisfying the Stack
      // tuple type.
      const stack = pieces as Stack;

      if (pos < 0) {
        return {
          ok: false,
          error: new GameError(
            `Row ${r + 1} exceeds 9 squares`,
            'BR-GSFEN-CANON-POSITION-SQUARE-COUNT',
          ),
        };
      }
      row[pos] = stack;
      pos--;
    }

    // BR-GSFEN-CANON-POSITION-SQUARE-COUNT: verify exactly 9 squares
    if (pos !== -1) {
      return {
        ok: false,
        error: new GameError(
          `Row ${r + 1} has fewer than 9 squares (row total does not sum to 9) (BR-GSFEN-CANON-POSITION-SQUARE-COUNT)`,
          'BR-GSFEN-CANON-POSITION-SQUARE-COUNT',
        ),
      };
    }

    position.push(row);
  }

  return { ok: true, value: position };
}

/**
 * Parse the Turn field.
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
 * Canonical-form rule enforced (GSFEN.md §Canonicalization → Turn rules):
 *   - BR-GSFEN-CANON-TURN-TOKEN — must be one of the six valid tokens
 */
function parseTurn(turnStr: string): FieldResult<TurnState> {
  let phase: Phase;
  let activePlayer: Player;
  let done: Player | null;

  switch (turnStr) {
    case 'w':
      phase = 'battle';
      activePlayer = 'white';
      done = null;
      break;
    case 'b':
      phase = 'battle';
      activePlayer = 'black';
      done = null;
      break;
    case 'dw':
      phase = 'deploy';
      activePlayer = 'white';
      done = null;
      break;
    case 'db':
      phase = 'deploy';
      activePlayer = 'black';
      done = null;
      break;
    case 'dwB':
      phase = 'deploy';
      activePlayer = 'white';
      done = 'black';
      break;
    case 'dbW':
      phase = 'deploy';
      activePlayer = 'black';
      done = 'white';
      break;
    default:
      return {
        ok: false,
        error: new GameError(
          `Invalid turn token "${turnStr}" (BR-GSFEN-CANON-TURN-TOKEN) — must be one of: w, b, dw, db, dwB, dbW`,
          'BR-GSFEN-CANON-TURN-TOKEN',
        ),
      };
  }

  // Counter will be set from field 4 after parsing
  return {
    ok: true,
    value: { phase, activePlayer, done, counter: 0 },
  };
}

/**
 * Parse the Hands field.
 *
 * Format: `-` when both empty, otherwise White (uppercase, alphabetical,
 * with optional count 2-4) followed by Black (lowercase, alphabetical).
 *
 * Canonical-form rules enforced (GSFEN.md §Canonicalization → Hand rules):
 *   - BR-GSFEN-CANON-HANDS-EMPTY-MARKER    — `-` when both empty
 *   - BR-GSFEN-CANON-HANDS-SECTION-ORDER   — White (uppercase) before Black (lowercase)
 *   - BR-GSFEN-CANON-HANDS-ALPHABETICAL    — letters alphabetical within each section
 *   - BR-GSFEN-CANON-HANDS-DUPLICATE       — each letter at most once per section
 *   - BR-GSFEN-CANON-HANDS-COUNT-FORMAT    — counts 2–4, omitted when 1
 *   - BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR — no stray characters
 */
function parseHands(handsStr: string): FieldResult<{ white: Hand; black: Hand }> {
  if (handsStr === '-') {
    return { ok: true, value: { white: EMPTY_HAND, black: EMPTY_HAND } };
  }

  if (handsStr === '') {
    return {
      ok: false,
      error: new GameError(
        'Hands field is empty; use "-" when both hands are empty',
        'BR-GSFEN-CANON-HANDS-EMPTY-MARKER',
      ),
    };
  }

  const white: Hand = { ...EMPTY_HAND };
  const black: Hand = { ...EMPTY_HAND };
  let i = 0;
  let blackSectionStarted = false;
  const lastLetter: Record<Player, string> = { white: '', black: '' };

  while (i < handsStr.length) {
    let count = 1;
    const countChar = handsStr[i];
    if (/^\d$/.test(countChar)) {
      if (!isCountDigit(countChar) || i + 1 >= handsStr.length) {
        return {
          ok: false,
          error: new GameError(
            `Invalid hand count at position ${i}; counts must be 2-4 and precede a piece`,
            'BR-GSFEN-CANON-HANDS-COUNT-FORMAT',
          ),
        };
      }
      count = Number(countChar);
      i++;
    }

    const letter = handsStr[i];
    const upper = letter?.toUpperCase() ?? '';
    if (!isPieceType(upper)) {
      return {
        ok: false,
        error: new GameError(
          `Unexpected hand character "${letter ?? ''}" at position ${i}`,
          'BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR',
        ),
      };
    }

    const player: Player = letter === upper ? 'white' : 'black';
    if (player === 'black') blackSectionStarted = true;
    if (player === 'white' && blackSectionStarted) {
      return {
        ok: false,
        error: new GameError(
          'White hand pieces must appear before Black hand pieces',
          'BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR',
        ),
      };
    }

    const type = upper;
    const hand = player === 'white' ? white : black;
    if (hand[type] > 0) {
      return {
        ok: false,
        error: new GameError(
          `Duplicate ${player} hand piece "${letter}"`,
          'BR-GSFEN-CANON-HANDS-DUPLICATE',
        ),
      };
    }

    if (lastLetter[player] !== '' && upper <= lastLetter[player]) {
      return {
        ok: false,
        error: new GameError(
          `${player} hand pieces are not in alphabetical order`,
          'BR-GSFEN-CANON-HANDS-ALPHABETICAL',
        ),
      };
    }

    hand[type] = count;
    lastLetter[player] = upper;
    i++;
  }

  return { ok: true, value: { white, black } };
}

/**
 * Parse the counter field.
 * Must be a positive integer with no leading zeros.
 *
 * Canonical-form rules enforced (GSFEN.md §Canonicalization → Counter rules):
 *   - BR-GSFEN-CANON-COUNTER-LEADING-ZERO — no leading zeros
 *   - BR-GSFEN-CANON-COUNTER-POSITIVE     — must be ≥ 1 (parser regex guarantees this)
 */
function parseCounter(counterStr: string): FieldResult<number> {
  // BR-GSFEN-CANON-COUNTER-LEADING-ZERO + BR-GSFEN-CANON-COUNTER-POSITIVE:
  // The regex /^[1-9]\d*$/ rejects both leading zeros and zero/negative values.
  if (!/^[1-9]\d*$/.test(counterStr)) {
    return {
      ok: false,
      error: new GameError(
        `Counter must be a positive integer (no leading zeros), got "${counterStr}" (BR-GSFEN-CANON-COUNTER-LEADING-ZERO / BR-GSFEN-CANON-COUNTER-POSITIVE)`,
        'BR-GSFEN-CANON-COUNTER-LEADING-ZERO',
      ),
    };
  }

  const n = parseInt(counterStr, 10);

  return { ok: true, value: n };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a GSFEN string into a GameState.
 *
 * Accepts the `startpos` keyword (expanded to START_GSFEN) and full 4-field
 * GSFEN strings.  Returns a ParseResult — on success the GameState is
 * well-formed (canonical form satisfied) but not necessarily semantically
 * valid (see `validateState`).
 *
 * Canonical-form rules enforced (GSFEN.md §Canonicalization):
 *   - BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT — exactly 4 fields
 *   - BR-GSFEN-CANON-SEPARATOR-WHITESPACE  — single-space separation, no embedded whitespace
 *   - BR-GSFEN-CANON-KEYWORD-CASE          — `startpos` is lowercase and exact
 *
 * @param input - Raw GSFEN string to parse.
 */
export function parseGSFEN(input: string): ParseResult {
  // BR-GSFEN-CANON-KEYWORD-CASE: startpos keyword (lowercase, exact)
  if (input === 'startpos') {
    return parseGSFEN(START_GSFEN);
  }

  // BR-GSFEN-CANON-SEPARATOR-WHITESPACE: No leading or trailing whitespace
  if (input !== input.trim()) {
    return {
      ok: false,
      error: new GameError(
        'GSFEN must not have leading or trailing whitespace (BR-GSFEN-CANON-SEPARATOR-WHITESPACE) — trim the string',
        'BR-GSFEN-CANON-SEPARATOR-WHITESPACE',
      ),
    };
  }

  // BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT: Fields separated by exactly one space (U+0020).
  // Using split on single space — multi-space segments produce empty strings,
  // which makes the resulting array longer than 4.
  const parts = input.split(' ');
  if (parts.length !== 4) {
    return {
      ok: false,
      error: new GameError(
        `GSFEN must have exactly 4 single-space-separated fields (BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT), got ${parts.length} segments — format: <position> <turn> <hands> <counter>`,
        'BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT',
      ),
    };
  }

  // BR-GSFEN-CANON-SEPARATOR-WHITESPACE: No non-space whitespace characters (tabs, etc.)
  for (const p of parts) {
    if (/\s/.test(p)) {
      return {
        ok: false,
        error: new GameError(
          'GSFEN fields must not contain tabs or other whitespace (BR-GSFEN-CANON-SEPARATOR-WHITESPACE) — use single spaces only',
          'BR-GSFEN-CANON-SEPARATOR-WHITESPACE',
        ),
      };
    }
  }

  const [posStr, turnStr, handsStr, counterStr] = parts;

  // Parse position
  const posResult = parsePosition(posStr);
  if (!posResult.ok) return posResult;

  // Parse turn
  const turnResult = parseTurn(turnStr);
  if (!turnResult.ok) return turnResult;

  // Parse hands
  const handsResult = parseHands(handsStr);
  if (!handsResult.ok) return handsResult;

  // Parse counter
  const counterResult = parseCounter(counterStr);
  if (!counterResult.ok) return counterResult;

  // Assemble the final TurnState with the parsed counter
  const turn: TurnState = {
    ...turnResult.value,
    counter: counterResult.value,
  };

  return {
    ok: true,
    state: {
      position: posResult.value,
      turn,
      hands: handsResult.value,
    },
  };
}
