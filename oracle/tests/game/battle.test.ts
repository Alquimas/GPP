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
import type {
  Action,
  GameState,
  PieceType,
  Player,
  Square,
  TurncoatLevels,
} from '../../src/types.js';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { validateMove, validateArata, validatePlay } from '../../src/game/battle.js';
import { getStack, setStack, createStack, stackSize, topPiece } from '../../src/board/board.js';
import {
  ARATA_ZONE_TEST,
  BATTLE_MID_VARIANT,
  BLACK_TURN_MARSHAL_ONLY,
  CHOICE_POS,
  DEPLOY_PHASE_CTR1,
  ENEMY_MARSHAL_STACK_TEST,
  FORCED_CAPTURE,
  FRIENDLY_STACK_TEST,
  FRIENDLY_STACK_WITH_HANDS,
  MARSHAL_ALONE_BATTLE,
  SELF_CHECK_POS,
  SELF_CHECK_SIZE3_CAPTURE,
  SIZE_MISMATCH_AFG,
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
/*  validateMove                                                       */
/* ------------------------------------------------------------------ */

describe('validateMove', () => {
  describe('BR-PLAY-002 — phase check', () => {
    it('rejects a move during deploy phase', () => {
      // Deploy-phase state (STARTPOS-like): any move must be rejected.
      const state = gsfenState(DEPLOY_PHASE_CTR1);
      const r = validateMove(state, move(5, 9, 4, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-PLAY-002');
    });
  });

  describe('BR-MOVE-002 — origin must contain own piece', () => {
    it('rejects move from an empty square', () => {
      const r = validateMove(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 6, 5, 5));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-002');
    });

    it('rejects move from a square whose top piece belongs to opponent', () => {
      const r = validateMove(gsfenState(BATTLE_MID_VARIANT), move(5, 1, 5, 2));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-002');
    });

    it('accepts move from a square whose top piece belongs to active player', () => {
      // White Marshal at (5,9) — move left to (4,9) which is empty
      const r = validateMove(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
      expect(r.ok).toBe(true);
    });
  });

  describe('BR-MOVE-003 — reachable destination', () => {
    it('accepts a move to a reachable square', () => {
      // Marshal at (5,9) step left to (4,9)
      const r = validateMove(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
      expect(r.ok).toBe(true);
    });

    it('rejects a move to a square the piece cannot reach', () => {
      // Marshal at (5,9) — step only, cannot reach (5,6) which is 3 away
      const r = validateMove(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 5, 6));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-003');
    });
  });

  describe('outcome validation', () => {
    it('requires outcome=null when landing on empty square', () => {
      const state = gsfenState(MARSHAL_ALONE_BATTLE);
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
      // BR-MOVE-005 (source stack size >= target stack size) is now checked
      // explicitly in validateMove before the reachability query.
      const state = gsfenState(SIZE_MISMATCH_AFG);
      const r = validateMove(state, move(5, 9, 5, 7));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-005');
    });
  });

  describe('BR-CAPTURE-003 — source size < target enemy stack size', () => {
    it('rejects move when source size < target enemy stack size', () => {
      // Marshal size 1 at (5,9), change the size-3 stack at (5,7) to enemy-owned.
      // BR-MOVE-005 (source >= target) is now checked explicitly in validateMove,
      // so the rejection carries the correct rule code.
      const base = gsfenState(SIZE_MISMATCH_AFG);
      const stack = getStack(base.position, { col: 5, row: 7 })!;
      const blackStack = createStack(
        stack.map((p) => ({ type: p.type, owner: 'black' as Player })),
      );
      const state: GameState = {
        ...base,
        position: setStack(base.position, { col: 5, row: 7 }, blackStack),
      };
      const r = validateMove(state, move(5, 9, 5, 7));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-005');
    });
  });

  describe('BR-STACK-003 — stacking on friendly squares', () => {
    it('accepts move onto a friendly-topped stack with outcome=null (automatic stacking)', () => {
      // White Marshal at (5,9) moves to (5,8) where White Pawn is.
      // Target size 1 <= source size 1, friendly-topped → automatic stacking.
      const state = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      const r = validateMove(state, move(5, 9, 5, 8, null));
      expect(r.ok).toBe(true);
    });

    it('rejects outcome specification when stacking on a friendly stack', () => {
      // Same position as above, but specifying outcome='stack' is invalid
      // because outcome must be null for friendly-topped stacks (automatic stacking).
      const state = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      const r = validateMove(state, move(5, 9, 5, 8, 'stack'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-MOVE-004');
    });
  });

  describe('BR-STACK-004 — no stacking on friendly Marshal', () => {
    it('rejects a move that would land on a friendly Marshal', () => {
      // White Pawn at (5,8), White Marshal at (5,9).
      // Move Pawn north to (5,9) would stack onto the friendly Marshal — illegal.
      const state = gsfenState(FRIENDLY_STACK_TEST);
      const r = validateMove(state, move(5, 8, 5, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-004');
    });

    it('rejects a move that would land on an enemy Marshal', () => {
      // White size-2 stack at (5,9), Black Marshal at (5,8).
      // BR-STACK-004 prohibits ANY piece from being placed or moved on top of
      // a Marshal — friendly or enemy. The Marshal is never actually captured;
      // Checkmate ends the Game before Capture resolves.
      const state = gsfenState(ENEMY_MARSHAL_STACK_TEST);
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
      const r = validateMove(gsfenState(BLACK_TURN_MARSHAL_ONLY), move(5, 1, 4, 1));
      expect(r.ok).toBe(true);
    });

    it('rejects a move where capturing a size-3 stack leaves own Marshal at size 1 and thus vulnerable (BR-ACTION-002)', () => {
      // Black Marshal (top of [A,A,m] size 3) at (6,4) captures White [F,P,P] at (5,4) size 3.
      // After capture, Marshal becomes size 1 at (5,4).
      // White General at (5,9) can now attack (5,4) along the empty file.
      // Self Check must be evaluated on post-move state with changed stack sizes.
      // GSFEN: 8,M/9/9/3,AAm,FPP,4/9/9/9/9/4,G,4 b - 2
      const state = gsfenState(SELF_CHECK_SIZE3_CAPTURE);
      const r = validateMove(state, move(6, 4, 5, 4, null));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-ACTION-002');
    });
  });

  describe('BR-STACK-006 — Turncoat validation (Move)', () => {
    it('rejects turncoat from a non-Captain piece', () => {
      // Marshal at (5,9) moves to (4,9) with turncoat — not a Captain
      const r = validateMove(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9, null, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('rejects turncoat on a Capture outcome', () => {
      // Captain at (6,7) moves FR to (5,6) where enemy piece sits.
      // Capture chosen, turncoat=[1] — illegal because Turncoat needs Stack.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(pos, { col: 6, row: 7 }, createStack([{ type: 'T', owner: 'white' }]));
      pos = setStack(pos, { col: 5, row: 6 }, createStack([{ type: 'P', owner: 'black' }]));
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0 } },
      };
      const r = validateMove(state, move(6, 7, 5, 6, 'capture', [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('rejects turncoat when target stack level contains a friendly piece (not enemy)', () => {
      // Captain at (6,7) on size-2 stack moves FR to (5,6) with a single enemy piece.
      // Post-move stack: [p, T] size 2. Level 2 is the Captain (friendly) — cannot swap.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(
        pos,
        { col: 6, row: 7 },
        createStack([
          { type: 'P', owner: 'white' },
          { type: 'T', owner: 'white' },
        ]),
      );
      pos = setStack(pos, { col: 5, row: 6 }, createStack([{ type: 'P', owner: 'black' }]));
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0, P: 4 } },
      };
      // Outcome='stack' (choice exists). Turncoat level 2 is the Captain (friendly).
      const r = validateMove(state, move(6, 7, 5, 6, 'stack', [2]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('rejects turncoat when hand lacks matching piece type', () => {
      // Captain at (6,7) can reach Black Pawn at (5,6). Hand has no Pawns for swap.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(pos, { col: 6, row: 7 }, createStack([{ type: 'T', owner: 'white' }]));
      pos = setStack(pos, { col: 5, row: 6 }, createStack([{ type: 'P', owner: 'black' }]));
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0, P: 0 } },
      };
      const r = validateMove(state, move(6, 7, 5, 6, 'stack', [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('accepts a Captain stacking move with Turncoat level 1 and updates state correctly', () => {
      // Captain at (6,7) moves FR to (5,6), stacks on Black Pawn, swaps level 1.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(pos, { col: 6, row: 7 }, createStack([{ type: 'T', owner: 'white' }]));
      pos = setStack(pos, { col: 5, row: 6 }, createStack([{ type: 'P', owner: 'black' }]));
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0, P: 4 } },
      };

      const r = validateMove(state, move(6, 7, 5, 6, 'stack', [1]));
      expect(r.ok).toBe(true);
      if (r.ok) {
        // After move + swap: stack at (5,6) is [P, T] (swapped Pawn, Captain)
        const stack = getStack(r.speculativeState.position, { col: 5, row: 6 });
        expect(stack).not.toBeNull();
        expect(stack!.length).toBe(2);
        expect(stack![0]).toEqual({ type: 'P', owner: 'white' });
        expect(stack![1]).toEqual({ type: 'T', owner: 'white' });
        // Origin (6,7) should be empty
        expect(getStack(r.speculativeState.position, { col: 6, row: 7 })).toBeNull();
        // Hand: one Pawn consumed by swap
        expect(r.speculativeState.hands.white.P).toBe(3);
        // Turn flipped (BR-TURN-002)
        expect(r.speculativeState.turn.activePlayer).toBe('black');
        // Counter incremented
        expect(r.speculativeState.turn.counter).toBe(3); // was 2 in FRIENDLY_STACK_WITH_HANDS
      }
    });

    it('accepts Captain stacking with Turncoat level 2', () => {
      // Captain on size-2 stack at (6,7) moves FR to (5,6). Target stack has two enemy pieces.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      // Captain on top of a friendly Pawn → stack size 2
      pos = setStack(
        pos,
        { col: 6, row: 7 },
        createStack([
          { type: 'P', owner: 'white' },
          { type: 'T', owner: 'white' },
        ]),
      );
      // Target: two Black Pawns → stack size 2 (source 2 >= target 2)
      pos = setStack(
        pos,
        { col: 5, row: 6 },
        createStack([
          { type: 'P', owner: 'black' },
          { type: 'P', owner: 'black' },
        ]),
      );
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0, P: 5 } },
      };

      const r = validateMove(state, move(6, 7, 5, 6, 'stack', [2]));
      expect(r.ok).toBe(true);
      if (r.ok) {
        const stack = getStack(r.speculativeState.position, { col: 5, row: 6 });
        expect(stack).not.toBeNull();
        expect(stack!.length).toBe(3);
        // Level 1 unchanged (not elected)
        expect(stack![0]).toEqual({ type: 'P', owner: 'black' });
        // Level 2 swapped (was Black Pawn)
        expect(stack![1]).toEqual({ type: 'P', owner: 'white' });
        // Level 3 is Captain
        expect(stack![2]).toEqual({ type: 'T', owner: 'white' });
        // One Pawn consumed (level 2 swap)
        expect(r.speculativeState.hands.white.P).toBe(4);
      }
    });

    it('accepts Captain stacking with Turncoat levels 1 and 2 — both levels swapped', () => {
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      // Captain on size-2 stack (on top of Pawn)
      pos = setStack(
        pos,
        { col: 6, row: 7 },
        createStack([
          { type: 'P', owner: 'white' },
          { type: 'T', owner: 'white' },
        ]),
      );
      // Target: two enemy pieces of different types → stack size 2
      pos = setStack(
        pos,
        { col: 5, row: 6 },
        createStack([
          { type: 'S', owner: 'black' },
          { type: 'P', owner: 'black' },
        ]),
      );
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 0, P: 5, S: 2 } },
      };

      const r = validateMove(state, move(6, 7, 5, 6, 'stack', [1, 2]));
      expect(r.ok).toBe(true);
      if (r.ok) {
        const stack = getStack(r.speculativeState.position, { col: 5, row: 6 });
        expect(stack!.length).toBe(3);
        // Level 1: Samurai swapped
        expect(stack![0]).toEqual({ type: 'S', owner: 'white' });
        // Level 2: Pawn swapped
        expect(stack![1]).toEqual({ type: 'P', owner: 'white' });
        // Level 3: Captain
        expect(stack![2]).toEqual({ type: 'T', owner: 'white' });
        // Both swap pieces consumed from hand
        expect(r.speculativeState.hands.white.S).toBe(1);
        expect(r.speculativeState.hands.white.P).toBe(4);
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  validateArata                                                      */
/* ------------------------------------------------------------------ */

describe('validateArata', () => {
  it('rejects arata during deploy phase (BR-ARATA-001)', () => {
    // Deploy-phase state: any arata must be rejected.
    const state = gsfenState(DEPLOY_PHASE_CTR1);
    const r = validateArata(state, arata('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-001');
  });

  it('rejects arata with piece not in hand (BR-ARATA-002)', () => {
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('G', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-002');
  });

  it('rejects arata of Marshal — not in hand during battle phase (BR-ARATA-002)', () => {
    // Marshal is never in hand during battle phase (BR-DEPLOY-011).
    // The piece-in-hand check (BR-ARATA-002) rejects it regardless of target.
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('M', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-002');
  });

  it('accepts arata with piece in hand to valid square', () => {
    // BATTLE_MID_VARIANT: White most advanced piece is Archer at row 4.
    // Arata zone: rows 4-9. (5,7) is row 7 — in zone.
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7));
    expect(r.ok).toBe(true);
  });

  it('rejects arata beyond most advanced piece (BR-ARATA-003)', () => {
    // Row 3 is forward of row 4 (most advanced White piece) — outside zone
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-003');
  });

  it('accepts arata at the most advanced piece row', () => {
    // Row 4 is the most advanced White piece row — should be in zone
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 4));
    expect(r.ok).toBe(true);
  });

  it('rejects arata onto a full stack (BR-ARATA-005)', () => {
    // AFG size 3 at (5,7) — cannot stack on top
    const state = gsfenState(SIZE_MISMATCH_AFG);
    const r = validateArata(state, arata('P', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-005');
  });

  describe('Black-side Arata zone (BR-ARATA-003 symmetry)', () => {
    it('accepts Black arata inside zone and rejects outside zone', () => {
      // Start from BLACK_TURN_MARSHAL_ONLY: Black Marshal at (5,1), White Marshal at (5,9).
      // Add a Black Soldier at (5,3) so the zone expands beyond row 1.
      const base = gsfenState(BLACK_TURN_MARSHAL_ONLY);
      const pos = setStack(
        base.position,
        { col: 5, row: 3 },
        createStack([{ type: 'S', owner: 'black' }]),
      );
      const state: GameState = {
        ...base,
        position: pos,
        hands: {
          white: { ...base.hands.white },
          black: { ...base.hands.black, P: 2 },
        },
      };
      // Zone: rows 1-3 (most advanced Black piece at row 3).
      // Inside zone: row 2.
      const r1 = validateArata(state, arata('P', 5, 2));
      expect(r1.ok).toBe(true);
      // Outside zone: row 4 > 3.
      const r2 = validateArata(state, arata('P', 5, 4));
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.error.rule).toBe('BR-ARATA-003');
    });
  });

  it('rejects arata onto enemy-topped square (BR-ARATA-006)', () => {
    // Use a position where (5,7) is within White's arata zone AND has an enemy top.
    // White's most advanced piece is at row 5 (General), zone = rows 5-9.
    // Row 7 has a Black Pawn [p] at (5,7) — within zone, enemy-topped.
    const state = gsfenState(ARATA_ZONE_TEST);
    const r = validateArata(state, arata('P', 5, 7));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-006');
  });

  it('rejects arata onto a Marshal (BR-ARATA-007)', () => {
    const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 9));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ARATA-007');
  });

  describe('BR-STACK-006 — Turncoat validation (Arata)', () => {
    it('rejects arata turncoat from a non-Captain piece', () => {
      // Arata Pawn with turncoat — Pawn is not Captain
      const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('rejects arata turncoat when target has no enemy pieces to swap', () => {
      // Arata Captain at (5,7) — target is empty, no enemy pieces.
      // Need to add T to hand since BATTLE_MID_VARIANT has no Captain.
      const base = gsfenState(BATTLE_MID_VARIANT);
      const state: GameState = {
        ...base,
        hands: { ...base.hands, white: { ...base.hands.white, T: 1 } },
      };
      const r = validateArata(state, arata('T', 5, 7, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('rejects arata turncoat when hand lacks matching piece type', () => {
      // Place friendly-topped stack [p, P] at (5,8) with enemy below.
      // Hand has no Pawn for swap.
      const base = gsfenState(BATTLE_MID_VARIANT);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(
        pos,
        { col: 5, row: 8 },
        createStack([
          { type: 'P', owner: 'black' },
          { type: 'P', owner: 'white' },
        ]),
      );
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 1, P: 0 } },
      };
      const r = validateArata(state, arata('T', 5, 8, [1]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-STACK-006');
    });

    it('accepts Captain arata with Turncoat level 1 and updates state correctly', () => {
      // Target (5,8) has [p, P] (Black Pawn bottom, White Pawn top).
      // Arata Captain on top → stack becomes [p, P, T]. Swap level 1: Pawn→White Pawn.
      const base = gsfenState(BATTLE_MID_VARIANT);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(
        pos,
        { col: 5, row: 8 },
        createStack([
          { type: 'P', owner: 'black' },
          { type: 'P', owner: 'white' },
        ]),
      );
      const state: GameState = {
        ...base,
        position: pos,
        hands: { ...base.hands, white: { ...base.hands.white, T: 1, P: 4 } },
      };

      const r = validateArata(state, arata('T', 5, 8, [1]));
      expect(r.ok).toBe(true);
      if (r.ok) {
        const stack = getStack(r.speculativeState.position, { col: 5, row: 8 });
        expect(stack).not.toBeNull();
        expect(stack!.length).toBe(3);
        expect(stack![0]).toEqual({ type: 'P', owner: 'white' }); // swapped
        expect(stack![1]).toEqual({ type: 'P', owner: 'white' }); // friendly remains
        expect(stack![2]).toEqual({ type: 'T', owner: 'white' }); // Captain on top
        // Hand: T decremented for arata, P decremented for swap
        expect(r.speculativeState.hands.white.T).toBe(0);
        expect(r.speculativeState.hands.white.P).toBe(3);
      }
    });

    // Note: Arata Turncoat level 2 is not testable because a friendly-topped stack
    // with an enemy at level 2 would require size ≥ 3 pre-arata, which violates
    // BR-ARATA-005 (stack size limit). Level 1 is the only arata-swappable level.
  });

  describe('BR-ACTION-002 — Self Check after Arata', () => {
    it('accepts arata that does not leave own Marshal in check', () => {
      // Arata places a Pawn at (5,7) — adjacent to Marshal at (5,9) but doesn't block anything.
      // The Self Check code path is exercised but doesn't trigger (Marshal is safe).
      const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7));
      expect(r.ok).toBe(true);
    });

    it('rejects arata that does not resolve own Marshal check (BR-ACTION-002)', () => {
      // Start from FRIENDLY_STACK_WITH_HANDS: White Marshal at (5,9), White Pawn at (5,8).
      // Replace Pawn with Black General so the Marshal is in check.
      const base = gsfenState(FRIENDLY_STACK_WITH_HANDS);
      let pos = setStack(base.position, { col: 5, row: 8 }, null);
      pos = setStack(pos, { col: 5, row: 8 }, createStack([{ type: 'G', owner: 'black' }]));
      const state: GameState = { ...base, position: pos };
      // Arata zone: rows 9-9 (Marshal is the only White piece). Arata at (7,9).
      const r = validateArata(state, arata('P', 7, 9));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.rule).toBe('BR-ACTION-002');
    });

    it('includes speculativeState with correct piece placement on success', () => {
      // Arata places a Pawn at (5,7) — verify the speculativeState reflects the placement.
      const r = validateArata(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7));
      if (r.ok) {
        expect(r.speculativeState).toBeDefined();
        const stack = getStack(r.speculativeState.position, { col: 5, row: 7 });
        expect(stack).not.toBeNull();
        expect(topPiece(stack!).type).toBe('P');
        expect(topPiece(stack!).owner).toBe('white');
        // Hand should have one fewer Pawn
        expect(r.speculativeState.hands.white.P).toBe(2); // was 3 in BATTLE_MID_VARIANT
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  validatePlay                                                       */
/* ------------------------------------------------------------------ */

describe('validatePlay', () => {
  it('dispatches move actions to validateMove', () => {
    const r = validatePlay(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
    expect(r.ok).toBe(true);
  });

  it('dispatches arata actions to validateArata', () => {
    const r = validatePlay(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7));
    expect(r.ok).toBe(true);
  });

  it('rejects a placement action during battle phase', () => {
    const r = validatePlay(gsfenState(BATTLE_MID_VARIANT), placement('P', 5, 8));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-DEPLOY-001');
  });

  it('includes pre-computed speculativeState with correct board changes on success', () => {
    // Move Marshal from (5,9) left to (4,9) — empty square
    const r = validatePlay(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
    if (r.ok) {
      expect(r.speculativeState).toBeDefined();

      // Origin (5,9) should now be empty (Marshal moved away)
      const originStack = getStack(r.speculativeState.position, { col: 5, row: 9 });
      expect(originStack).toBeNull();

      // Dest (4,9) should have the Marshal (size 1)
      const destStack = getStack(r.speculativeState.position, { col: 4, row: 9 });
      expect(destStack).not.toBeNull();
      expect(stackSize(destStack!)).toBe(1);
      expect(topPiece(destStack!).type).toBe('M');
      expect(topPiece(destStack!).owner).toBe('white');
    }
  });

  it('returns error for unknown action kind', () => {
    const r = validatePlay(gsfenState(MARSHAL_ALONE_BATTLE), { kind: 'unknown' } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.rule).toBe('BR-ACTION-001');
  });

  describe('BR-TURN-002 — active player flips after Play; counter increments', () => {
    it('flips active player and increments counter after a valid Move', () => {
      const r = validatePlay(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
      if (r.ok) {
        expect(r.speculativeState.turn.activePlayer).toBe('black');
        expect(r.speculativeState.turn.counter).toBe(3); // was 2
      }
    });

    it('flips active player and increments counter after a valid Arata', () => {
      const r = validatePlay(gsfenState(BATTLE_MID_VARIANT), arata('P', 5, 7));
      if (r.ok) {
        expect(r.speculativeState.turn.activePlayer).toBe('black');
        expect(r.speculativeState.turn.counter).toBe(15); // was 14
      }
    });

    it('speculativeState for a Move cannot be reused to re-validate (pre-validated)', () => {
      // The speculativeState is a full committed state: the move has been applied,
      // the player flipped, and the counter incremented. It is meant to be consumed
      // directly by Game.applyAction (Step 12), not fed back into validatePlay.
      const r = validatePlay(gsfenState(MARSHAL_ALONE_BATTLE), move(5, 9, 4, 9));
      if (r.ok) {
        expect(r.speculativeState.turn.phase).toBe('battle');
        expect(r.speculativeState.turn.done).toBeNull();
      }
    });
  });
});
