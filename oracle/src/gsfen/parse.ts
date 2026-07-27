/**
 * GSFEN parser — parses Gungi Stacking Forsyth-Edwards Notation strings
 * into GameState objects, validating canonical form (C1–C7).
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
 * @throws {GameError} with rule 'C1' if row count != 9, 'C2' if row doesn't sum to 9, 'C3' if empty runs not merged
 */
function parsePosition(posStr: string): FieldResult<Position> {
  const rows = posStr.split('/');

  // C1: exactly 9 rows
  if (rows.length !== 9) {
    return {
      ok: false,
      error: new GameError(
        `Position field must have exactly 9 rows (slashes), got ${rows.length}`,
        'C1',
      ),
    };
  }

  const position: Position = [];

  for (let r = 0; r < 9; r++) {
    const rowStr = rows[r];
    if (rowStr === '') {
      return {
        ok: false,
        error: new GameError(`Row ${r + 1} is empty`, 'C2'),
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
          error: new GameError(`Empty item in row ${r + 1}`, 'C2'),
        };
      }

      // --- Empty run: a single digit 1-9 ---
      if (/^[1-9]$/.test(item)) {
        // C3: No adjacent empty runs
        if (prevWasDigit) {
          return {
            ok: false,
            error: new GameError(
              `Row ${r + 1}: adjacent empty-run items must be merged (C3)`,
              'C3',
            ),
          };
        }
        const count = parseInt(item, 10);
        for (let i = 0; i < count; i++) {
          if (pos < 0) {
            return {
              ok: false,
              error: new GameError(`Row ${r + 1} exceeds 9 squares`, 'C2'),
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
          error: new GameError(`Stack must have 1-3 pieces in row ${r + 1}, got "${item}"`, 'C2'),
        };
      }

      const pieces: Piece[] = [];
      for (const ch of item) {
        const upper = ch.toUpperCase();
        if (!isPieceType(upper)) {
          return {
            ok: false,
            error: new GameError(`Unknown piece letter "${ch}" in row ${r + 1}`, 'C2'),
          };
        }
        const owner: Player = ch === upper ? 'white' : 'black';
        pieces.push({ type: upper, owner });
      }
      const stack = pieces as Stack;

      if (pos < 0) {
        return {
          ok: false,
          error: new GameError(`Row ${r + 1} exceeds 9 squares`, 'C2'),
        };
      }
      row[pos] = stack;
      pos--;
    }

    // C2: verify exactly 9 squares
    if (pos !== -1) {
      return {
        ok: false,
        error: new GameError(
          `Row ${r + 1} has fewer than 9 squares (row total does not sum to 9)`,
          'C2',
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
 * @throws {GameError} with rule 'C1' if token is invalid
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
        error: new GameError(`Invalid turn token "${turnStr}"`, 'C1'),
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
 * @throws {GameError} with rule 'C5' if hands are malformed
 */
function parseHands(handsStr: string): FieldResult<{ white: Hand; black: Hand }> {
  // C5 / V8: `-` when both empty
  if (handsStr === '-') {
    return { ok: true, value: { white: EMPTY_HAND, black: EMPTY_HAND } };
  }

  // Reject empty string (should use `-`)
  if (handsStr === '') {
    return {
      ok: false,
      error: new GameError('Hands field is empty; use "-" for both empty hands', 'C5'),
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
            `Hands: white pieces not in alphabetical order ("${ch}" after "${lastWhiteLetter}")`,
            'C5',
          ),
        };
      }
      if (white[ch] > 0) {
        return {
          ok: false,
          error: new GameError(`Hands: duplicate white piece letter "${ch}"`, 'C5'),
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
          error: new GameError('Hands: expected piece letter after count at end of string', 'C5'),
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
              'C5',
            ),
          };
        }
        if (white[next] > 0) {
          return {
            ok: false,
            error: new GameError(`Hands: duplicate white piece letter "${next}"`, 'C5'),
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
            `Hands: black pieces not in alphabetical order ("${ch}" after "${lastBlackLetter}")`,
            'C5',
          ),
        };
      }
      const upper = toUpperPieceType(ch);
      if (black[upper] > 0) {
        return {
          ok: false,
          error: new GameError(`Hands: duplicate black piece letter "${ch}"`, 'C5'),
        };
      }
      black[upper] = 1;
      lastBlackLetter = ch;
      i++;
    } else if (isCountDigit(ch)) {
      if (i + 1 >= len) {
        return {
          ok: false,
          error: new GameError('Hands: expected piece letter after count at end of string', 'C5'),
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
              'C5',
            ),
          };
        }
        const upper = toUpperPieceType(next);
        if (black[upper] > 0) {
          return {
            ok: false,
            error: new GameError(`Hands: duplicate black piece letter "${next}"`, 'C5'),
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
            'C5',
          ),
        };
      }
    } else {
      return {
        ok: false,
        error: new GameError(`Hands: unexpected character "${ch}" at position ${i}`, 'C5'),
      };
    }
  }

  return { ok: true, value: { white, black } };
}

/**
 * Parse the counter field.
 * Must be a positive integer with no leading zeros (C6).
 *
 * @throws {GameError} with rule 'C6' if counter has leading zeros or is < 1
 */
function parseCounter(counterStr: string): FieldResult<number> {
  if (!/^[1-9]\d*$/.test(counterStr)) {
    return {
      ok: false,
      error: new GameError(
        `Counter must be a positive integer (no leading zeros), got "${counterStr}"`,
        'C6',
      ),
    };
  }

  const n = parseInt(counterStr, 10);
  if (n < 1) {
    return {
      ok: false,
      error: new GameError(`Counter must be >= 1`, 'C6'),
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
 * well-formed (C1–C7) but not necessarily semantically valid (see
 * `validateState`).
 *
 * @param input - Raw GSFEN string to parse.
 * @throws {GameError} with rule 'C1' if fields are wrong, 'C7' if startpos keyword is malformed
 */
export function parseGSFEN(input: string): ParseResult {
  // C7: startpos keyword (lowercase, exact, no whitespace allowed per C1)
  if (input === 'startpos') {
    return parseGSFEN(START_GSFEN);
  }

  // C1: No leading or trailing whitespace
  if (input !== input.trim()) {
    return {
      ok: false,
      error: new GameError('GSFEN must not have leading or trailing whitespace (C1)', 'C1'),
    };
  }

  // C1: Fields separated by exactly one space (U+0020).
  // Using split on single space — multi-space segments produce empty strings,
  // which makes the resulting array longer than 4.
  const parts = input.split(' ');
  if (parts.length !== 4) {
    return {
      ok: false,
      error: new GameError(
        `GSFEN must have exactly 4 single-space-separated fields (C1), got ${parts.length} segments`,
        'C1',
      ),
    };
  }

  // C1: No non-space whitespace characters (tabs, etc.) embedded in any field
  for (const p of parts) {
    if (/\s/.test(p)) {
      return {
        ok: false,
        error: new GameError('GSFEN fields must not contain tabs or other whitespace (C1)', 'C1'),
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
