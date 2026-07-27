/**
 * GAN serializer — converts Action objects into canonical GAN strings.
 *
 * Supports three action shapes:
 * - Placement (Deploy Phase) : `<piece><square>[!]`
 * - Move      (Battle Phase) : `<square>><square>[outcome][turncoat]`
 * - Arata     (Battle Phase) : `<piece>*<square>[turncoat]`
 *
 * The serializer enforces canonicity rules A1–A6 from the GAN specification:
 * - A1: outcome token only when choice exists (omitted for forced outcomes)
 * - A2: turncoat levels only when elected (omitted when declined)
 * - A3: levels ascending, no duplicates (inputs must already satisfy this)
 * - A4: `!` only as placement suffix
 * - A5: no whitespace within a single action
 * - A6: no annotation tokens beyond the grammar
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
 * - `[]`  → `''`       (no token)
 * - `[1]` → `'+1'`
 * - `[2]` → `'+2'`
 * - `[1, 2]` → `'+12'`
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
 * - `'stack'`   → `'='`
 * - `'capture'` → `'x'`
 * - `null`      → `''`
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
 * Format: `<piece><square>[!]`
 *
 * A1: Outcome token is not applicable to placements.
 * A4: `!` suffix only when `action.done === true`.
 * A5: No whitespace (guaranteed by construction).
 *
 * @param action - The placement action.
 * @returns The canonical GAN string.
 */
export function serializePlacement(action: Action & { kind: 'placement' }): string {
  // A4: Done suffix
  const doneToken = action.done ? '!' : '';
  return `${action.piece}${serializeSquare(action.dest)}${doneToken}`;
}

/**
 * Serialize a Move action to its canonical GAN string.
 *
 * Format: `<origin>><dest>[outcome][turncoat]`
 *
 * A1: Outcome token only included when the action has a non-null outcome.
 * A2/A3: Turncoat token only included when swaps are elected.
 * A5: No whitespace (guaranteed by construction).
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
 * A2/A3: Turncoat token only included when swaps are elected.
 * A5: No whitespace (guaranteed by construction).
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
 */
export function serializeGAN(action: Action): string {
  switch (action.kind) {
    case 'placement':
      return serializePlacement(action);
    case 'move':
      return serializeMove(action);
    case 'arata':
      return serializeArata(action);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      throw new Error(`Unknown action kind`);
    }
  }
}
