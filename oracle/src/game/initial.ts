import type { GameState, GlobalState } from '../types.js';
import { START_GSFEN } from '../constants.js';
import { parseGSFEN } from '../gsfen/parse.js';

/** Build a fresh canonical starting state. */
export function initialState(): GameState {
  const parsed = parseGSFEN(START_GSFEN);
  if (!parsed.ok) {
    throw new Error(`Invalid built-in START_GSFEN: ${parsed.error.message}`);
  }
  return parsed.state;
}

/** Build a fresh runtime container for the pure engine. */
export function initialGlobalState(): GlobalState {
  return {
    current: initialState(),
    history: [],
    result: { kind: 'ongoing' },
  };
}
