import { describe, it, expect } from 'vitest';
import { validateAction } from '../../src/gan/validate.js';
import { parseGAN } from '../../src/gan/parse.js';
import type { Action, GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { GAN_BATTLE_STATE } from '../../src/gsfen/fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal deploy-phase GameState for testing. */
function deployState(activePlayer: 'white' | 'black' = 'white'): GameState {
  // Parse startpos for a clean deploy state
  const result = parseGSFEN('startpos');
  if (!result.ok) throw new Error('Failed to parse startpos');
  const state = result.state;
  // Override the active player if needed (startpos always has white to place)
  if (activePlayer !== state.turn.activePlayer) {
    state.turn.activePlayer = activePlayer;
  }
  return state;
}

/** Create a minimal battle-phase GameState for testing. */
function battleState(): GameState {
  // Parse battle-start for a clean battle state
  const result = parseGSFEN(GAN_BATTLE_STATE);
  if (!result.ok) throw new Error('Failed to parse battle state');
  return result.state;
}

// ---------------------------------------------------------------------------
// BR-GAN-VALID-001 — Phase match
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-001 — Phase match', () => {
  it('accepts placement in deploy phase', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false };
    const state = deployState();
    const result = validateAction('M5-9', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects placement in battle phase', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false };
    const state = battleState();
    const result = validateAction('M5-9', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });

  it('accepts move in battle phase', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    };
    const state = battleState();
    const result = validateAction('2-7>2-6', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects move in deploy phase', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    };
    const state = deployState();
    const result = validateAction('2-7>2-6', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });

  it('accepts arata in battle phase', () => {
    const action: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [] };
    const state = battleState();
    const result = validateAction('T*5-6', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects arata in deploy phase', () => {
    const action: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [] };
    const state = deployState();
    const result = validateAction('T*5-6', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-002 — Placement legality
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-002 — Placement legality', () => {
  it('accepts a valid Marshal placement in deploy zone', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false };
    const state = deployState('white');
    const result = validateAction('M5-9', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects placement of a piece not in hand', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false };
    const state = deployState('white');
    // Remove Marshal from White's hand to simulate it's already placed
    state.hands.white.M = 0;
    const result = validateAction('M5-9', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-002');
  });

  it('rejects placement outside deploy zone', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 5 }, done: false };
    const state = deployState('white');
    const result = validateAction('M5-5', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-002');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-005 — Turncoat legality
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-005 — Turncoat legality', () => {
  it('accepts arata with Captain and turncoat', () => {
    const action: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [1] };
    const state = battleState();
    const result = validateAction('T*5-6+1', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects turncoat on non-Captain arata', () => {
    const action: Action = { kind: 'arata', piece: 'P', dest: { col: 5, row: 6 }, turncoat: [1] };
    const state = battleState();
    const result = validateAction('P*5-6+1', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-005');
  });

  it('accepts move with stack outcome and turncoat', () => {
    const state = battleState();
    // Place a Captain at origin (5,6) for the turncoat move
    state.position[5][4] = [{ type: 'T', owner: 'white' }];

    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [2],
    };
    const result = validateAction('5-6>5-5=+2', action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects turncoat on move with capture outcome', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [1],
    };
    const state = battleState();
    const result = validateAction('5-6>5-5x+1', action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-005');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-006 — Done legality (enforced at parse level)
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-006 — Done legality', () => {
  it('accepts placement with done=true', () => {
    // State: Black to place, Black's Marshal already placed (count = 0 in hand)
    const state = deployState('black');
    state.hands.black.M = 0; // Marshal already placed
    state.hands.black.G = 1; // General still in hand
    const action: Action = { kind: 'placement', piece: 'G', dest: { col: 5, row: 1 }, done: true };
    const result = validateAction('G5-1!', action, state);
    expect(result.ok).toBe(true);
  });

  it('accepts placement with done=false', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false };
    const state = deployState('white');
    const result = validateAction('M5-9', action, state);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: parse + validate
// ---------------------------------------------------------------------------

describe('parse + validate integration', () => {
  it('parses and validates a valid placement', () => {
    const result = parseGSFEN('startpos');
    if (!result.ok) throw new Error('parse failure');
    const state = result.state;

    const parseResult = parseGAN('M5-9');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction('M5-9', parseResult.action, state);
    expect(validation.ok).toBe(true);
  });
});
