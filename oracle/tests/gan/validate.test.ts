import { describe, it, expect } from 'vitest';
import { validateAction } from '../../src/gan/validate.js';
import { parseGAN } from '../../src/gan/parse.js';
import type { Action, GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { setStack, createStack } from '../../src/board/board.js';
import {
  ARATA_ZONE_TEST,
  BATTLE_MID_VARIANT,
  BATTLE_MINIMAL,
  DEPLOY_FULL_STACK_PAWNS,
  MARSHAL_ALONE_BATTLE,
  CHOICE_POS,
} from '../support/fixtures.js';
import { validateState } from '../../src/gsfen/validate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a GSFEN string and validate the resulting state. Fails fast on illegal fixtures. */
function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  const valid = validateState(result.state);
  if (!valid.ok) {
    throw new Error(`Fixture is an illegal state: ${valid.error.message} (${valid.error.rule})`);
  }
  return result.state;
}

/** Create a minimal deploy-phase GameState for testing. */
function deployState(activePlayer: 'white' | 'black' = 'white'): GameState {
  const state = gsfenState('startpos');
  // Override the active player if needed (startpos always has white to place)
  if (activePlayer !== state.turn.activePlayer) {
    state.turn.activePlayer = activePlayer;
  }
  return state;
}

/** Create a minimal battle-phase GameState for testing. */
function battleState(): GameState {
  return gsfenState(BATTLE_MINIMAL);
}

// ---------------------------------------------------------------------------
// BR-GAN-VALID-001 --- Phase match
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-001 --- Phase match', () => {
  it('accepts placement in deploy phase', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 } };
    const state = deployState();
    const result = validateAction(action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects placement in battle phase', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 } };
    const state = battleState();
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });

  it('accepts move in battle phase', () => {
    // Use MARSHAL_ALONE_BATTLE: White Marshal at (5,9) stepping left to (4,9) --- valid move
    const state = parseGSFEN(MARSHAL_ALONE_BATTLE);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 9 },
      dest: { col: 4, row: 9 },
      outcome: null,
      turncoat: [],
    };
    const result = validateAction(action, state.state);
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
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });

  it('accepts arata in battle phase', () => {
    // Use BATTLE_MID_VARIANT: White has Pawns in hand, (5,7) is in arata zone
    const state = parseGSFEN(BATTLE_MID_VARIANT);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = { kind: 'arata', piece: 'P', dest: { col: 5, row: 7 }, turncoat: [] };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(true);
  });

  it('rejects arata in deploy phase', () => {
    const action: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [] };
    const state = deployState();
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-002 --- Placement legality
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-002 --- Placement legality', () => {
  it('accepts a valid Marshal placement in deploy zone', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 } };
    const state = deployState('white');
    const result = validateAction(action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects placement of a piece not in hand', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 } };
    const state = deployState('white');
    // Remove Marshal from White's hand to simulate it's already placed
    state.hands.white.M = 0;
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-002');
  });

  it('rejects placement outside deploy zone', () => {
    const action: Action = { kind: 'placement', piece: 'M', dest: { col: 5, row: 5 } };
    const state = deployState('white');
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-004');
  });

  it('rejects placement on a full stack (size 3)', () => {
    // DEPLOY_FULL_STACK_PAWNS: PPP (size 3) at (5,9) in White's deploy zone.
    // Placing General on top should fail.
    const state = parseGSFEN(DEPLOY_FULL_STACK_PAWNS);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = { kind: 'placement', piece: 'G', dest: { col: 5, row: 9 } };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-005');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-005 --- Turncoat legality
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-005 --- Turncoat legality', () => {
  it('rejects Captain turncoat when the selected level is friendly', () => {
    // ARATA_ZONE_TEST: White has Captain (T) in hand, General at (5,6).
    // T*5-6+1: arata onto friendly General (size 1 < 3, in zone rows 6-9).
    // Level 1 contains a friendly General, so it cannot be replaced.
    const state = parseGSFEN(ARATA_ZONE_TEST);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [1] };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-STACK-006');
  });

  it('rejects turncoat on non-Captain arata', () => {
    // ARATA_ZONE_TEST: White has Pawn in hand, (5,6) has friendly General.
    // P*5-6+1: only a Captain may trigger Turncoat.
    const state = parseGSFEN(ARATA_ZONE_TEST);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = { kind: 'arata', piece: 'P', dest: { col: 5, row: 6 }, turncoat: [1] };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-STACK-006');
  });

  it('rejects move turncoat when the moving piece is not a Captain', () => {
    // CHOICE_POS: White GG (size 2) at (5,9), Black p (size 1) at (5,8).
    // A General cannot trigger Turncoat.
    const state = parseGSFEN(CHOICE_POS);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 9 },
      dest: { col: 5, row: 8 },
      outcome: 'stack',
      turncoat: [2],
    };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-STACK-006');
  });

  it('rejects turncoat on move with capture outcome', () => {
    // CHOICE_POS: White GG (size 2) at (5,9), Black p (size 1) at (5,8).
    // A move 5-9>5-8 with outcome=capture would be valid, but turncoat is rejected.
    const state = parseGSFEN(CHOICE_POS);
    if (!state.ok) throw new Error('parse failed');
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 9 },
      dest: { col: 5, row: 8 },
      outcome: 'capture',
      turncoat: [1],
    };
    const result = validateAction(action, state.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-STACK-006');
  });
});

// ---------------------------------------------------------------------------
// BR-GAN-VALID-006 --- Done legality (deploy-phase, Marshal deployed)
// ---------------------------------------------------------------------------

describe('BR-GAN-VALID-006 --- Done legality', () => {
  it('accepts done in deploy phase when Marshal is deployed', () => {
    // State: Black to place, Black's Marshal already on board at (5,3).
    const state = deployState('black');
    state.position = setStack(
      state.position,
      { col: 5, row: 3 },
      createStack([{ type: 'M', owner: 'black' }]),
    );
    state.hands.black.M = 0; // Marshal no longer in hand
    const action: Action = { kind: 'done' };
    const result = validateAction(action, state);
    expect(result.ok).toBe(true);
  });

  it('rejects done before the Marshal is deployed (BR-DEPLOY-003)', () => {
    // startpos: White's Marshal is still in hand.
    const state = deployState('white');
    const action: Action = { kind: 'done' };
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-DEPLOY-003');
  });

  it('rejects done in battle phase (BR-GAN-VALID-001)', () => {
    const action: Action = { kind: 'done' };
    const state = battleState();
    const result = validateAction(action, state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.rule).toBe('BR-GAN-VALID-001');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: parse + validate integration
// ---------------------------------------------------------------------------

describe('parse + validate integration', () => {
  it('parses and validates a valid placement', () => {
    const result = parseGSFEN('startpos');
    if (!result.ok) throw new Error('parse failure');
    const state = result.state;

    const parseResult = parseGAN('M5-9');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction(parseResult.action, state);
    expect(validation.ok).toBe(true);
  });

  it('parses and validates a valid move through the pipeline', () => {
    const state = parseGSFEN(MARSHAL_ALONE_BATTLE);
    if (!state.ok) throw new Error('parse failed');

    const parseResult = parseGAN('5-9>4-9');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction(parseResult.action, state.state);
    expect(validation.ok).toBe(true);
  });

  it('parses and validates a valid arata through the pipeline', () => {
    const state = parseGSFEN(BATTLE_MID_VARIANT);
    if (!state.ok) throw new Error('parse failed');

    const parseResult = parseGAN('P*5-7');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction(parseResult.action, state.state);
    expect(validation.ok).toBe(true);
  });

  it('rejects an illegal move through the parse+validate pipeline', () => {
    const state = parseGSFEN(MARSHAL_ALONE_BATTLE);
    if (!state.ok) throw new Error('parse failed');
    // Marshal is at (5,9), (5,6) is 3 squares away --- unreachable for a stepper
    const parseResult = parseGAN('5-9>5-6');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction(parseResult.action, state.state);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.rule).toBe('BR-MOVE-003');
  });

  it('rejects an illegal arata through the parse+validate pipeline', () => {
    const state = parseGSFEN(BATTLE_MID_VARIANT);
    if (!state.ok) throw new Error('parse failed');
    // (5,9) has White's Marshal --- cannot arata onto a Marshal
    const parseResult = parseGAN('P*5-9');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const validation = validateAction(parseResult.action, state.state);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.rule).toBe('BR-ARATA-007');
  });
});
