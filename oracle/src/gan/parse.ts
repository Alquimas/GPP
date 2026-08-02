/**
 * GAN parser --- parses Gungi Action Notation strings into Action objects.
 *
 * Supports four action shapes distinguished by the first character:
 * - Done       (`!`)                          : `!`
 * - Placement (uppercase piece letter)  : `<piece><square>`
 * - Move      (digit, square start)      : `<square>><square>[outcome][turncoat]`
 * - Arata     (uppercase piece letter)   : `<piece>*<square>[turncoat]`
 *
 * @module
 */

import { type Action, type PieceType, type Square, type TurncoatLevels } from '../types.js';
import { GameError } from '../errors.js';
import { ALL_PIECE_TYPES } from '../constants.js';
import { trySquare } from '../board/board.js';

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
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-004' if the square is malformed.
 */
export function parseSquare(s: string): Square {
  // Must match exactly `{digit 1-9}-{digit 1-9}`
  if (!/^[1-9]-[1-9]$/.test(s)) {
    throw new GameError(
      `Invalid square notation "${s}"; expected format "{col}-{row}" with digits 1-9`,
      'BR-GAN-GRAMMAR-004',
    );
  }

  const [colStr, rowStr] = s.split('-');
  const col = parseInt(colStr, 10);
  const row = parseInt(rowStr, 10);

  // The regex guarantees col, row ∈ 1..9, so trySquare cannot return null.
  // Routing through trySquare keeps the `as BoardCoord` cast confined to
  // the single audited helper in board.ts.
  const sq = trySquare(col, row);
  if (!sq) {
    // Defensive: regex should prevent this path from ever executing.
    throw new GameError(
      `Invalid square "${s}" (internal --- regex should have rejected)`,
      'BR-GAN-GRAMMAR-004',
    );
  }
  return sq;
}

// ---------------------------------------------------------------------------
// Turncoat parser
// ---------------------------------------------------------------------------

/**
 * Parse a turncoat suffix: `+1`, `+2`, or `+12`.
 *
 * Returns the elected swap levels as a TurncoatLevels tuple.
 * - `+1`  -> [1]
 * - `+2`  -> [2]
 * - `+12` -> [1, 2]
 *
 * @param s - The turncoat string including the leading `+`.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-010' if levels are not valid.
 */
export function parseTurncoat(s: string): TurncoatLevels {
  if (!s.startsWith('+')) {
    throw new GameError(`Turncoat must start with "+", got "${s}"`, 'BR-GAN-GRAMMAR-010');
  }

  const levels = s.slice(1); // Strip the '+'

  // BR-GAN-GRAMMAR-010: Levels must be one of "1", "2", "12"
  if (levels === '1') return [1];
  if (levels === '2') return [2];
  if (levels === '12') return [1, 2];

  throw new GameError(
    `Invalid turncoat levels "${s}"; expected "+1", "+2", or "+12"`,
    'BR-GAN-GRAMMAR-010',
  );
}

// ---------------------------------------------------------------------------
// Action parsers
// ---------------------------------------------------------------------------

/**
 * Parse a standalone Done Action: exactly `!`.
 *
 * Done is a standalone Action token (BR-GAN-GRAMMAR-011) that ends the
 * declaring player's deploying (BR-DEPLOY-007). No other characters may
 * accompany it.
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-007' unless `gan === '!'`.
 */
export function parseDone(gan: string): Action {
  if (gan !== '!') {
    throw new GameError(
      `Done Action must be exactly "!", got "${gan}" (BR-GAN-GRAMMAR-007)`,
      'BR-GAN-GRAMMAR-007',
    );
  }
  return { kind: 'done' };
}

/**
 * Parse a Placement action: `<piece><square>`
 *
 * Examples: `M5-9`, `P3-8`
 *
 * `!` is a standalone Done Action token (BR-GAN-GRAMMAR-011) and is NOT a
 * valid suffix or interior character of a Placement.
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-007' if too short.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-003' on invalid piece letter.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-011' if the string contains '!'.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-009' if whitespace present.
 */
export function parsePlacement(gan: string): Action {
  // BR-GAN-GRAMMAR-007: Must have at least: piece (1) + square (3 chars like "5-9") = 4 chars
  if (gan.length < 4) {
    throw new GameError(`Placement string too short: "${gan}"`, 'BR-GAN-GRAMMAR-007');
  }

  const pieceChar = gan[0];

  // BR-GAN-GRAMMAR-003: Validate piece letter
  if (!isValidPiece(pieceChar)) {
    throw new GameError(
      `Invalid piece letter "${gan[0]}" in placement; must be one of A, C, E, F, G, J, L, M, N, P, S, T, U, Y`,
      'BR-GAN-GRAMMAR-003',
    );
  }

  const piece = pieceChar;

  // BR-GAN-GRAMMAR-009: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(
      `Placement "${gan}" contains whitespace (BR-GAN-GRAMMAR-009)`,
      'BR-GAN-GRAMMAR-009',
    );
  }

  // BR-GAN-GRAMMAR-011: Done is a standalone Action token. Any '!' anywhere
  // in a placement string is illegal.
  if (gan.includes('!')) {
    throw new GameError(
      `Placement "${gan}" contains "!" --- Done is a standalone Action token (BR-GAN-GRAMMAR-011)`,
      'BR-GAN-GRAMMAR-011',
    );
  }

  // The square is the entire remainder after the piece letter.
  const squareStr = gan.slice(1);
  const dest = parseSquare(squareStr);

  return {
    kind: 'placement',
    piece,
    dest,
  };
}

/**
 * Parse a Move action: `<square>><square>[outcome][turncoat]`
 *
 * Examples:
 *   `2-7>2-6`       --- plain move
 *   `3-3>3-2`       --- forced capture, no outcome token
 *   `5-6>5-5=`      --- chosen Stack
 *   `5-6>5-5=+2`    --- chosen Stack + turncoat level 2
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-009' if whitespace present.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-008' on invalid characters.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-005' on missing '>' separator.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-006' on multiple '>' separators.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-007' if missing destination.
 */
export function parseMove(gan: string): Action {
  // BR-GAN-GRAMMAR-009: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(
      `Move "${gan}" contains whitespace (BR-GAN-GRAMMAR-009)`,
      'BR-GAN-GRAMMAR-009',
    );
  }

  // BR-GAN-GRAMMAR-008: No unexpected characters --- only allow digits, '-', '>', '=', 'x', '+'
  if (!/^[\d>=\-x+]+$/.test(gan)) {
    throw new GameError(
      `Move "${gan}" contains invalid characters (BR-GAN-GRAMMAR-008)`,
      'BR-GAN-GRAMMAR-008',
    );
  }

  // BR-GAN-GRAMMAR-005: The separator between squares must be '>'
  const sepIndex = gan.indexOf('>');
  if (sepIndex === -1) {
    throw new GameError(
      `Move "${gan}" must use ">" separator between squares, not "-" or other`,
      'BR-GAN-GRAMMAR-005',
    );
  }

  // BR-GAN-GRAMMAR-006: There must be exactly one '>'
  const sepCount = (gan.match(/>/g) ?? []).length;
  if (sepCount !== 1) {
    throw new GameError(
      `Move "${gan}" has multiple ">" separators (BR-GAN-GRAMMAR-006)`,
      'BR-GAN-GRAMMAR-006',
    );
  }

  const originStr = gan.slice(0, sepIndex);
  let remainder = gan.slice(sepIndex + 1); // Everything after '>'

  // Parse origin square (3 chars: "d-d")
  const origin = parseSquare(originStr);

  // Now parse the destination + optional outcome and turncoat
  // The destination should be at the start of remainder, then optional
  // outcome token (= or x), then optional turncoat (+...)

  // BR-GAN-GRAMMAR-007: Destination is the first 3 characters
  if (remainder.length < 3) {
    throw new GameError(
      `Move "${gan}" missing destination square (BR-GAN-GRAMMAR-007)`,
      'BR-GAN-GRAMMAR-007',
    );
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

  // BR-GAN-GRAMMAR-008: No trailing characters after parsing
  if (remainder.length > 0) {
    throw new GameError(
      `Move "${gan}" has unexpected trailing characters "${remainder}" (BR-GAN-GRAMMAR-008)`,
      'BR-GAN-GRAMMAR-008',
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
 *   `T*5-6`      --- drop Captain at 5-6
 *   `T*5-6+1`    --- drop Captain at 5-6 with turncoat level 1
 *
 * @param gan - The full GAN string.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-007' if too short.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-009' if whitespace present.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-003' on invalid piece letter.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-005' on missing '*' separator.
 * @throws {GameError} with rule 'BR-GAN-GRAMMAR-006' on multiple '*' separators.
 */
export function parseArata(gan: string): Action {
  // BR-GAN-GRAMMAR-007: Must have at least: piece (1) + '*' (1) + square (3) = 5 chars
  if (gan.length < 5) {
    throw new GameError(`Arata string too short: "${gan}"`, 'BR-GAN-GRAMMAR-007');
  }

  // BR-GAN-GRAMMAR-009: No internal whitespace
  if (/\s/.test(gan)) {
    throw new GameError(
      `Arata "${gan}" contains whitespace (BR-GAN-GRAMMAR-009)`,
      'BR-GAN-GRAMMAR-009',
    );
  }

  const pieceChar = gan[0];

  // BR-GAN-GRAMMAR-003: Validate piece letter
  if (!isValidPiece(pieceChar)) {
    throw new GameError(
      `Invalid piece letter "${gan[0]}" in arata; must be one of A, C, E, F, G, J, L, M, N, P, S, T, U, Y`,
      'BR-GAN-GRAMMAR-003',
    );
  }

  const piece = pieceChar;

  // BR-GAN-GRAMMAR-005: Must have '*' separator
  if (gan[1] !== '*') {
    throw new GameError(
      `Arata "${gan}" must use "*" separator between piece and square (BR-GAN-GRAMMAR-005)`,
      'BR-GAN-GRAMMAR-005',
    );
  }

  // BR-GAN-GRAMMAR-006: There must be exactly one '*'
  const starCount = (gan.match(/\*/g) ?? []).length;
  if (starCount !== 1) {
    throw new GameError(
      `Arata "${gan}" has multiple "*" separators (BR-GAN-GRAMMAR-006)`,
      'BR-GAN-GRAMMAR-006',
    );
  }

  let remainder = gan.slice(2); // Everything after piece and '*'

  // BR-GAN-GRAMMAR-007: Parse destination square (first 3 chars)
  if (remainder.length < 3) {
    throw new GameError(
      `Arata "${gan}" missing destination square (BR-GAN-GRAMMAR-007)`,
      'BR-GAN-GRAMMAR-007',
    );
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

  // BR-GAN-GRAMMAR-008: No trailing characters
  if (remainder.length > 0) {
    throw new GameError(
      `Arata "${gan}" has unexpected trailing characters "${remainder}" (BR-GAN-GRAMMAR-008)`,
      'BR-GAN-GRAMMAR-008',
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
 * - `!`              -> Done
 * - Uppercase letter -> Placement or Arata (distinguished by second char)
 * - Digit           -> Move
 *
 * @param gan - The GAN string to parse.
 * @returns A ParseResult with either the parsed Action or a GameError.
 */
export function parseGAN(gan: string): ParseResult {
  try {
    // BR-GAN-GRAMMAR-001: Empty or blank input
    if (gan === '' || gan.trim() === '') {
      return {
        ok: false,
        error: new GameError('GAN string must not be empty', 'BR-GAN-GRAMMAR-001'),
      };
    }

    // BR-GAN-GRAMMAR-009: No leading/trailing whitespace
    if (gan !== gan.trim()) {
      return {
        ok: false,
        error: new GameError(
          'GAN string must not have leading or trailing whitespace (BR-GAN-GRAMMAR-009)',
          'BR-GAN-GRAMMAR-009',
        ),
      };
    }

    const first = gan[0];

    // Determine action shape by first character
    if (first === '!') {
      // Done: standalone action token
      return { ok: true, action: parseDone(gan) };
    } else if (first >= 'A' && first <= 'Z') {
      // Could be Placement or Arata --- check second character
      if (gan.length >= 2 && gan[1] === '*') {
        // Arata: piece followed by '*'
        return { ok: true, action: parseArata(gan) };
      }
      // Placement: second char is part of the square
      return { ok: true, action: parsePlacement(gan) };
    } else if (first >= '1' && first <= '9') {
      // Move: starts with a digit (square notation)
      return { ok: true, action: parseMove(gan) };
    }

    // BR-GAN-GRAMMAR-002: Invalid starting character
    return {
      ok: false,
      error: new GameError(
        `GAN string must start with "!" for done, a piece letter (A-Z) for placement/arata, or a digit (1-9) for move, got "${first}"`,
        'BR-GAN-GRAMMAR-002',
      ),
    };
  } catch (e) {
    if (e instanceof GameError) {
      return { ok: false, error: e };
    }
    // BR-GAN-GRAMMAR-008: Defensive catch-all for unexpected parse errors
    return {
      ok: false,
      error: new GameError(`Unexpected parse error: ${(e as Error).message}`, 'BR-GAN-GRAMMAR-008'),
    };
  }
}
