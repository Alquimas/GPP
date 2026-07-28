/**
 * GSFEN parser — parses Gungi Stacking Forsyth-Edwards Notation strings
 * into GameState objects, validating canonical form (BR-GSFEN-CANON-001–007).
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

/** Check if a character is an uppercase piece letter — also narrows to PieceType. */
function isWhitePieceChar(ch: string): ch is PieceType {
  return ch >= 'A' && ch <= 'Z' && VALID_PIECE_SET.has(ch);
}

/** Check if a character is a lowercase piece letter. */
function isBlackPieceChar(ch: string): boolean {
  if (ch < 'a' || ch > 'z') return false;
  return VALID_PIECE_SET.has(ch.toUpperCase());
}

/** Convert a lowercase piece letter to a PieceType. Caller must validate via isBlackPieceChar first. */
function toUpperPieceType(ch: string): PieceType {
  return ch.toUpperCase() as PieceType;
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
 * @throws {GameError} with rule 'BR-GSFEN-CANON-001' if row count != 9, 'BR-GSFEN-CANON-002' if row doesn't sum to 9, 'BR-GSFEN-CANON-003' if empty runs not merged
 */
function parsePosition(posStr: string): FieldResult<Position> {
  const rows = posStr.split('/');

  // BR-GSFEN-CANON-001: exactly 9 rows
  if (rows.length !== 9) {
    return {
      ok: false,
      error: new GameError(
        `Position field must have exactly 9 rows (slashes), got ${rows.length}`,
        'BR-GSFEN-CANON-001',
      ),
    };
  }

  const position: Position = [];

  for (let r = 0; r < 9; r++) {
    const rowStr = rows[r];
    if (rowStr === '') {
      return {
        ok: false,
        error: new GameError(`Row ${r + 1} is empty`, 'BR-GSFEN-CANON-002'),
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
          error: new GameError(`Empty item in row ${r + 1}`, 'BR-GSFEN-CANON-002'),
        };
      }

      // --- Empty run: a single digit 1-9 ---
      if (/^[1-9]$/.test(item)) {
        // BR-GSFEN-CANON-003: No adjacent empty runs
        if (prevWasDigit) {
          return {
            ok: false,
        error: new GameError(
          `Row ${r + 1}: adjacent empty-run items must be merged (BR-GSFEN-CANON-003) — write 5, not 4,1`,
          'BR-GSFEN-CANON-003',
        ),
          };
        }
        const count = parseInt(item, 10);
        for (let i = 0; i < count; i++) {
          if (pos < 0) {
            return {
              ok: false,
              error: new GameError(`Row ${r + 1} exceeds 9 squares`, 'BR-GSFEN-CANON-002'),
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

      if (item.length < 1 || item.length > 3) {
        return {
          ok: false,
          error: new GameError(`Stack must have 1-3 pieces in row ${r + 1}, got "${item}"`, 'BR-GSFEN-CANON-002'),
        };
      }

      const pieces: Piece[] = [];
      for (const ch of item) {
        const upper = ch.toUpperCase();
        if (!isPieceType(upper)) {
          return {
            ok: false,
            error: new GameError(`Unknown piece letter "${ch}" in row ${r + 1}`, 'BR-GSFEN-CANON-002'),
          };
        }
        const owner: Player = ch === upper ? 'white' : 'black';
        pieces.push({ type: upper, owner });
      }
  // SAFETY: the cast is safe because `item.length` was validated to be
  // in 1..3 at the top of this branch (see the `item.length < 1 || item.length > 3`
  // guard above).  Each character produces exactly one Piece, so
  // `pieces.length === item.length ∈ {1,2,3}`, satisfying the Stack
  // tuple type.  `validateState` (BR-GSFEN-VALID-002) re-checks this invariant after
  // parsing as a defence-in-depth measure.
      const stack = pieces as Stack;

      if (pos < 0) {
        return {
          ok: false,
          error: new GameError(`Row ${r + 1} exceeds 9 squares`, 'BR-GSFEN-CANON-002'),
        };
      }
      row[pos] = stack;
      pos--;
    }

    // BR-GSFEN-CANON-002: verify exactly 9 squares
    if (pos !== -1) {
      return {
        ok: false,
        error: new GameError(
          `Row ${r + 1} has fewer than 9 squares (row total does not sum to 9)`,
          'BR-GSFEN-CANON-002',
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
 * @throws {GameError} with rule 'BR-GSFEN-CANON-001' if token is invalid
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
        error: new GameError(`Invalid turn token "${turnStr}"`, 'BR-GSFEN-CANON-001'),
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
 * @throws {GameError} with rule 'BR-GSFEN-CANON-005' if hands are malformed
 */
function parseHands(handsStr: string): FieldResult<{ white: Hand; black: Hand }> {
  // BR-GSFEN-CANON-005 / BR-GSFEN-VALID-008: `-` when both empty
  if (handsStr === '-') {
    return { ok: true, value: { white: EMPTY_HAND, black: EMPTY_HAND } };
  }

  // Reject empty string (should use `-`)
  if (handsStr === '') {
    return {
      ok: false,
      error: new GameError('Hands field is empty; use "-" for both empty hands', 'BR-GSFEN-CANON-005'),
    };
  }

  const white: Hand = { ...EMPTY_HAND };
  const black: Hand = { ...EMPTY_HAND };
  const len = handsStr.length;
  let i = 0;

  // --- White section (uppercase letters, alphabetical) ---
  let lastWhiteLetter = '';
  while (i < len) {
    const ch = handsStr[i];

    if (isWhitePieceChar(ch)) {
      // Single uppercase piece (count = 1) — ch is now PieceType
      if (lastWhiteLetter !== '' && ch <= lastWhiteLetter) {
        return {
          ok: false,
        error: new GameError(
          `Hands: white pieces not in alphabetical order ("${ch}" after "${lastWhiteLetter}") (BR-GSFEN-CANON-005) — alphabetical order is A C E F G J L M N P S T U Y`,
          'BR-GSFEN-CANON-005',
        ),
        };
      }
      if (white[ch] > 0) {
        return {
          ok: false,
          error: new GameError(`Hands: duplicate white piece letter "${ch}" (BR-GSFEN-CANON-005) — each letter appears at most once`, 'BR-GSFEN-CANON-005'),
        };
      }
      white[ch] = 1;
      lastWhiteLetter = ch;
      i++;
    } else if (isCountDigit(ch)) {
      // Count prefix — look ahead at next character
      if (i + 1 >= len) {
        return {
          ok: false,
          error: new GameError('Hands: expected piece letter after count at end of string', 'BR-GSFEN-CANON-005'),
        };
      }
      const next = handsStr[i + 1];
      if (isWhitePieceChar(next)) {
        const count = parseInt(ch, 10);
        if (lastWhiteLetter !== '' && next <= lastWhiteLetter) {
          return {
            ok: false,
            error: new GameError(
              `Hands: white pieces not in alphabetical order ("${next}" after "${lastWhiteLetter}")`,
              'BR-GSFEN-CANON-005',
            ),
          };
        }
        if (white[next] > 0) {
          return {
            ok: false,
            error: new GameError(`Hands: duplicate white piece letter "${next}"`, 'BR-GSFEN-CANON-005'),
          };
        }
        white[next] = count;
        lastWhiteLetter = next;
        i += 2;
      } else {
        // Next char is not uppercase → end of white section
        break;
      }
    } else {
      // Not uppercase or digit → end of white section
      break;
    }
  }

  // --- Black section (lowercase letters, alphabetical) ---
  let lastBlackLetter = '';
  while (i < len) {
    const ch = handsStr[i];

    if (isBlackPieceChar(ch)) {
      if (lastBlackLetter !== '' && ch <= lastBlackLetter) {
        return {
          ok: false,
        error: new GameError(
          `Hands: black pieces not in alphabetical order ("${ch}" after "${lastBlackLetter}") (BR-GSFEN-CANON-005) — alphabetical order is a c e f g j l m n p s t u y`,
          'BR-GSFEN-CANON-005',
        ),
        };
      }
      const upper = toUpperPieceType(ch);
      if (black[upper] > 0) {
        return {
          ok: false,
          error: new GameError(`Hands: black duplicate piece letter "${ch}" (BR-GSFEN-CANON-005) — each letter appears at most once`, 'BR-GSFEN-CANON-005'),
        };
      }
      black[upper] = 1;
      lastBlackLetter = ch;
      i++;
    } else if (isCountDigit(ch)) {
      if (i + 1 >= len) {
        return {
          ok: false,
          error: new GameError('Hands: expected piece letter after count at end of string', 'BR-GSFEN-CANON-005'),
        };
      }
      const next = handsStr[i + 1];
      if (isBlackPieceChar(next)) {
        const count = parseInt(ch, 10);
        if (lastBlackLetter !== '' && next <= lastBlackLetter) {
          return {
            ok: false,
            error: new GameError(
              `Hands: black pieces not in alphabetical order ("${next}" after "${lastBlackLetter}")`,
              'BR-GSFEN-CANON-005',
            ),
          };
        }
        const upper = toUpperPieceType(next);
        if (black[upper] > 0) {
          return {
            ok: false,
            error: new GameError(`Hands: duplicate black piece letter "${next}"`, 'BR-GSFEN-CANON-005'),
          };
        }
        black[upper] = count;
        lastBlackLetter = next;
        i += 2;
      } else {
        return {
          ok: false,
          error: new GameError(
            `Hands: expected lowercase piece letter after count, got "${next}"`,
            'BR-GSFEN-CANON-005',
          ),
        };
      }
    } else {
      return {
        ok: false,
        error: new GameError(`Hands: unexpected character "${ch}" at position ${i}`, 'BR-GSFEN-CANON-005'),
      };
    }
  }

  return { ok: true, value: { white, black } };
}

/**
 * Parse the counter field.
 * Must be a positive integer with no leading zeros (BR-GSFEN-CANON-006).
 *
 * @throws {GameError} with rule 'BR-GSFEN-CANON-006' if counter has leading zeros or is < 1
 */
function parseCounter(counterStr: string): FieldResult<number> {
  if (!/^[1-9]\d*$/.test(counterStr)) {
    return {
      ok: false,
        error: new GameError(
          `Counter must be a positive integer (no leading zeros), got "${counterStr}" (BR-GSFEN-CANON-006) — e.g. 1 not 01`,
          'BR-GSFEN-CANON-006',
        ),
    };
  }

  const n = parseInt(counterStr, 10);
  if (n < 1) {
    return {
      ok: false,
      error: new GameError(`Counter must be >= 1`, 'BR-GSFEN-CANON-006'),
    };
  }

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
 * well-formed (BR-GSFEN-CANON-001–007) but not necessarily semantically valid (see
 * `validateState`).
 *
 * @param input - Raw GSFEN string to parse.
 * @throws {GameError} with rule 'BR-GSFEN-CANON-001' if fields are wrong, 'BR-GSFEN-CANON-007' if startpos keyword is malformed
 */
export function parseGSFEN(input: string): ParseResult {
  // BR-GSFEN-CANON-007: startpos keyword (lowercase, exact, no whitespace allowed per BR-GSFEN-CANON-001)
  if (input === 'startpos') {
    return parseGSFEN(START_GSFEN);
  }

  // BR-GSFEN-CANON-001: No leading or trailing whitespace
  if (input !== input.trim()) {
    return {
      ok: false,
        error: new GameError('GSFEN must not have leading or trailing whitespace (BR-GSFEN-CANON-001) — trim the string', 'BR-GSFEN-CANON-001'),
    };
  }

  // BR-GSFEN-CANON-001: Fields separated by exactly one space (U+0020).
  // Using split on single space — multi-space segments produce empty strings,
  // which makes the resulting array longer than 4.
  const parts = input.split(' ');
  if (parts.length !== 4) {
    return {
      ok: false,
        error: new GameError(
          `GSFEN must have exactly 4 single-space-separated fields (BR-GSFEN-CANON-001), got ${parts.length} segments — format: <position> <turn> <hands> <counter>`,
          'BR-GSFEN-CANON-001',
        ),
    };
  }

  // BR-GSFEN-CANON-001: No non-space whitespace characters (tabs, etc.) embedded in any field
  for (const p of parts) {
    if (/\s/.test(p)) {
      return {
        ok: false,
        error: new GameError('GSFEN fields must not contain tabs or other whitespace (BR-GSFEN-CANON-001) — use single spaces only', 'BR-GSFEN-CANON-001'),
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
