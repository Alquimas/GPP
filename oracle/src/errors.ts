import type { Action } from './types.js';

export type GameErrorKind = 'deploy' | 'move' | 'arata' | 'self-check' | 'terminal' | 'general';

/**
 * Base error class for all game rule violations.
 * Carries the BR-xxx rule reference and an optional kind discriminator.
 */
export class GameError extends Error {
  /** The BR-xxx rule identifier this error violates. */
  rule: string;

  /** Optional discriminator identifying the error category. */
  kind: GameErrorKind;

  constructor(message: string, rule: string, { kind }: { kind?: GameErrorKind } = {}) {
    super(message);
    this.name = 'GameError';
    this.rule = rule;
    this.kind = kind ?? 'general';
  }
}

/** An action that was attempted but violates one or more rules. */
export class IllegalActionError extends GameError {
  /** The illegal action that was attempted. */
  action: Action;

  constructor(
    message: string,
    rule: string,
    action: Action,
    { kind }: { kind?: GameErrorKind } = {},
  ) {
    // Under exactOptionalPropertyTypes, `{ kind }` when kind is undefined
    // creates a property with value undefined, which doesn't match the
    // parent's `{ kind?: GameErrorKind }` parameter type. Spread conditionally.
    super(message, rule, kind !== undefined ? { kind } : {});
    this.name = 'IllegalActionError';
    this.action = action;
  }
}
