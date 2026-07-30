/**
 * Typed error hierarchy for the Gungi rule engine.
 *
 * Every game rule violation returns a typed error carrying the BR-xxx
 * rule reference from BUSINESS_RULES.md, rather than throwing.
 *
 * ## Error classes
 * - {@link GameError} — base class for all rule violations.
 *
 * @module
 */

/**
 * The closed vocabulary of rule identifiers that a GameError can cite.
 *
 * Adding a new rule identifier requires updating this union —
 * the compiler will catch every miss.
 */
export type GameRule =
  // Business rules — Battle Phase actions
  | 'BR-ACTION-001'
  | 'BR-ACTION-002'
  | 'BR-GAME-003'
  | 'BR-CAPTURE-002'
  | 'BR-MOVE-002'
  | 'BR-MOVE-003'
  | 'BR-MOVE-004'
  | 'BR-MOVE-005'
  | 'BR-PLAY-002'
  | 'BR-STACK-002'
  | 'BR-STACK-003'
  | 'BR-STACK-004'
  | 'BR-STACK-006'
  // Business rules — Deploy Phase
  | 'BR-DEPLOY-001'
  | 'BR-DEPLOY-002'
  | 'BR-DEPLOY-003'
  | 'BR-DEPLOY-004'
  | 'BR-DEPLOY-005'
  // Business rules — Arata
  | 'BR-ARATA-001'
  | 'BR-ARATA-002'
  | 'BR-ARATA-003'
  | 'BR-ARATA-005'
  | 'BR-ARATA-006'
  | 'BR-ARATA-007'
  // GAN grammar rules
  | 'BR-GAN-GRAMMAR-001'
  | 'BR-GAN-GRAMMAR-002'
  | 'BR-GAN-GRAMMAR-003'
  | 'BR-GAN-GRAMMAR-004'
  | 'BR-GAN-GRAMMAR-005'
  | 'BR-GAN-GRAMMAR-006'
  | 'BR-GAN-GRAMMAR-007'
  | 'BR-GAN-GRAMMAR-008'
  | 'BR-GAN-GRAMMAR-009'
  | 'BR-GAN-GRAMMAR-010'
  | 'BR-GAN-GRAMMAR-011'
  // GAN semantic validity rules
  | 'BR-GAN-VALID-001'
  | 'BR-GAN-VALID-002'
  | 'BR-GAN-VALID-005'
  | 'BR-GAN-VALID-006'
  // GSFEN canonical-form rules
  | 'BR-GSFEN-CANON-COUNTER-LEADING-ZERO'
  | 'BR-GSFEN-CANON-HANDS-ALPHABETICAL'
  | 'BR-GSFEN-CANON-HANDS-COUNT-FORMAT'
  | 'BR-GSFEN-CANON-HANDS-DUPLICATE'
  | 'BR-GSFEN-CANON-HANDS-EMPTY-MARKER'
  | 'BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR'
  | 'BR-GSFEN-CANON-POSITION-COMPRESSION'
  | 'BR-GSFEN-CANON-POSITION-EMPTY-ITEM'
  | 'BR-GSFEN-CANON-POSITION-ROW-COUNT'
  | 'BR-GSFEN-CANON-POSITION-SQUARE-COUNT'
  | 'BR-GSFEN-CANON-POSITION-STACK-SPELLING'
  | 'BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT'
  | 'BR-GSFEN-CANON-SEPARATOR-WHITESPACE'
  | 'BR-GSFEN-CANON-TURN-TOKEN'
  // GSFEN semantic validity rules
  | 'BR-GSFEN-VALID-001-BOTH'
  | 'BR-GSFEN-VALID-001-COUNT'
  | 'BR-GSFEN-VALID-001-FIRST'
  | 'BR-GSFEN-VALID-001-HAND'
  | 'BR-GSFEN-VALID-001-TOP'
  | 'BR-GSFEN-VALID-002'
  | 'BR-GSFEN-VALID-003'
  | 'BR-GSFEN-VALID-004'
  | 'BR-GSFEN-VALID-005';

/**
 * Base error class for all game rule violations.
 * Carries the BR-xxx rule reference.
 */
export class GameError extends Error {
  /** The BR-xxx rule identifier this error violates. */
  rule: GameRule;

  constructor(message: string, rule: GameRule) {
    super(message);
    this.name = 'GameError';
    this.rule = rule;
  }
}
