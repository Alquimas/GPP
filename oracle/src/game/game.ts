/**
 * Stateful convenience wrapper around the pure game engine.
 *
 * The domain transition lives in step(). Game only owns the current runtime
 * state and provides serialization-friendly getters for clients and tools.
 */

import type { Action, GameResult, GameState, GlobalState } from '../types.js';
import { GameError } from '../errors.js';
import { parseGSFEN } from '../gsfen/parse.js';
import { validateState } from '../gsfen/validate.js';
import { serializeGSFEN } from '../gsfen/serialize.js';
import { serializeGAN } from '../gan/serialize.js';
import { legalActions, step } from './engine.js';
import { initialGlobalState } from './initial.js';

export type ApplyActionResult =
  | { ok: true; state: GameState; result: GameResult }
  | { ok: false; state: GameState; result: GameResult; error: GameError };

function globalFromState(current: GameState): GlobalState {
  return {
    current,
    history: [],
    result: { kind: 'ongoing' },
  };
}

function parseInitialState(gsfen: string): GameState {
  const parsed = parseGSFEN(gsfen);
  if (!parsed.ok) {
    throw new GameError(
      `Failed to parse initial GSFEN: ${parsed.error.message}`,
      parsed.error.rule,
    );
  }

  const validation = validateState(parsed.state);
  if (!validation.ok) {
    throw new GameError(
      `Initial GSFEN is not a valid game state: ${validation.error.message}`,
      validation.error.rule,
    );
  }

  return parsed.state;
}

export class Game {
  #global: GlobalState;

  /**
   * Create a game from GSFEN or an already constructed GameState.
   * GameState inputs are validated just like parsed GSFEN inputs.
   */
  constructor(source?: string | GameState) {
    if (source === undefined) {
      this.#global = initialGlobalState();
      return;
    }

    const state = typeof source === 'string' ? parseInitialState(source) : source;
    if (typeof source !== 'string') {
      const validation = validateState(state);
      if (!validation.ok) {
        throw new GameError(
          `Initial state is invalid: ${validation.error.message}`,
          validation.error.rule,
        );
      }
    }
    this.#global = globalFromState(state);
  }

  static fromState(state: GameState): Game {
    return new Game(state);
  }

  /** Defensive snapshot of the current game state. */
  get state(): GameState {
    return structuredClone(this.#global.current);
  }

  get result(): GameResult {
    return structuredClone(this.#global.result);
  }

  /** Defensive snapshot of prior Battle Phase states. */
  get history(): GameState[] {
    return structuredClone(this.#global.history);
  }

  toGsfen(): string {
    return serializeGSFEN(this.#global.current);
  }

  toGan(action: Action): string {
    return serializeGAN(action);
  }

  get legalActions(): Action[] {
    return structuredClone(legalActions(this.#global));
  }

  /**
   * Apply one Action.
   *
   * Failures are explicit and leave the internal state unchanged.
   */
  applyAction(action: Action): ApplyActionResult {
    const result = step(this.#global, action);
    if (!result.ok) {
      return {
        ok: false,
        state: this.state,
        result: this.result,
        error: result.error,
      };
    }

    this.#global = result.state;
    return {
      ok: true,
      state: this.state,
      result: this.result,
    };
  }
}
