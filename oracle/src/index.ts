/**
 * Public API barrel for the Gungi Oracle.
 *
 * ## Usage
 * ```typescript
 * import { parseGSFEN, serializeGSFEN, validateMove, GameError } from './index.js';
 * ```
 *
 * ## Exports
 * | Module | Exports |
 * |--------|---------|
 * | `types.js` | Core domain types (Player, Piece, GameState, Action, GameResult, etc.) |
 * | `constants.js` | Piece data, initial counts, movement patterns, START_GSFEN |
 * | `errors.js` | GameError — typed error carrying BR-xxx rule reference |
 * | `gsfen/parse.js` | parseGSFEN — GSFEN string → GameState |
 * | `gsfen/validate.js` | validateState, validateAction — semantic validity (V-codes) |
 * | `gsfen/serialize.js` | serializeGSFEN — GameState → canonical GSFEN string |
 * | `gsfen/fixtures.js` | (NOTE: re-exported via constants barrel route — import directly) |
 * | `gan/parse.js` | parseGAN — GAN string → Action |
 * | `gan/validate.js` | validateAction — GAN semantic validity (S-codes) |
 * | `gan/serialize.js` | serializeGAN — Action → canonical GAN string |
 * | `game/validation.js` | ValidationResult, PlayValidation shared types |
 * | `game/battle.js` | validateMove, validateArata, validatePlay |
 * | `game/deploy.js` | validatePlacement |
 * | `game/apply.js` | ApplyResult, applyPlacement (Step 9) |
 * | `game/terminal.js` | evaluateExposure (BR-DEPLOY-012) |
 *
 * @module
 */

export * from './types.js';
export * from './constants.js';
export * from './errors.js';
export * from './gsfen/parse.js';
export * from './gsfen/validate.js';
export * from './gsfen/serialize.js';
// GAN parser — explicit re-exports (ParseResult re-export conflicts with gsfen/parse)
export { parseGAN, parseSquare, parseTurncoat } from './gan/parse.js';
// GAN validator — explicit re-exports (ValidationResult re-export conflicts with gsfen/validate)
export { validateAction } from './gan/validate.js';
// GAN serializer
export {
  serializeGAN,
  serializeSquare,
  serializeTurncoat,
  serializePlacement,
  serializeMove,
  serializeArata,
} from './gan/serialize.js';
// Game engine — validation types from the shared module
export type { ValidationResult, PlayValidation } from './game/validation.js';
export { validateMove, validateArata, validatePlay } from './game/battle.js';
export { validatePlacement } from './game/deploy.js';
// Step 9 — Deploy Phase application
export type { ApplyResult } from './game/apply.js';
export { applyPlacement } from './game/apply.js';
// Step 9 — Exposure evaluation
export { evaluateExposure } from './game/terminal.js';
// Step 11 — Terminal conditions
export { checkTerminal, hasLegalPlays } from './game/terminal.js';
// Step 12 — Public API
export { Game } from './game/game.js';
