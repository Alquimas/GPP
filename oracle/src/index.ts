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
export { applyMove, applyArata } from './game/apply.js';
