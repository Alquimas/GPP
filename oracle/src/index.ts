/** Public API for the Gungi reference implementation. */

export * from './types.js';
export {
  ALL_PIECE_TYPES,
  PIECE_NAMES,
  INITIAL_COUNTS,
  EMPTY_HAND,
  FULL_HAND,
  PIECE_MOVEMENT,
  START_GSFEN,
} from './constants.js';
export { GameError } from './errors.js';
export type { GameRule } from './errors.js';

export { parseGSFEN } from './gsfen/parse.js';
export { validateState } from './gsfen/validate.js';
export { serializeGSFEN } from './gsfen/serialize.js';

export { parseGAN } from './gan/parse.js';
export { serializeGAN } from './gan/serialize.js';

export { initialState, initialGlobalState } from './game/initial.js';
export type { StepResult } from './game/engine.js';
export { step, legalActions } from './game/engine.js';
export type { ApplyActionResult } from './game/game.js';
export { Game } from './game/game.js';
