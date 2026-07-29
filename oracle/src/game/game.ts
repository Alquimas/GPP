/**
 * Game — single entry point for all external code (Step 12).
 *
 * Wraps the pure domain logic into a stateful container that tracks
 * the current GameState, action history (for Repetition), and the
 * terminal result.
 *
 * ## Usage
 * ```typescript
 * const game = new Game();
 * const result = game.applyAction(parseGAN('M5-9'));  // deploy placement
 * ```
 *
 * @module
 */

import type { Action, GameResult, GameState, Player, Square, BoardCoord } from '../types.js';
import { GameError } from '../errors.js';
import { parseGSFEN } from '../gsfen/parse.js';
import { validateState } from '../gsfen/validate.js';
import { serializeGSFEN } from '../gsfen/serialize.js';
import { serializeGAN } from '../gan/serialize.js';
import { getLegalDestinations } from '../board/movement.js';
import { topPiece, trySquare } from '../board/board.js';
import { ALL_PIECE_TYPES, START_GSFEN } from '../constants.js';
import { validatePlacement } from './deploy.js';
import { validatePlay } from './battle.js';
import { applyPlacement } from './apply.js';
import { checkTerminal } from './terminal.js';

/* ------------------------------------------------------------------ */
/*  Deploy zone helper                                                 */
/* ------------------------------------------------------------------ */

/** Rows where each player may place during the Deploy Phase (BR-DEPLOY-004). */
const DEPLOY_ZONE: Record<Player, [number, number]> = {
  white: [7, 9],
  black: [1, 3],
};

/* ------------------------------------------------------------------ */
/*  Game class                                                         */
/* ------------------------------------------------------------------ */

export class Game {
  /** Current game state. */
  #state: GameState;

  /** Terminal result. { kind: 'ongoing' } while the game is in progress. */
  #result: GameResult;

  /**
   * Prior states for Repetition detection.
   *
   * Only Battle Phase states are recorded here (one entry per completed
   * Turn, stored *before* the Turn's action is applied).  Deploy Phase
   * states are never recorded.
   *
   * The initial Battle Phase state is recorded by `applyPlacement` when
   * it transitions from Deploy to Battle, making it the first occurrence
   * for Repetition counting.
   */
  #history: GameState[];

  /* ---------------------------------------------------------------- */
  /*  Constructor                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Create a new Game from a GSFEN string.
   *
   * @param gsfen - Initial state in GSFEN format.  Defaults to `startpos`.
   * @throws GameError if the GSFEN string is invalid.
   */
  constructor(gsfen?: string) {
    const input = gsfen ?? START_GSFEN;
    const parseResult = parseGSFEN(input);
    if (!parseResult.ok) {
      throw new GameError(
        `Failed to parse initial GSFEN: ${parseResult.error.message}`,
        parseResult.error.rule,
      );
    }

    const validationResult = validateState(parseResult.state);
    if (!validationResult.ok) {
      throw new GameError(
        `Initial GSFEN is not a valid game state: ${validationResult.error.message}`,
        validationResult.error.rule,
      );
    }

    this.#state = parseResult.state;
    this.#result = { kind: 'ongoing' };
    this.#history = [];
  }

  /* ---------------------------------------------------------------- */
  /*  Static factory                                                   */
  /* ---------------------------------------------------------------- */

  /** Create a Game from an existing GameState (no validation). */
  static fromState(state: GameState): Game {
    const g = new Game(START_GSFEN);
    g.#state = state;
    g.#result = { kind: 'ongoing' };
    g.#history = [];
    return g;
  }

  /* ---------------------------------------------------------------- */
  /*  Read-only queries                                                */
  /* ---------------------------------------------------------------- */

  /** The current GameState. */
  get state(): GameState {
    return this.#state;
  }

  /**
   * The current game result.
   * `{ kind: 'ongoing' }` while the game continues.
   */
  get result(): GameResult {
    return this.#result;
  }

  /**
   * All prior states for Repetition detection.
   * Only Battle Phase states are recorded.
   */
  get history(): GameState[] {
    return [...this.#history];
  }

  /* ---------------------------------------------------------------- */
  /*  Serialization                                                    */
  /* ---------------------------------------------------------------- */

  /** Current state as a canonical GSFEN string. */
  toGsfen(): string {
    return serializeGSFEN(this.#state);
  }

  /** Serialize an Action to a canonical GAN string. */
  toGan(action: Action): string {
    return serializeGAN(action);
  }

  /* ---------------------------------------------------------------- */
  /*  legalActions                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * All legal Actions for the current player.
   *
   * For each action shape, generates every candidate and filters it
   * through the appropriate validator.  This is deliberately brute-force:
   * the naive oracle trades performance for auditability.
   */
  get legalActions(): Action[] {
    if (this.#result.kind !== 'ongoing') return [];
    return this.#state.turn.phase === 'deploy' ? this.#legalPlacements() : this.#legalPlays();
  }

  /* ---------- Deploy-phase helpers ---------- */

  /** All legal Placement actions. */
  #legalPlacements(): Action[] {
    const actions: Action[] = [];
    const player = this.#state.turn.activePlayer;
    const hand = this.#state.hands[player];
    const [zoneMin, zoneMax] = DEPLOY_ZONE[player];

    for (const pt of ALL_PIECE_TYPES) {
      if (hand[pt] < 1) continue;

      for (let r = zoneMin; r <= zoneMax; r++) {
        for (let c = 1; c <= 9; c++) {
          const dest = trySquare(c, r);
          if (dest === null) continue;

          const action: Action = { kind: 'placement', piece: pt, dest, done: false };
          if (validatePlacement(this.#state, action).ok) {
            actions.push(action);
            // Done declaration is valid on any valid placement
            actions.push({ ...action, done: true });
          }
        }
      }
    }

    return actions;
  }

  /* ---------- Battle-phase helpers ---------- */

  /** All legal Move and Arata actions. */
  #legalPlays(): Action[] {
    const actions: Action[] = [];
    const player = this.#state.turn.activePlayer;

    // ── Moves ──────────────────────────────────────────────────
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stack = this.#state.position[r][c];
        if (stack === null) continue;
        if (topPiece(stack).owner !== player) continue;

        const origin = { col: (c + 1) as BoardCoord, row: (r + 1) as BoardCoord };
        const moves = getLegalDestinations(this.#state.position, origin, player);

        for (const move of moves) {
          const baseAction: Action = {
            kind: 'move',
            origin,
            dest: move.dest,
            outcome: move.outcome === 'stack' ? 'stack' : null,
            turncoat: [],
          };

          // Validate via validatePlay (includes Self Check)
          if (validatePlay(this.#state, baseAction).ok) {
            actions.push(baseAction);

            // If choice exists, also add the capture variant
            if (move.outcome === 'stack') {
              const captureAction: Action = { ...baseAction, outcome: 'capture' };
              if (validatePlay(this.#state, captureAction).ok) {
                actions.push(captureAction);
              }
            }
          }

          // Turncoat variants for Captain
          // (computed after base validation to reuse the outcome classification)
          if (topPiece(stack).type === 'T') {
            actions.push(...this.#turncoatVariants(baseAction, move.outcome));
          }
        }
      }
    }

    // ── Aratas ──────────────────────────────────────────────────
    const hand = this.#state.hands[player];

    for (const pt of ALL_PIECE_TYPES) {
      if (hand[pt] < 1) continue;

      for (let dr = 1; dr <= 9; dr++) {
        for (let dc = 1; dc <= 9; dc++) {
          const dest = trySquare(dc, dr);
          if (dest === null) continue;

          const baseAction: Action = {
            kind: 'arata',
            piece: pt,
            dest,
            turncoat: [],
          };

          if (validatePlay(this.#state, baseAction).ok) {
            actions.push(baseAction);

            // Turncoat variants for Captain aratas
            if (pt === 'T') {
              actions.push(...this.#arataTurncoatVariants(dest));
            }
          }
        }
      }
    }

    return actions;
  }

  /** Generate Turncoat variants for a Captain move. */
  #turncoatVariants(baseAction: Action, engineOutcome: 'stack' | 'capture' | null): Action[] {
    if (engineOutcome !== 'stack') return []; // Turncoat only on Stack outcome
    const variants: Action[] = [];
    const base = baseAction as Action & { kind: 'move' };
    for (const turncoat of [[1] as [1], [2] as [2], [1, 2] as [1, 2]]) {
      const action: Action = { ...base, turncoat };
      if (validatePlay(this.#state, action).ok) {
        variants.push(action);
      }
    }
    return variants;
  }

  /** Generate Turncoat variants for a Captain arata. */
  #arataTurncoatVariants(dest: Square): Action[] {
    const variants: Action[] = [];
    for (const turncoat of [[1] as [1], [2] as [2], [1, 2] as [1, 2]]) {
      const action: Action = { kind: 'arata', piece: 'T', dest, turncoat };
      if (validatePlay(this.#state, action).ok) {
        variants.push(action);
      }
    }
    return variants;
  }

  /* ---------------------------------------------------------------- */
  /*  applyAction                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Apply an Action to the current GameState and update the Game.
   *
   * @param action - The Action to apply.
   * @returns ApplyResult with the resulting state and game result.
   *
   * On validation failure (illegal action):
   *   - The Game state is unchanged (BR-ACTION-003).
   *   - `state` is the current (unchanged) GameState.
   *   - `result` is the current game result (ongoing if still playing).
   *   - To distinguish success from failure, check `state === this.#state`
   *     (identity comparison) or re-check `this.result.kind`.
   *
   * On success:
   *   - `state` is the new GameState.
   *   - `result` is the current game result (may be terminal).
   */
  applyAction(action: Action): { state: GameState; result: GameResult } {
    if (this.#result.kind !== 'ongoing') {
      return { state: this.#state, result: this.#result };
    }

    if (this.#state.turn.phase === 'deploy') {
      return this.#applyDeployAction(action);
    }
    return this.#applyBattleAction(action);
  }

  /** Apply a Deploy Phase action. */
  #applyDeployAction(action: Action): { state: GameState; result: GameResult } {
    const validation = validatePlacement(this.#state, action);
    if (!validation.ok) {
      return { state: this.#state, result: this.#result };
    }

    // Record pre-action state in history (for repetition — though deploy
    // states are excluded, we still track them for completeness)
    this.#history.push(this.#state);

    const { state: newState, result: newResult } = applyPlacement(
      this.#state,
      action as Action & { kind: 'placement' },
    );
    this.#state = newState;

    // If the deploy phase just ended, record the initial Battle Phase state
    // in history (the first occurrence for Repetition counting).
    if (this.#state.turn.phase === 'battle') {
      this.#history.push(this.#state);
    }

    if (newResult.kind !== 'ongoing') {
      this.#result = newResult;
    }

    return { state: this.#state, result: newResult };
  }

  /** Apply a Battle Phase action (Move or Arata). */
  #applyBattleAction(action: Action): { state: GameState; result: GameResult } {
    const validation = validatePlay(this.#state, action);
    if (!validation.ok) {
      return { state: this.#state, result: this.#result };
    }

    // Record pre-action state in history (for Repetition)
    this.#history.push(this.#state);

    // Use the pre-computed speculative state (includes turn flip, counter, Turncoat)
    this.#state = validation.speculativeState;

    // Evaluate terminal conditions (BR-GAME-004)
    const terminal = checkTerminal(this.#state, this.#history);
    if (terminal.kind !== 'ongoing') {
      this.#result = terminal;
    }

    return { state: this.#state, result: terminal };
  }
}
