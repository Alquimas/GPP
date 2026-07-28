/**
 * Battle-phase action validation tests (Step 8).
 *
 * Covers:
 * - validateMove — BR-MOVE-001/002/003/005, BR-STACK-002/003/004,
 *   BR-CAPTURE-001/002/003, BR-ACTION-002 (Self Check)
 * - validateArata — BR-ARATA-001 through BR-ARATA-007, BR-ACTION-002
 * - validatePlay — dispatcher
 *
 * TDD: tests are written first; they define expected behaviour before
 * implementation.
 */

import { describe, it, expect } from 'vitest';
import type { Action, GameState, PieceType, Square, TurncoatLevels } from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateMove, validateArata, validatePlay } from '../../src/game/battle.js';
import { getStack, stackSize, topPiece } from '../../src/board/board.js';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function gsfenState(gsfen: string): GameState {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state;
}

function move(
  oc: number,
  or: number,
  dc: number,
  dr: number,
  outcome: 'stack' | 'capture' | null = null,
  turncoat: TurncoatLevels = [],
): Action {
  return {
    kind: 'move',
    origin: { col: oc as Square['col'], row: or as Square['row'] },
    dest: { col: dc as Square['col'], row: dr as Square['row'] },
    outcome,
    turncoat,
  };
}

function arata(piece: PieceType, dc: number, dr: number, turncoat: TurncoatLevels = []): Action {
  return {
    kind: 'arata',
    piece,
    dest: { col: dc as Square['col'], row: dr as Square['row'] },
    turncoat,
  };
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

/** Battle-midgame: White to move, turn 14 */
const BATTLE_W =
  '4,m,4/4,g,4/4,s,4/4,P,4/9/9/4,A,4/4,GS,4/4,M,4 w C2E2F2JL2N3PUYac3e2f2jln4ptuy 14';

/** Simple battle position: White Marshal at (5,9), empty board, White turn. */
const MARSHAL_ALONE = '9/9/9/9/9/9/9/9/4,M,4 w - 2';

/** Battle: White size-2 stack at (5,9), single Black Pawn at (5,8) — choice exists. */
const CHOICE_POS = '4,m,4/4,g,4/9/9/9/9/9/4,p,4/4,GG,4 w C2E2F2JL2N4P3STU2Yac3e2f2j2ln4p2stu2y 3';

/** Battle: White size-3 stack at (5,9), Black 3-stack at (5,8) — capture forced. */
const FORCED_CAPTURE =
  '4,m,4/4,g,4/9/9/9/9/9/4,ppp,4/4,GGG,4 w C2E2F2JL2N4PSTU2Yac3e2f2j2ln4p2stu2y 3';

/** Battle: White size-1 Marshal at (5,9), friendly size-3 stack at (5,7) — too tall. */
const SIZE_MISMATCH =
  '4,m,4/4,g,4/9/9/9/9/4,AFG,4/4,G,4/4,M,4 w AC2E2JL2N4P2STU2Yac2e2fjln4p2stu2y 5';

/** Black-turn position: Marshal at (5,1), open board. */
const BLACK_TURN = '4,m,4/9/9/9/9/9/9/9/9 b - 2';

/**
 * Friendly stacking test case — White Marshal at (5,9), White Pawn at (5,8).
 * Marshal moves forward to (5,8) → automatic stacking on friendly piece.
 * All other pieces are in hands. Black Marshal at (5,1) is far away.
 */
const FRIENDLY_STACK =
  '9/9/9/9/9/9/9/4,P,4/4,M,4 w 2AC3E2FG2JL2N3P2STU2Y2ac3e2fgjl2n4p2stu2y 2';

/**
 * Self Check test case — Marshal stack-size change after capture exposes it.
 *
 * White turn. (5,9) = stack [P,P,M] size 3, top = White Marshal.
 * (5,8) = Black Pawn [p] size 1.
 * (5,7) = Black General [g] size 1.
 *
 * Marshal captures (5,8) → Marshal becomes size 1 at (5,8).
 * General at (5,7) has range forward and can now attack (5,8) since
 * source size 1 >= target size 1 → Self Check.
 */
const SELF_CHECK_POS = '9/9/9/9/9/9/4,g,4/4,p,4/4,PPM,4 w - 2';

/* ------------------------------------------------------------------ */
/*  validateMove                                                       */
/* ------------------------------------------------------------------ */

describe('validateMove', () => {
  describe('BR-PLAY-002 — phase check', () => {
    it('rejects a move during deploy phase', () => {
      // Deploy-phase state (STARTPOS-like): any move must be rejected.
      const state = gsfenState(
        '9/9/9/9/9/9/9/9/4,M,4 dw 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1',
      );
      const r = validateMove(state, move(5, 9, 4, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-PLAY-002');
    });
  });

  describe('BR-MOVE-002 — origin must contain own piece', () => {
    it('rejects move from an empty square', () => {
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 6, 5, 5));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-002');
    });

    it('rejects move from a square whose top piece belongs to opponent', () => {
      const r = validateMove(gsfenState(BATTLE_W), move(5, 1, 5, 2));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-002');
    });

    it('accepts move from a square whose top piece belongs to active player', () => {
      // White Marshal at (5,9) — move left to (4,9) which is empty
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9));
      expect(r.ok).toBe(true);
    });
  });

  describe('BR-MOVE-003 — reachable destination', () => {
    it('accepts a move to a reachable square', () => {
      // Marshal at (5,9) step left to (4,9)
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9));
      expect(r.ok).toBe(true);
    });

    it('rejects a move to a square the piece cannot reach', () => {
      // Marshal at (5,9) — step only, cannot reach (5,6) which is 3 away
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 9, 5, 6));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-003');
    });
  });

  describe('outcome validation', () => {
    it('requires outcome=null when landing on empty square', () => {
      const state = gsfenState(MARSHAL_ALONE);
      expect(validateMove(state, move(5, 9, 4, 9, null)).ok).toBe(true);
      const r = validateMove(state, move(5, 9, 4, 9, 'stack'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-004');
    });

    it('rejects outcome=null when capture/stack choice exists', () => {
      // White GG (size 2) at (5,9), Black p (size 1) at (5,8) — choice exists
      const state = gsfenState(CHOICE_POS);
      const r = validateMove(state, move(5, 9, 5, 8));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-002');
    });

    it('accepts outcome=stack when choice exists', () => {
      const state = gsfenState(CHOICE_POS);
      const r = validateMove(state, move(5, 9, 5, 8, 'stack'));
      expect(r.ok).toBe(true);
    });

    it('accepts outcome=capture when choice exists', () => {
      const state = gsfenState(CHOICE_POS);
      const r = validateMove(state, move(5, 9, 5, 8, 'capture'));
      expect(r.ok).toBe(true);
    });

    it('rejects outcome=stack when capture is forced (target size=3)', () => {
      const state = gsfenState(FORCED_CAPTURE);
      const r = validateMove(state, move(5, 9, 5, 8, 'stack'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-CAPTURE-002');
    });

    it('accepts outcome=null when capture is forced (target size=3)', () => {
      const state = gsfenState(FORCED_CAPTURE);
      const r = validateMove(state, move(5, 9, 5, 8, null));
      expect(r.ok).toBe(true);
    });
  });

  describe('BR-MOVE-005 — stack size landing restriction', () => {
    it('rejects move when source size < target size', () => {
      // Marshal size 1 at (5,9), friendly AFG size 3 at (5,7) — blocked
      const state = gsfenState(SIZE_MISMATCH);
      const r = validateMove(state, move(5, 9, 5, 7));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-003');
    });

    it('accepts move to empty square (trivially passes)', () => {
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9));
      expect(r.ok).toBe(true);
    });
  });

  describe('BR-STACK-003 — stacking on friendly squares', () => {
    it('accepts move onto a friendly-topped stack with outcome=null (automatic stacking)', () => {
      // White Marshal at (5,9) moves to (5,8) where White Pawn is.
      // Target size 1 <= source size 1, friendly-topped → automatic stacking.
      const state = gsfenState(FRIENDLY_STACK);
      const r = validateMove(state, move(5, 9, 5, 8, null));
      expect(r.ok).toBe(true);
    });

    it('rejects outcome specification when stacking on a friendly stack', () => {
      // Same position as above, but specifying outcome='stack' is invalid
      // because outcome must be null for friendly-topped stacks (automatic stacking).
      const state = gsfenState(FRIENDLY_STACK);
      const r = validateMove(state, move(5, 9, 5, 8, 'stack'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-004');
    });
  });

  describe('BR-STACK-004 — no stacking on friendly Marshal', () => {
    it('rejects a move that would land on a friendly Marshal', () => {
      // White Pawn at (5,8), White Marshal at (5,9).
      // Move Pawn north to (5,9) would stack onto the friendly Marshal — illegal.
      const state = gsfenState('9/9/9/9/9/9/9/4,P,4/4,M,4 w - 2');
      const r = validateMove(state, move(5, 8, 5, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-004');
    });

    it('rejects a move that would land on an enemy Marshal', () => {
      // White size-2 stack at (5,9), Black Marshal at (5,8).
      // BR-STACK-004 prohibits ANY piece from being placed or moved on top of
      // a Marshal — friendly or enemy. The Marshal is never actually captured;
      // Checkmate ends the Game before Capture resolves.
      const state = gsfenState(
        '9/9/9/9/9/9/9/4,m,4/4,GG,4 w C2E2F2JL2N4P3STU2Yac3e2f2j2ln4p2stu2y 3',
      );
      const r = validateMove(state, move(5, 9, 5, 8, null));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-004');
    });
  });

  describe('BR-ACTION-002 — Self Check', () => {
    it('rejects a move that leaves own Marshal in check due to stack size change', () => {
      // White Marshal (top of [P,P,M] size 3) at (5,9) captures Black Pawn at (5,8).
      // After capture, Marshal becomes size 1 at (5,8).
      // Black General at (5,7) gains line of sight along the file and attacks (5,8).
      // This violates Self Check — the move is illegal.
      const state = gsfenState(SELF_CHECK_POS);
      const r = validateMove(state, move(5, 9, 5, 8, 'capture'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-ACTION-002');
    });

    it('accepts a move that does not leave own Marshal in check', () => {
      const r = validateMove(gsfenState(BLACK_TURN), move(5, 1, 4, 1));
      expect(r.ok).toBe(true);
    });
  });

  describe('BR-STACK-006 — Turncoat explicit rejection', () => {
    it('rejects a move with non-empty turncoat (not yet implemented)', () => {
      const r = validateMove(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9, null, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  validateArata                                                      */
/* ------------------------------------------------------------------ */

describe('validateArata', () => {
  it('rejects arata during deploy phase (BR-ARATA-001)', () => {
    // Deploy-phase state: any arata must be rejected.
    const state = gsfenState(
      '9/9/9/9/9/9/9/9/4,M,4 dw 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1',
    );
    const r = validateArata(state, arata('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-001');
  });

  it('rejects arata with piece not in hand (BR-ARATA-002)', () => {
    const r = validateArata(gsfenState(BATTLE_W), arata('G', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-002');
  });

  it('rejects arata of Marshal (BR-ARATA-002 fires first — not in hand)', () => {
    // Marshal is never in hand during battle phase (BR-DEPLOY-011).
    // The first check (BR-ARATA-002: piece in hand) rejects it.
    const r = validateArata(gsfenState(BATTLE_W), arata('M', 5, 7));
    expect(r.ok).toBe(false);
    // The first check to fire is "piece not in hand" — BR-ARATA-002 beats BR-ARATA-007.
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-002');
  });

  it('accepts arata with piece in hand to valid square', () => {
    // BATTLE_W: White most advanced piece is Archer at row 4.
    // Arata zone: rows 4-9. (5,7) is row 7 — in zone.
    const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 7));
    expect(r.ok).toBe(true);
  });

  it('rejects arata beyond most advanced piece (BR-ARATA-003)', () => {
    // Row 3 is forward of row 4 (most advanced White piece) — outside zone
    const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-003');
  });

  it('accepts arata at the most advanced piece row', () => {
    // Row 4 is the most advanced White piece row — should be in zone
    const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 4));
    expect(r.ok).toBe(true);
  });

  it('rejects arata onto a full stack (BR-ARATA-005)', () => {
    // AFG size 3 at (5,7) — cannot stack on top
    const state = gsfenState(
      '4,m,4/4,g,4/9/9/9/9/4,AFG,4/4,G,4/4,M,4 w AC2E2JL2N4P2STU2Yac2e2fjln4p2stu2y 5',
    );
    const r = validateArata(state, arata('P', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-005');
  });

  it('rejects arata onto enemy-topped square (BR-ARATA-006)', () => {
    // Use a position where (5,7) is within White's arata zone AND has an enemy top.
    // White's most advanced piece is at row 5 (General), zone = rows 5-9.
    // Row 7 has a Black Pawn [p] at (5,7) — within zone, enemy-topped.
    const state = gsfenState(
      '9/9/9/9/9/4,G,4/4,p,4/4,P,4/4,M,4 w AC2E2F2JLN4P2STU2Y2ac2efgjlnptuy 6',
    );
    const r = validateArata(state, arata('P', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-006');
  });

  it('rejects arata onto a Marshal (BR-ARATA-007)', () => {
    const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-007');
  });

  describe('BR-STACK-006 — Turncoat explicit rejection', () => {
    it('rejects an arata with non-empty turncoat (not yet implemented)', () => {
      const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 7, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });
  });

  describe('BR-ACTION-002 — Self Check after Arata', () => {
    it('accepts arata that does not leave own Marshal in check', () => {
      // Arata places a Pawn at (5,7) — adjacent to Marshal at (5,9) but doesn't block anything.
      // The Self Check code path is exercised but doesn't trigger (Marshal is safe).
      const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 7));
      expect(r.ok).toBe(true);
    });

    it('includes afterState with correct piece placement on success', () => {
      // Arata places a Pawn at (5,7) — verify the afterState reflects the placement.
      const r = validateArata(gsfenState(BATTLE_W), arata('P', 5, 7));
      if (r.ok) {
        expect(r.afterState).toBeDefined();
        const stack = getStack(r.afterState.position, { col: 5, row: 7 });
        expect(stack).not.toBeNull();
        expect(topPiece(stack!).type).toBe('P');
        expect(topPiece(stack!).owner).toBe('white');
        // Hand should have one fewer Pawn
        expect(r.afterState.hands.white.P).toBe(2); // was 3 in BATTLE_W
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  validatePlay                                                       */
/* ------------------------------------------------------------------ */

describe('validatePlay', () => {
  it('dispatches move actions to validateMove', () => {
    const r = validatePlay(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9));
    expect(r.ok).toBe(true);
  });

  it('dispatches arata actions to validateArata', () => {
    const r = validatePlay(gsfenState(BATTLE_W), arata('P', 5, 7));
    expect(r.ok).toBe(true);
  });

  it('rejects a placement action during battle phase', () => {
    const r = validatePlay(gsfenState(BATTLE_W), placement('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-001');
  });

  it('includes pre-computed afterState with correct board changes on success', () => {
    // Move Marshal from (5,9) left to (4,9) — empty square
    const r = validatePlay(gsfenState(MARSHAL_ALONE), move(5, 9, 4, 9));
    if (r.ok) {
      expect(r.afterState).toBeDefined();

      // Origin (5,9) should now be empty (Marshal moved away)
      const originStack = getStack(r.afterState.position, { col: 5, row: 9 });
      expect(originStack).toBeNull();

      // Dest (4,9) should have the Marshal (size 1)
      const destStack = getStack(r.afterState.position, { col: 4, row: 9 });
      expect(destStack).not.toBeNull();
      expect(stackSize(destStack!)).toBe(1);
      expect(topPiece(destStack!).type).toBe('M');
      expect(topPiece(destStack!).owner).toBe('white');

      // Active player should NOT be flipped (that's Step 10)
      expect(r.afterState.turn.activePlayer).toBe('white');
    }
  });

  it('returns error for unknown action kind', () => {
    const r = validatePlay(gsfenState(MARSHAL_ALONE), { kind: 'unknown' } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ACTION-001');
  });
});
