/**
 * GAN serializer --- converts Action objects into canonical GAN strings.
 *
 * Supports four action shapes:
 * - Done      (Deploy Phase) : `!`
 * - Placement (Deploy Phase) : `<piece><square>`
 * - Move      (Battle Phase) : `<square>><square>[outcome][turncoat]`
 * - Arata     (Battle Phase) : `<piece>*<square>[turncoat]`
 *
 * The serializer emits exactly the tokens carried by the Action object:
 * the outcome token is emitted iff `action.outcome` is non-null and the
 * turncoat suffix iff `action.turncoat` is non-empty. It does NOT decide
 * canonicity --- whether a token is required or forbidden for a concrete
 * position (BR-GAN-CANON-001/002, GAN.md) is enforced by the engine's
 * action validation (validateOutcome and friends), not here. The format
 * rules BR-GAN-GRAMMAR-008-011 are satisfied by construction.
 *
 * @module
 */

import { type Action, type Square, type TurncoatLevels } from '../types.js';

// ---------------------------------------------------------------------------
// Square serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a Square to `{col}-{row}` notation.
 *
 * @param sq - The square coordinate pair.
 * @returns The GAN square string (e.g. `"5-9"`).
 */
export function serializeSquare(sq: Square): string {
  return `${sq.col}-${sq.row}`;
}

// ---------------------------------------------------------------------------
// Turncoat serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a turncoat level array to its canonical suffix string.
 *
 * - `[]`  -> `''`       (no token)
 * - `[1]` -> `'+1'`
 * - `[2]` -> `'+2'`
 * - `[1, 2]` -> `'+12'`
 *
 * @param levels - The elected turncoat swap levels (ascending, no duplicates).
 * @returns The turncoat suffix (including leading `+`), or empty string.
 */
export function serializeTurncoat(levels: TurncoatLevels): string {
  if (levels.length === 0) return '';
  return '+' + levels.join('');
}

// ---------------------------------------------------------------------------
// Outcome serialization
// ---------------------------------------------------------------------------

/**
 * Serialize an outcome value to its canonical token.
 *
 * - `'stack'`   -> `'='`
 * - `'capture'` -> `'x'`
 * - `null`      -> `''`
 *
 * @param outcome - The outcome choice.
 * @returns The outcome token string, or empty string.
 */
export function serializeOutcome(outcome: 'stack' | 'capture' | null): string {
  if (outcome === 'stack') return '=';
  if (outcome === 'capture') return 'x';
  return '';
}

// ---------------------------------------------------------------------------
// Action serializers
// ---------------------------------------------------------------------------

/**
 * Serialize a Placement action to its canonical GAN string.
 *
 * Format: `<piece><square>`
 *
 * A Placement carries no outcome or turncoat tokens (BR-GAN-GRAMMAR-011:
 * `!` is a standalone Done Action token, never a placement suffix;
 * BR-GAN-GRAMMAR-009: no whitespace, guaranteed by construction).
 *
 * @param action - The placement action.
 * @returns The canonical GAN string.
 */
export function serializePlacement(action: Action & { kind: 'placement' }): string {
  return `${action.piece}${serializeSquare(action.dest)}`;
}

/**
 * Serialize a Done action to its canonical GAN string.
 *
 * Format: `!`
 *
 * BR-GAN-GRAMMAR-011: Done is a standalone Action token.
 *
 * @returns The canonical GAN string (`'!'`).
 */
export function serializeDone(): string {
  return '!';
}

/**
 * Serialize a Move action to its canonical GAN string.
 *
 * Format: `<origin>><dest>[outcome][turncoat]`
 *
 * The outcome and turncoat tokens are emitted iff the Action carries them.
 * Whether a token is canonical for a concrete position (BR-GAN-CANON-001/002)
 * is decided by engine validation, not here.
 * BR-GAN-GRAMMAR-009: No whitespace (guaranteed by construction).
 *
 * @param action - The move action.
 * @returns The canonical GAN string.
 */
export function serializeMove(action: Action & { kind: 'move' }): string {
  const origin = serializeSquare(action.origin);
  const dest = serializeSquare(action.dest);
  const outcome = serializeOutcome(action.outcome);
  const turncoat = serializeTurncoat(action.turncoat);
  return `${origin}>${dest}${outcome}${turncoat}`;
}

/**
 * Serialize an Arata action to its canonical GAN string.
 *
 * Format: `<piece>*<square>[turncoat]`
 *
 * The turncoat suffix is emitted iff the Action carries elected swaps;
 * canonicity for a concrete position is decided by engine validation.
 * BR-GAN-GRAMMAR-009: No whitespace (guaranteed by construction).
 *
 * @param action - The arata action.
 * @returns The canonical GAN string.
 */
export function serializeArata(action: Action & { kind: 'arata' }): string {
  const dest = serializeSquare(action.dest);
  const turncoat = serializeTurncoat(action.turncoat);
  return `${action.piece}*${dest}${turncoat}`;
}

// ---------------------------------------------------------------------------
// Main serializer entry point
// ---------------------------------------------------------------------------

/**
 * Serialize an Action object into a canonical GAN string.
 *
 * The function dispatches on `action.kind` to the appropriate shape-specific
 * serializer. It always succeeds for valid Action objects.
 *
 * @param action - The action to serialize.
 * @returns The canonical GAN string representation.
 */ export function serializeGAN(action: Action): string {
  switch (action.kind) {
    case 'placement':
      return serializePlacement(action);
    case 'move':
      return serializeMove(action);
    case 'arata':
      return serializeArata(action);
    case 'done':
      return serializeDone();
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      throw new Error(`Unknown action kind`);
    }
  }
}
