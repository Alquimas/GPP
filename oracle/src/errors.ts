import type { Action } from './types.js';

/**
 * Base error class for all game rule violations.
 * Carries the BR-xxx rule reference.
 */
export class GameError extends Error {
  /** The BR-xxx rule identifier this error violates. */
  rule: string;

  constructor(message: string, rule: string) {
    super(message);
    this.name = 'GameError';
    this.rule = rule;
  }
}

/** An action that was attempted but violates one or more rules. */
export class IllegalActionError extends GameError {
  /** The illegal action that was attempted. */
  action: Action;

  constructor(message: string, rule: string, action: Action) {
    super(message, rule);
    this.name = 'IllegalActionError';
    this.action = action;
  }
}

/** Deploy phase rule violation. */
export class DeployError extends GameError {
  constructor(message: string, rule: string) {
    super(message, rule);
    this.name = 'DeployError';
  }
}

/** Move validation rule violation. */
export class MoveError extends GameError {
  constructor(message: string, rule: string) {
    super(message, rule);
    this.name = 'MoveError';
  }
}

/** Arata validation rule violation. */
export class ArataError extends GameError {
  constructor(message: string, rule: string) {
    super(message, rule);
    this.name = 'ArataError';
  }
}

/** Self-Check violation (BR-ACTION-002). */
export class SelfCheckError extends GameError {
  constructor(message: string) {
    super(message, 'BR-ACTION-002');
    this.name = 'SelfCheckError';
  }
}

/** Terminal condition evaluation. */
export class TerminalError extends GameError {
  constructor(message: string, rule: string) {
    super(message, rule);
    this.name = 'TerminalError';
  }
}
