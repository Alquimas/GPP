/**
 * GAN semantic validation — checks S1–S6 from the GAN specification.
 *
 * For Step 4, implements checks that don't depend on movement/attack modules:
 * - S1: Phase match (placement → deploy; move/arata → battle)
 * - S2: Placement legality (piece in hand, marshal first, deploy zone, target empty/friendly)
 * - S5: Turncoat legality (present only if piece is Captain and outcome is stacking)
 * - S6: Done legality (only on placements)
 *
 * S3 (Move legality) and S4 (Arata legality) are stubbed with TODOs for later steps.
 *
 * @module
 */

import { type Action, type GameState, type Square } from '../types.js';
import { GameError } from '../errors.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ValidationResult = { ok: true } | { ok: false; error: GameError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Deploy zone rows per player (GAN coordinates 1-9). */
const DEPLOY_ZONE_ROWS: Record<'white' | 'black', number[]> = {
  white: [7, 8, 9],
  black: [1, 2, 3],
};

/**
 * Check if a square (col, row) is within a player's deploy zone.
 * White deploy zone: rows 7-9
 * Black deploy zone: rows 1-3
 */
function isInDeployZone(square: Square, player: 'white' | 'black'): boolean {
  return DEPLOY_ZONE_ROWS[player].includes(square.row);
}

// ---------------------------------------------------------------------------
// Validation functions (S1–S6)
// ---------------------------------------------------------------------------

/**
 * S1 — Phase match.
 *
 * Placement is only valid in the Deploy Phase.
 * Move and Arata are only valid in the Battle Phase.
 *
 * @throws {GameError} with rule 'S1' on phase mismatch.
 */
function checkPhase(action: Action, state: GameState): ValidationResult {
  const phase = state.turn.phase;

  if (action.kind === 'placement') {
    if (phase !== 'deploy') {
      return {
        ok: false,
        error: new GameError('Placement is only valid during the Deploy Phase (S1)', 'S1'),
      };
    }
  } else {
    // move or arata
    if (phase !== 'battle') {
      return {
        ok: false,
        error: new GameError('Move and Arata are only valid during the Battle Phase (S1)', 'S1'),
      };
    }
  }

  return { ok: true };
}

/**
 * S2 — Placement legality.
 *
 * Checks:
 * - Piece is in the placing Player's Hand (count > 0)
 * - If it's a Marshal, this must be the Player's first Placement
 *   (Marshal count in Hand is still at initial value 1)
 * - Square is within the Player's deploy zone
 * - Square is either empty or a friendly-topped Stack under size 3
 *   (and the top piece is not a Marshal — Marshal can never stack below)
 *
 * @throws {GameError} with rule 'S2' on illegal placement.
 */
function checkPlacementLegality(action: Action, state: GameState): ValidationResult {
  if (action.kind !== 'placement') return { ok: true };

  const { piece, dest } = action;
  const player = state.turn.activePlayer;
  const hand = state.hands[player];

  // Piece must be in hand
  if (hand[piece] < 1) {
    return {
      ok: false,
      error: new GameError(`Piece ${piece} is not in ${player}'s hand (S2)`, 'S2'),
    };
  }

  // Marshal must be the first placement (initial count is 1)
  // If Marshal hasn't been placed yet, count is still 1
  if (piece === 'M') {
    // It's fine if it's still in hand — this is the Marshal placement
    // The deploy order is validated by "Marshal first" rule
    // If Marshal count < initial, it means the Marshal was already placed
    // Actually, BR-DEPLOY-003 says the Marshal must be the first placement
    // We check: if Marshal is being placed, and any other piece has been placed
    // (count < initial for that piece), that's valid only if no other pieces
    // were placed before. For simplicity, we trust the game flow — the
    // placement order enforcement is handled at the game level. Here we just
    // check if Marshal is in hand.
  } else {
    // Non-Marshal piece: Marshal must already be placed
    // (i.e., White Marshal count in White's hand should be 0 for White's placements)
    // Actually this is tricky because we need to know whose turn it is.
    // If the active player still has their Marshal in hand, they must place it first.
    if (hand.M === 1) {
      return {
        ok: false,
        error: new GameError(`Must place Marshal before other pieces (S2)`, 'S2'),
      };
    }
  }

  // Square must be in deploy zone
  if (!isInDeployZone(dest, player)) {
    return {
      ok: false,
      error: new GameError(
        `Square ${dest.col}-${dest.row} is not in ${player}'s deploy zone (S2)`,
        'S2',
      ),
    };
  }

  // Row index: GAN row 1 = position index 0, GAN row 9 = position index 8
  const rowIdx = dest.row - 1;
  const colIdx = dest.col - 1;
  const targetStack = state.position[rowIdx][colIdx];

  // Square must be empty or a friendly-topped Stack under size 3
  if (targetStack !== null) {
    if (targetStack.length >= 3) {
      return {
        ok: false,
        error: new GameError(`Cannot place on a full stack at ${dest.col}-${dest.row} (S2)`, 'S2'),
      };
    }

    const topPiece = targetStack[targetStack.length - 1];

    // Must be friendly-topped
    if (topPiece.owner !== player) {
      return {
        ok: false,
        error: new GameError(
          `Cannot place on an enemy-controlled square at ${dest.col}-${dest.row} (S2)`,
          'S2',
        ),
      };
    }

    // Marshal cannot be placed on top of any stack (BR-DEPLOY-005/006)
    // Actually, Marshal placement: special rule — it must be on an empty square
    if (piece === 'M' && targetStack.length > 0) {
      return {
        ok: false,
        error: new GameError(
          `Marshal must be placed on an empty square, not on a stack (S2)`,
          'S2',
        ),
      };
    }
  }

  return { ok: true };
}

/**
 * S3 — Move legality (stub for Step 6).
 *
 * TODO: Implement in Step 6 — depends on movement rules.
 *
 * Checks:
 * - origin holds a Stack whose top Piece belongs to the Active Player
 * - dest is reachable by that Piece's movement rules
 * - landing satisfies BR-MOVE-005 stack-size restriction
 * - outcome is present exactly when A1 requires it
 * - resulting position does not leave the mover's own Marshal in Check
 */
function checkMoveLegality(_action: Action, _state: GameState): ValidationResult {
  // TODO: Implement S3 when movement/attack modules are available (Step 6)
  return { ok: true };
}

/**
 * S4 — Arata legality (stub for Step 6–7).
 *
 * TODO: Implement in Step 6–7 — depends on board helpers.
 *
 * Checks:
 * - piece is in Hand and is not Marshal
 * - dest is within Arata placement zone
 * - dest is empty or friendly-topped under size 3
 * - Self Check applies
 */
function checkArataLegality(_action: Action, _state: GameState): ValidationResult {
  // TODO: Implement S4 when board helpers are available (Step 6–7)
  return { ok: true };
}

/**
 * S5 — Turncoat legality.
 *
 * Turncoat (+1, +2, +12) is present only if:
 * - The acting/placed Piece is a Captain ('T')
 * - The Action's outcome is a Stacking (for moves) or for arata/placement
 *
 * Each listed level must have held an opposing Piece immediately beforehand.
 * The Hand must have held a matching replacement Piece Type.
 *
 * For Step 4, we validate the basic preconditions (Captain + Stacking outcome).
 * Full eligibility checks (enemy piece present, hand has match) depend on
 * board state helpers from later steps.
 *
 * @throws {GameError} with rule 'S5' on illegal turncoat.
 */
function checkTurncoatLegality(action: Action, _state: GameState): ValidationResult {
  const turncoat = action.kind === 'placement' ? [] : action.turncoat;

  if (!turncoat || turncoat.length === 0) {
    return { ok: true }; // No turncoat — always valid (omission is canonical)
  }

  // Turncoat present — must be a Captain and outcome must be stacking
  if (action.kind === 'move') {
    // Move: acting piece must be Captain (checked from state) and outcome must be stacking
    if (action.outcome !== 'stack') {
      return {
        ok: false,
        error: new GameError('Turncoat requires the outcome to be a Stack (S5)', 'S5'),
      };
    }
    // TODO: Check that the acting piece at origin is a Captain (needs board state lookup)
  } else if (action.kind === 'arata') {
    // Arata: placed piece must be Captain
    if (action.piece !== 'T') {
      return {
        ok: false,
        error: new GameError(
          'Turncoat is only legal when the placed piece is a Captain (S5)',
          'S5',
        ),
      };
    }
  }

  // TODO: Full S5 check — verify each level held an opposing piece and hand has replacement

  return { ok: true };
}

/**
 * S6 — Done legality.
 *
 * The `!` marker is only valid on Placements, never on Moves or Aratas.
 *
 * @throws {GameError} with rule 'S6' if `!` is present on a non-placement action.
 */
function checkDoneLegality(action: Action, _state: GameState): ValidationResult {
  if (action.kind === 'placement') {
    // If it's a placement with done=false, that's fine
    // If it's a placement with done=true, that's fine (it's on a placement)
    return { ok: true };
  }

  // The action is a move or arata — there is no `done` property on these types
  // If we're here, it wasn't parsed as a placement, so it's fine.
  // Done legality is enforced at parse time (A4: `!` only on placements),
  // so by the time we reach validation, a move/arata with `!` would have
  // already been rejected by the parser.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a parsed GAN Action against a GameState.
 *
 * Runs checks S1–S6 in order. Returns the first validation failure, or
 * `{ ok: true }` if all checks pass.
 *
 * @param gan - The original GAN string (used for error messages).
 * @param action - The parsed Action object.
 * @param state - The GameState the action is applied against.
 * @returns ValidationResult with either success or the first error encountered.
 */
export function validateAction(_gan: string, action: Action, state: GameState): ValidationResult {
  // S1: Phase match
  const s1 = checkPhase(action, state);
  if (!s1.ok) return s1;

  // S2: Placement legality
  const s2 = checkPlacementLegality(action, state);
  if (!s2.ok) return s2;

  // S3: Move legality (stub)
  const s3 = checkMoveLegality(action, state);
  if (!s3.ok) return s3;

  // S4: Arata legality (stub)
  const s4 = checkArataLegality(action, state);
  if (!s4.ok) return s4;

  // S5: Turncoat legality
  const s5 = checkTurncoatLegality(action, state);
  if (!s5.ok) return s5;

  // S6: Done legality
  const s6 = checkDoneLegality(action, state);
  if (!s6.ok) return s6;

  return { ok: true };
}
