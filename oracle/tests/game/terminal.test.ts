/**
 * Terminal condition tests (Step 9: evaluateExposure).
 *
 * Covers BR-DEPLOY-012 — Exposure evaluation at the Deploy→Battle boundary.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { GameState } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { evaluateExposure } from '../../src/game/terminal.js';
import { getStack, setStack, createStack } from '../../src/board/board.js';
import {
  BOTH_MARSHALS_PLACED,
  DEPLOY_BLACK_MARSHAL_PLACED,
  DEPLOY_PHASE_CTR1,
  WHITE_MARSHAL_AT_5_9,
} from '../../src/gsfen/fixtures.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  const validation = validateState(result.state);
  if (!validation.ok) {
    throw new Error(
      `Test fixture is an illegal game state: ${validation.error.message} (${validation.error.rule})`,
    );
  }
  return result.state;
}

/* ------------------------------------------------------------------ */
/*  evaluateExposure                                                   */
/* ------------------------------------------------------------------ */

describe('evaluateExposure', () => {
  it('returns ongoing when neither Marshal is under attack', () => {
    // BOTH_MARSHALS_PLACED: White M at (5,9), Black m at (5,1), no enemy threats
    const state = gsfenState(BOTH_MARSHALS_PLACED);
    const r = evaluateExposure(state.position);
    expect(r.kind).toBe('ongoing');
  });

  it('returns exposure with loser when White Marshal is under attack', () => {
    // Start from state with White Marshal at (5,9), place threatening piece
    const state = gsfenState(WHITE_MARSHAL_AT_5_9);

    // Black General at (5,1) can range along the file unobstructed → attacks (5,9)
    const pos = setStack(
      state.position,
      { col: 5, row: 1 },
      createStack([{ type: 'G', owner: 'black' }]),
    );
    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure');
    if (r.kind === 'exposure') expect(r.loser).toBe('white');
  });

  it('returns exposure with loser when Black Marshal is under attack', () => {
    // DEPLOY_BLACK_MARSHAL_PLACED: Black m at (5,1)
    const state = gsfenState(DEPLOY_BLACK_MARSHAL_PLACED);

    // White General at (5,9) can range along the file unobstructed → attacks (5,1)
    const pos = setStack(
      state.position,
      { col: 5, row: 9 },
      createStack([{ type: 'G', owner: 'white' }]),
    );
    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure');
    if (r.kind === 'exposure') expect(r.loser).toBe('black');
  });

  it('returns exposure-draw when both Marshals are under attack', () => {
    // Build a position where both Marshals are threatened.
    // White M at (5,9), Black m at (5,1).
    // White General at (5,2) threatens (5,1) — Black Marshal.
    // Black General at (5,8) threatens (5,9) — White Marshal.
    let state = gsfenState(BOTH_MARSHALS_PLACED);

    // Add White General at (5,2) to threaten Black Marshal at (5,1)
    let pos = setStack(
      state.position,
      { col: 5, row: 2 },
      createStack([{ type: 'G', owner: 'white' }]),
    );

    // Add Black General at (5,8) to threaten White Marshal at (5,9)
    pos = setStack(
      pos,
      { col: 5, row: 8 },
      createStack([{ type: 'G', owner: 'black' }]),
    );

    const r = evaluateExposure(pos);
    expect(r.kind).toBe('exposure-draw');
  });

  it('returns ongoing when no Marshals are on board (deploy phase edge case)', () => {
    // DEPLOY_PHASE_CTR1: deploy phase, no pieces placed
    const state = gsfenState(DEPLOY_PHASE_CTR1);
    const r = evaluateExposure(state.position);
    expect(r.kind).toBe('ongoing');
  });
});
