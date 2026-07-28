/**
 * Deploy-phase action validation tests (Step 8).
 *
 * Covers validatePlacement — BR-DEPLOY-001 through BR-DEPLOY-007,
 * including Marshal-first, deploy zone, stacking, and Done.
 *
 * TDD: tests define expected behaviour before implementation.
 */

import { describe, it, expect } from 'vitest';
import type { Action, GameState, PieceType, Square } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validatePlacement } from '../../src/game/deploy.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state;
}

function placement(piece: PieceType, dc: number, dr: number, done = false): Action {
  return {
    kind: 'placement',
    piece,
    dest: { col: dc as Square['col'], row: dr as Square['row'] },
    done,
  };
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const STARTPOS = '9/9/9/9/9/9/9/9/9 dw 2AC3E2FG2JLM2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1';

/* ------------------------------------------------------------------ */
/*  validatePlacement                                                  */
/* ------------------------------------------------------------------ */

describe('validatePlacement', () => {
  it('rejects placement during battle phase (BR-DEPLOY-001)', () => {
    const state = gsfenState('4,m,4/9/9/9/9/9/9/9/4,M,4 w - 2');
    const r = validatePlacement(state, placement('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-001');
  });

  it('accepts placement during deploy phase', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('rejects placement when piece not in hand', () => {
    // White has already placed Marshal, so M is no longer in hand
    const state = gsfenState(
      '9/9/9/9/9/9/9/9/4,M,4 dw 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 3',
    );
    const r = validatePlacement(state, placement('M', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-002');
  });

  it('enforces Marshal-first placement (BR-DEPLOY-003)', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('P', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-003');
  });

  it('accepts Marshal as first placement (BR-DEPLOY-003)', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('rejects placement outside deploy zone (BR-DEPLOY-004)', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 5));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-004');
  });

  it('rejects placement on enemy-topped square', () => {
    // Black Pawn at (5,8) — White cannot place there
    const state = gsfenState(
      '9/9/9/9/9/9/9/4,p,4/4,M,4 dw 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 3',
    );
    const r = validatePlacement(state, placement('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-005');
  });

  it('accepts placement on empty square in deploy zone', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('accepts placement on friendly stack under size 3 (BR-DEPLOY-005)', () => {
    // White MP (Marshal+Pawn) at (5,9) size 2 → stack General on top
    const state = gsfenState(
      '9/9/9/9/9/9/9/9/4,MP,4 dw 2AC3E2FG2JL2N3P2STU2Y2ac3e2fg2jlm2n4p2stu2y 3',
    );
    const r = validatePlacement(state, placement('G', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('rejects placement on full stack (size 3) — BR-DEPLOY-005', () => {
    // Marshal already placed at (5,8) (hand.M=0 so BR-DEPLOY-003 passes).
    // Stack PPP at (5,9) is size 3 — placing G on top must be rejected.
    const state = gsfenState(
      '9/9/9/9/9/9/9/4,M,4/4,PPP,4 dw 2AC3E2FG2JL2N4PSTU2Y2ac3e2fg2jlm2n4p2stu2y 3',
    );
    const r = validatePlacement(state, placement('G', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-005');
  });

  it('rejects placement on top of Marshal (BR-DEPLOY-005)', () => {
    const state = gsfenState(
      '9/9/9/9/9/9/9/9/4,M,4 dw 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 3',
    );
    const r = validatePlacement(state, placement('G', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-STACK-004');
  });

  it('accepts placement with done=true on valid square', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 9, true));
    expect(r.ok).toBe(true);
  });

  it('rejects placement with done=true on invalid square (BR-DEPLOY-007 + BR-DEPLOY-004)', () => {
    // Done=true doesn't bypass other validation rules.
    // Placing outside deploy zone must still be rejected even if done=true.
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 5, true));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-004');
  });

  describe('Black player deploy zone (BR-DEPLOY-004 symmetry)', () => {
    const BLACK_DEPLOY_START =
      '9/9/9/9/9/9/9/9/4,M,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fgjlm2n4p2stu2y 2';

    it('accepts Black placement in Black deploy zone (rows 1-3)', () => {
      // Black's turn (after White placed Marshal). Black places Marshal at (5,1).
      const r = validatePlacement(gsfenState(BLACK_DEPLOY_START), placement('M', 5, 1));
      expect(r.ok).toBe(true);
    });

    it('rejects Black placement outside Black deploy zone (row 5)', () => {
      const r = validatePlacement(gsfenState(BLACK_DEPLOY_START), placement('M', 5, 5));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-004');
    });

    it('rejects Black placement in White deploy zone (row 9)', () => {
      // Marshal must be placed first (BR-DEPLOY-003), and it must be in the deploy zone (BR-DEPLOY-004).
      // Row 9 is outside Black's deploy zone, so BR-DEPLOY-004 fires (after BR-DEPLOY-003 passes for Marshal).
      const r = validatePlacement(gsfenState(BLACK_DEPLOY_START), placement('M', 5, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-004');
    });

    it('accepts Black Marshal at row 3 (boundary of Black deploy zone)', () => {
      const r = validatePlacement(gsfenState(BLACK_DEPLOY_START), placement('M', 5, 3));
      expect(r.ok).toBe(true);
    });

    it('rejects Black Marshal at row 4 (just outside Black deploy zone)', () => {
      const r = validatePlacement(gsfenState(BLACK_DEPLOY_START), placement('M', 5, 4));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-004');
    });
  });
});
