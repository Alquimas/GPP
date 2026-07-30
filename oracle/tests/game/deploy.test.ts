/**
 * Deploy-phase action validation tests (Step 8).
 *
 * Covers validatePlacement --- BR-DEPLOY-001 through BR-DEPLOY-007,
 * including Marshal-first, deploy zone, stacking, and Done.
 *
 * TDD: tests define expected behaviour before implementation.
 */

import { describe, it, expect } from 'vitest';
import type { Action, GameState, PieceType, Square } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { validatePlacement } from '../../src/game/deploy.js';
import { applyPlacement } from '../../src/game/apply.js';
import { step } from '../../src/game/engine.js';
import { getStack, topPiece } from '../../src/board/board.js';
import {
  BOTH_MARSHALS_BATTLE_NOHANDS,
  DEPLOY_AUTO_DONE,
  DEPLOY_BLACK_CTR2,
  DEPLOY_EXPOSURE_DRAW,
  DEPLOY_LAST_PIECE,
  DEPLOY_FULL_STACK_PAWNS,
  DEPLOY_LT_EXPOSURE_DRAW,
  DEPLOY_PHASE_CTR3,
  MP_STACK_DEPLOY_CTR3,
  STARTPOS_EXPANDED,
} from '../support/fixtures.js';

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

function placement(
  piece: PieceType,
  dc: number,
  dr: number,
  done = false,
): Extract<Action, { kind: 'placement' }> {
  return {
    kind: 'placement',
    piece,
    dest: { col: dc as Square['col'], row: dr as Square['row'] },
    done,
  };
}

function applyThroughEngine(state: GameState, action: Extract<Action, { kind: 'placement' }>) {
  const result = step({ current: state, history: [], result: { kind: 'ongoing' } }, action);
  if (!result.ok) throw result.error;
  return {
    state: result.state.current,
    result: result.state.result,
  };
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const STARTPOS = STARTPOS_EXPANDED;

/* ------------------------------------------------------------------ */
/*  validatePlacement                                                  */
/* ------------------------------------------------------------------ */

describe('validatePlacement', () => {
  it('rejects placement during battle phase (BR-DEPLOY-001)', () => {
    const state = gsfenState(BOTH_MARSHALS_BATTLE_NOHANDS);
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
    const state = gsfenState(DEPLOY_PHASE_CTR3);
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

  it('accepts placement on empty square in deploy zone', () => {
    const r = validatePlacement(gsfenState(STARTPOS), placement('M', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('accepts placement on friendly stack under size 3 (BR-DEPLOY-005)', () => {
    // White PM (Pawn+Marshal) at (5,9) size 2 -> stack General on top
    const state = gsfenState(MP_STACK_DEPLOY_CTR3);
    const r = validatePlacement(state, placement('G', 5, 9));
    expect(r.ok).toBe(true);
  });

  it('rejects placement on full stack (size 3) --- BR-DEPLOY-005', () => {
    // Marshal already placed at (5,8) (hand.M=0 so BR-DEPLOY-003 passes).
    // Stack PPP at (5,9) is size 3 --- placing G on top must be rejected.
    const state = gsfenState(DEPLOY_FULL_STACK_PAWNS);
    const r = validatePlacement(state, placement('G', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-005');
  });

  it('rejects placement on top of Marshal (BR-DEPLOY-005)', () => {
    const state = gsfenState(DEPLOY_PHASE_CTR3);
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
    const BLACK_DEPLOY_START = DEPLOY_BLACK_CTR2;

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

/* ------------------------------------------------------------------ */
/*  applyPlacement                                                     */
/* ------------------------------------------------------------------ */

describe('applyPlacement', () => {
  it('places a piece on an empty square and updates hand', () => {
    const state = gsfenState(STARTPOS);
    const r = applyPlacement(state, placement('M', 5, 9));

    // Board: Marshal placed at (5,9)
    const stack = getStack(r.state.position, { col: 5, row: 9 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('M');
    expect(topPiece(stack!).owner).toBe('white');

    // Hand: Marshal removed
    expect(r.state.hands.white.M).toBe(0);

    // Turn: passed to Black
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(2);
    expect(r.deployEnded).toBe(false);
  });

  it('alternates turns between players', () => {
    let state = gsfenState(STARTPOS);

    // White places Marshal
    let r = applyPlacement(state, placement('M', 5, 9));
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(2);

    // Black places Marshal
    state = r.state;
    r = applyPlacement(state, placement('M', 5, 1));
    expect(r.state.turn.activePlayer).toBe('white');
    expect(r.state.turn.counter).toBe(3);
  });

  it('supports stacking onto a friendly stack', () => {
    // MP_STACK_DEPLOY_CTR3: White [P, P] at (5,9) size 2, White's turn
    const state = gsfenState(MP_STACK_DEPLOY_CTR3);
    const r = applyPlacement(state, placement('G', 5, 9));

    // Stack should now be [P,P,G] size 3
    const stack = getStack(r.state.position, { col: 5, row: 9 });
    expect(stack).not.toBeNull();
    expect(stack!.length).toBe(3);
    expect(topPiece(stack!).type).toBe('G');
    expect(topPiece(stack!).owner).toBe('white');

    // General removed from hand
    expect(r.state.hands.white.G).toBe(0);

    // Turn passed to Black
    expect(r.state.turn.activePlayer).toBe('black');
  });

  it('sets done flag and gives opponent the turn when declaring Done', () => {
    const state = gsfenState(STARTPOS);

    // White places Marshal, declares Done
    const r = applyPlacement(state, placement('M', 5, 9, true));
    expect(r.state.turn.done).toBe('white');
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(2);
  });

  it('keeps turn with non-done player when opponent already done', () => {
    let state = gsfenState(STARTPOS);

    // White places Marshal, declares Done
    let r = applyPlacement(state, placement('M', 5, 9, true));
    expect(r.state.turn.done).toBe('white');
    expect(r.state.turn.activePlayer).toBe('black');

    // Black places Marshal, does NOT declare Done --- should keep turn
    state = r.state;
    r = applyPlacement(state, placement('M', 5, 1));
    expect(r.state.turn.done).toBe('white');
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.turn.counter).toBe(3);
  });

  it('transitions to battle phase when both players declare Done (no exposure)', () => {
    let state = gsfenState(STARTPOS);

    // White places Marshal at (5,9)
    let r = applyPlacement(state, placement('M', 5, 9));
    state = r.state;

    // Black places Marshal at (5,1)
    r = applyPlacement(state, placement('M', 5, 1));
    state = r.state;

    // White places Pawn at (5,8), declares Done
    r = applyPlacement(state, placement('P', 5, 8, true));
    state = r.state;
    expect(state.turn.done).toBe('white');
    expect(state.turn.activePlayer).toBe('black');

    // Black places Pawn at (5,2), declares Done -> both done
    const final = applyThroughEngine(state, placement('P', 5, 2, true));

    // No exposure expected (Marshals safely away from enemy pieces)
    expect(final.result.kind).toBe('ongoing');
    expect(final.state.turn.phase).toBe('battle');
    expect(final.state.turn.activePlayer).toBe('white');
    expect(final.state.turn.counter).toBe(1);
    expect(final.state.turn.done).toBeNull();

    // Board should reflect final deploy positions
    const mPos = getStack(final.state.position, { col: 5, row: 9 });
    expect(mPos).not.toBeNull(); // Marshal+Pawn at White's row
    const bpPos = getStack(final.state.position, { col: 5, row: 2 });
    expect(bpPos).not.toBeNull(); // Black Pawn at (5,2)
    expect(topPiece(bpPos!).type).toBe('P');
    expect(topPiece(bpPos!).owner).toBe('black');
  });

  it('auto-Done when player places last piece from hand (BR-DEPLOY-009)', () => {
    // DEPLOY_LAST_PIECE: White has placed all 24 pieces; only 1 Pawn remains in hand.
    // Black has NOT declared Done yet (dw token). Placing the last Pawn should
    // trigger auto-Done (hand empty) and pass the turn to Black.
    const state = gsfenState(DEPLOY_LAST_PIECE);
    expect(state.hands.white.P).toBe(1); // exactly 1 piece left
    expect(state.turn.done).toBeNull(); // Black not done yet

    // Place the last Pawn without declaring Done
    const r = applyPlacement(state, placement('P', 5, 8));

    // White should be marked as Done (auto-Done from hand exhaustion)
    expect(r.state.turn.done).toBe('white');
    expect(r.state.turn.activePlayer).toBe('black');
    expect(r.state.hands.white.P).toBe(0); // hand now empty

    // White's Pawn should be on the board at (5,8)
    const stack = getStack(r.state.position, { col: 5, row: 8 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('white');

    // Game continues (Black still needs to declare Done)
    expect(r.deployEnded).toBe(false);
  });

  it('auto-Done with opponent already Done triggers Exposure (BR-DEPLOY-009 + BR-DEPLOY-012)', () => {
    // DEPLOY_AUTO_DONE: White has placed all 24 pieces; only 1 Pawn remains in hand.
    // Black already declared Done (dwB token). Black General at (1,1) has clear line
    // of sight to White Marshal at (1,9).
    //
    // After White places the last Pawn:
    //   1. White's hand empties -> auto-Done per BR-DEPLOY-009
    //   2. Both players Done -> Deploy Phase ends -> Exposure evaluation
    //   3. White Marshal is under attack by Black General -> White loses
    const state = gsfenState(DEPLOY_AUTO_DONE);
    expect(state.hands.white.P).toBe(1); // exactly 1 piece left
    expect(state.turn.done).toBe('black'); // Black already Done

    // Place the last Pawn in White's deploy zone (any column besides 1)
    const r = applyThroughEngine(state, placement('P', 5, 8));

    // Hand should now be empty
    expect(r.state.hands.white.P).toBe(0);

    // White's Pawn should be on the board at (5,8)
    const stack = getStack(r.state.position, { col: 5, row: 8 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('white');

    // Game ends by Exposure: Black General at (1,1) attacks White Marshal at (1,9)
    expect(r.result.kind).toBe('exposure');
    if (r.result.kind === 'exposure') {
      expect(r.result.loser).toBe('white');
    }
  });

  it('both Marshals under attack at deploy->battle boundary results in Exposure Draw (BR-DEPLOY-012)', () => {
    // DEPLOY_EXPOSURE_DRAW: White already Done (dbW token). Black's turn.
    //
    // Board threats:
    //   - Black General at (1,1) -> range along col 1 -> attacks White Marshal at (1,9)
    //   - White General at (5,9) (top of [N,N,G]) -> range along col 5 -> attacks Black Marshal at (5,1)
    //
    // Black places any piece (except cols 1 and 5 --- to avoid blocking the sight lines)
    // and declares Done -> both players Done -> Exposure -> both exposed -> draw.
    const state = gsfenState(DEPLOY_EXPOSURE_DRAW);
    expect(state.turn.activePlayer).toBe('black');
    expect(state.turn.done).toBe('white'); // White already Done

    // Black places a piece at column 2 (avoids cols 1 and 5, within Black's deploy zone)
    const r = applyThroughEngine(state, placement('P', 2, 2, true));

    // Black's Pawn should be at (2,2)
    const stack = getStack(r.state.position, { col: 2, row: 2 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('black');

    // Both Marshals exposed -> draw
    expect(r.result.kind).toBe('exposure-draw');
  });

  it('Lieutenants expose both Marshals at deploy->battle boundary resulting in Exposure Draw (BR-DEPLOY-012)', () => {
    // DEPLOY_LT_EXPOSURE_DRAW: White already Done (dbW token). Black has 1 Pawn left.
    //
    // Diagonal sight lines:
    //   - Black Lt at (9,1) -> FL range -> attacks White Marshal at (1,9)
    //   - White Lt at (9,9) -> FR range -> attacks Black Marshal at (1,1)
    //
    // Black must place the last Pawn anywhere except (2,2) or (3,3) --- those
    // squares lie on the White Lieutenant's diagonal path and would obstruct it.
    const state = gsfenState(DEPLOY_LT_EXPOSURE_DRAW);
    expect(state.turn.activePlayer).toBe('black');
    expect(state.turn.done).toBe('white');
    expect(state.hands.black.P).toBe(1); // Black's last piece

    // Place at (5,3) --- within Black's deploy zone, not on diagonal path
    const r = applyThroughEngine(state, placement('P', 5, 3));

    // Black's Pawn should be at (5,3)
    const stack = getStack(r.state.position, { col: 5, row: 3 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('black');

    // Hand exhausted -> auto-Done. White already Done. Both done -> Exposure.
    // Both Marshals under attack via diagonal Lieutenant ranges -> draw.
    expect(r.result.kind).toBe('exposure-draw');
  });

  it('Black blocks White Lieutenant by deploying at (3,3), breaking the exposure-draw --- White loses (BR-DEPLOY-012)', () => {
    // Same fixture. Black places last Pawn at (3,3) instead.
    //
    // White Lieutenant's diagonal path: (9,9)->(8,8)->(7,7)->(6,6)->(5,5)->(4,4)->(3,3)->(2,2)->(1,1)
    // Pawn at (3,3) is an obstruction --- the Lieutenant can land on it but
    // cannot extend past it to reach Black Marshal at (1,1).
    //
    // Black Lieutenant at (9,1) still has unobstructed FL path to (1,9).
    // Result: only White Marshal exposed -> White loses.
    const state = gsfenState(DEPLOY_LT_EXPOSURE_DRAW);
    expect(state.hands.black.P).toBe(1);

    // Place at (3,3) --- on the diagonal path, blocks the Lieutenant
    const r = applyThroughEngine(state, placement('P', 3, 3));

    // Black's Pawn at (3,3)
    const stack = getStack(r.state.position, { col: 3, row: 3 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('black');

    // Only White exposed -> White loses
    expect(r.result.kind).toBe('exposure');
    if (r.result.kind === 'exposure') {
      expect(r.result.loser).toBe('white');
    }
  });

  it('Black blocks Black Lieutenant by deploying at (7,3), breaking the exposure-draw --- Black loses (BR-DEPLOY-012)', () => {
    // Same fixture. Black places last Pawn at (7,3) instead.
    //
    // Black Lieutenant's FL path: (9,1)->(8,2)->(7,3)->(6,4)->(5,5)->(4,6)->(3,7)->(2,8)->(1,9)
    // Pawn at (7,3) is an obstruction --- the Lieutenant cannot extend past it
    // to reach White Marshal at (1,9).
    //
    // White Lieutenant at (9,9) still has unobstructed FR path to (1,1).
    // Result: only Black Marshal exposed -> Black loses.
    const state = gsfenState(DEPLOY_LT_EXPOSURE_DRAW);
    expect(state.hands.black.P).toBe(1);

    // Place at (7,3) --- on Black Lieutenant's FL path, blocks the attack
    const r = applyThroughEngine(state, placement('P', 7, 3));

    // Black's Pawn at (7,3)
    const stack = getStack(r.state.position, { col: 7, row: 3 });
    expect(stack).not.toBeNull();
    expect(topPiece(stack!).type).toBe('P');
    expect(topPiece(stack!).owner).toBe('black');

    // Only Black exposed -> Black loses
    expect(r.result.kind).toBe('exposure');
    if (r.result.kind === 'exposure') {
      expect(r.result.loser).toBe('black');
    }
  });
});
