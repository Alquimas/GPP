/**
 * GAN parser — parses Gungi Action Notation strings into Action objects.
 *
 * Supports three action shapes distinguished by the first character:
 * - Placement (uppercase piece letter)  : `<piece><square>[!]`
 * - Move      (digit, square start)      : `<square>><square>[outcome][turncoat]`
 * - Arata     (uppercase piece letter)   : `<piece>*<square>[turncoat]`
 *
 * @module
 */

import {
  type Action,
  type BoardCoord,
  type PieceType,
  type Square,
  type TurncoatLevels,
} from '../types.js';
import { GameError } from '../errors.js';
import { ALL_PIECE_TYPES } from '../constants.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ParseResult = { ok: true; action: Action } | { ok: false; error: GameError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_PIECE_SET = new Set<string>(ALL_PIECE_TYPES);

/** Check if a character is a valid uppercase piece letter. */
function isValidPiece(ch: string): ch is PieceType {
  return VALID_PIECE_SET.has(ch);
}

// ---------------------------------------------------------------------------
// Square parser
// ---------------------------------------------------------------------------

/**
 * Parse a square notation string: `{col}-{row}`.
 *
 * Both col and row must be single digits 1-9.
 *
 * @param s - The square string (e.g. "5-9").
 * @throws {GameError} with rule 'A1' if the square is invalid.
 */
export function parseSquare(s: string): Square {
  // Must match exactly `{digit 1-9}-{digit 1-9}`
  if (!/^[1-9]-[1-9]$/.test(s)) {
    throw new GameError(
      `Invalid square notation "${s}"; expected format "{col}-{row}" with digits 1-9`,
      'A1',
    );
  }

  const [colStr, rowStr] = s.split('-');
  const col = parseInt(colStr, 10);
  const row = parseInt(rowStr, 10);

  return { col: col as BoardCoord, row: row as BoardCoord };
}

// ---------------------------------------------------------------------------
// Turncoat parser
// ---------------------------------------------------------------------------

/**
 * Parse a turncoat suffix: `+1`, `+2`, or `+12`.
 *
 * Returns the elected swap levels as a TurncoatLevels tuple.
 * - `+1`  → [1]
 * - `+2`  → [2]
 * - `+12` → [1, 2]
 *
 * @param s - The turncoat string including the leading `+`.
 * @throws {GameError} with rule 'A3' if levels are not valid.
 */
export function parseTurncoat(s: string): TurncoatLevels {
  if (!s.startsWith('+')) {
    throw new GameError(`Turncoat must start with "+", got "${s}"`, 'A3');
  }

  const levels = s.slice(1); // Strip the '+'

  // A3: Levels must be one of "1", "2", "12"
  if (levels === '1') return [1];
  if (levels === '2') return [2];
  if (levels === '12') return [1, 2];

  throw new GameError(`Invalid turncoat levels "${s}"; expected "+1", "+2", or "+12"`, 'A3');
}

// ---------------------------------------------------------------------------
// Action parsers
// ---------------------------------------------------------------------------

/**
 * Parse a Placement action: `<piece><square>[!]`
 *
 * Examples: `M5-9`, `P3-8!`
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'A1' on invalid format.
 */
export function parsePlacement(gan: string): Action {
  // Must have at least: piece (1) + square (3 chars like "5-9") = 4 chars
  if (gan.length < 4) {
    throw new GameError(`Placement string too short: "${gan}"`, 'A1');
  }

  const pieceChar = gan[0];

  // Validate piece letter (A1)
  if (!isValidPiece(pieceChar)) {
    throw new GameError(
      `Invalid piece letter "${gan[0]}" in placement; must be one of A, C, E, F, G, J, L, M, N, P, S, T, U, Y`,
      'A1',
    );
  }

  const piece = pieceChar;

  // A4: Check for extra '!' — only one allowed, at end only
  const bangCount = (gan.match(/!/g) ?? []).length;
  if (bangCount > 1) {
    throw new GameError(`Placement "${gan}" has multiple "!" markers (A4)`, 'A4');
  }

  const hasDone = bangCount === 1;

  // A5: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(`Placement "${gan}" contains whitespace (A5)`, 'A5');
  }

  // The square is the part between piece letter and optional '!'
  let squareStr: string;
  if (hasDone) {
    // Remove trailing '!'
    squareStr = gan.slice(1, -1);
  } else {
    squareStr = gan.slice(1);
  }

  // A4: '!' must be at the very end if present
  if (hasDone && gan[gan.length - 1] !== '!') {
    throw new GameError(`Placement "${gan}" has "!" not at the end (A4)`, 'A4');
  }

  // A6: No extra characters
  if (hasDone && squareStr.length + 2 !== gan.length) {
    throw new GameError(`Placement "${gan}" has trailing characters after "!" (A6)`, 'A6');
  }

  const dest = parseSquare(squareStr);

  return {
    kind: 'placement',
    piece,
    dest,
    done: hasDone,
  };
}

/**
 * Parse a Move action: `<square>><square>[outcome][turncoat]`
 *
 * Examples:
 *   `2-7>2-6`       — plain move
 *   `3-3>3-2`       — forced capture, no outcome token
 *   `5-6>5-5=`      — chosen Stack
 *   `5-6>5-5=+2`    — chosen Stack + turncoat level 2
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'A1' on invalid format.
 */
export function parseMove(gan: string): Action {
  // A5: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(`Move "${gan}" contains whitespace (A5)`, 'A5');
  }

  // A6: No unexpected characters — only allow digits, '-', '>', '=', 'x', '+'
  if (!/^[\d>=\-x+]+$/.test(gan)) {
    throw new GameError(`Move "${gan}" contains invalid characters (A6)`, 'A6');
  }

  // A1: The separator between squares must be '>', not '-'
  // We find the '>' to split origin and destination
  const sepIndex = gan.indexOf('>');
  if (sepIndex === -1) {
    throw new GameError(
      `Move "${gan}" must use ">" separator between squares, not "-" or other`,
      'A1',
    );
  }

  // There must be exactly one '>'
  const sepCount = (gan.match(/>/g) ?? []).length;
  if (sepCount !== 1) {
    throw new GameError(`Move "${gan}" has multiple ">" separators`, 'A1');
  }

  const originStr = gan.slice(0, sepIndex);
  let remainder = gan.slice(sepIndex + 1); // Everything after '>'

  // Parse origin square (3 chars: "d-d")
  const origin = parseSquare(originStr);

  // Now parse the destination + optional outcome and turncoat
  // The destination should be at the start of remainder, then optional
  // outcome token (= or x), then optional turncoat (+...)

  // Destination is the first 3 characters
  if (remainder.length < 3) {
    throw new GameError(`Move "${gan}" missing destination square`, 'A1');
  }

  const destStr = remainder.slice(0, 3);
  const dest = parseSquare(destStr);

  remainder = remainder.slice(3);

  // Parse optional outcome: '=' (stack) or 'x' (capture)
  let outcome: 'stack' | 'capture' | null = null;
  if (remainder.startsWith('=')) {
    outcome = 'stack';
    remainder = remainder.slice(1);
  } else if (remainder.startsWith('x')) {
    outcome = 'capture';
    remainder = remainder.slice(1);
  }

  // Parse optional turncoat
  let turncoat: TurncoatLevels = [];
  if (remainder.startsWith('+')) {
    turncoat = parseTurncoat(remainder);
    remainder = remainder.slice(remainder.startsWith('+12') ? 3 : 2);
  }

  // A6: No trailing characters after parsing
  if (remainder.length > 0) {
    throw new GameError(
      `Move "${gan}" has unexpected trailing characters "${remainder}" (A6)`,
      'A6',
    );
  }

  return {
    kind: 'move',
    origin,
    dest,
    outcome,
    turncoat,
  };
}

/**
 * Parse an Arata action: `<piece>*<square>[turncoat]`
 *
 * Examples:
 *   `T*5-6`      — drop Captain at 5-6
 *   `T*5-6+1`    — drop Captain at 5-6 with turncoat level 1
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'A1' on invalid format.
 */
export function parseArata(gan: string): Action {
  // Must have at least: piece (1) + '*' (1) + square (3) = 5 chars
  if (gan.length < 5) {
    throw new GameError(`Arata string too short: "${gan}"`, 'A1');
  }

  // A5: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(`Arata "${gan}" contains whitespace (A5)`, 'A5');
  }

  const pieceChar = gan[0];

  // Validate piece letter
  if (!isValidPiece(pieceChar)) {
    throw new GameError(
      `Invalid piece letter "${gan[0]}" in arata; must be one of A, C, E, F, G, J, L, M, N, P, S, T, U, Y`,
      'A1',
    );
  }

  const piece = pieceChar;

  // A1: Must have '*' separator
  if (gan[1] !== '*') {
    throw new GameError(`Arata "${gan}" must use "*" separator between piece and square`, 'A1');
  }

  // There must be exactly one '*'
  const starCount = (gan.match(/\*/g) ?? []).length;
  if (starCount !== 1) {
    throw new GameError(`Arata "${gan}" has multiple "*" separators`, 'A1');
  }

  let remainder = gan.slice(2); // Everything after piece and '*'

  // Parse destination square (first 3 chars)
  if (remainder.length < 3) {
    throw new GameError(`Arata "${gan}" missing destination square`, 'A1');
  }

  const destStr = remainder.slice(0, 3);
  const dest = parseSquare(destStr);

  remainder = remainder.slice(3);

  // Parse optional turncoat
  let turncoat: TurncoatLevels = [];
  if (remainder.startsWith('+')) {
    turncoat = parseTurncoat(remainder);
    remainder = remainder.slice(remainder.startsWith('+12') ? 3 : 2);
  }

  // A6: No trailing characters
  if (remainder.length > 0) {
    throw new GameError(
      `Arata "${gan}" has unexpected trailing characters "${remainder}" (A6)`,
      'A6',
    );
  }

  return {
    kind: 'arata',
    piece,
    dest,
    turncoat,
  };
}

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a GAN string into an Action discriminated union.
 *
 * The parser determines the action shape by the first character:
 * - Uppercase letter → Placement or Arata (distinguished by second char)
 * - Digit           → Move
 *
 * @param gan - The GAN string to parse.
 * @returns A ParseResult with either the parsed Action or a GameError.
 */
export function parseGAN(gan: string): ParseResult {
  try {
    // Empty or blank input
    if (gan === '' || gan.trim() === '') {
      return {
        ok: false,
        error: new GameError('GAN string must not be empty', 'A1'),
      };
    }

    // A5: No leading/trailing whitespace
    if (gan !== gan.trim()) {
      return {
        ok: false,
        error: new GameError('GAN string must not have leading or trailing whitespace (A5)', 'A5'),
      };
    }

    const first = gan[0];

    // Determine action shape by first character
    if (first >= 'A' && first <= 'Z') {
      // Could be Placement or Arata — check second character
      if (gan.length >= 2 && gan[1] === '*') {
        // Arata: piece followed by '*'
        return { ok: true, action: parseArata(gan) };
      }
      // A1: If second char is a digit or '!', it's a placement
      // If second char is something else, it's still a placement attempt
      return { ok: true, action: parsePlacement(gan) };
    } else if (first >= '1' && first <= '9') {
      // Move: starts with a digit (square notation)
      return { ok: true, action: parseMove(gan) };
    }

    return {
      ok: false,
      error: new GameError(
        `GAN string must start with a piece letter (A-Z) for placement/arata or a digit (1-9) for move, got "${first}"`,
        'A1',
      ),
    };
  } catch (e) {
    if (e instanceof GameError) {
      return { ok: false, error: e };
    }
    return {
      ok: false,
      error: new GameError(`Unexpected parse error: ${(e as Error).message}`, 'A1'),
    };
  }
}
