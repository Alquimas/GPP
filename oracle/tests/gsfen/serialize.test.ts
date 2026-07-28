/**
 * GSFEN serializer tests — Step 3 verification.
 *
 * Strategy (per ORACLE.md):
 * 1. Parametric round-trip: for every .gsfen fixture file, parse then
 *    serialize, asserting both text-identity (canonical inputs) and
 *    structural identity (parse∘serialize ≡ id).
 * 2. Edge cases: empty hands, single-piece hand, multi-count hand,
 *    full compaction, startpos keyword → canonical expansion.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGSFEN, type ParseResult } from '../../src/gsfen/parse.js';
import { serializeGSFEN } from '../../src/gsfen/serialize.js';
import { EMPTY_HAND, START_GSFEN } from '../../src/constants.js';
import type { GameState, Hand, Position, Stack } from '../../src/types.js';
import { BLACK_DONE_DECLARED, EXAMPLE4_MIXED_STACK, WHITE_DONE_MULTI_COUNT_HAND, WHITE_MARSHAL_AT_5_9 } from '../../src/gsfen/fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a .gsfen fixture file by name (without extension). */
function readFixture(name: string): string {
  return readFileSync(`fixtures/valid/${name}.gsfen`, 'utf-8').trim();
}

/** Assert a parse is successful and return the state. */
function assertOk(result: ParseResult): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.state;
}

/** All fixture names (excluding startpos, which uses the keyword). */
const FIXTURE_NAMES = [
  'battle-start',
  'battle-midgame',
  'deploy-stacks-in-zones',
  'deploy-near-end',
  'black-done-declared',
  'white-done-declared',
  'both-marshals-placed',
  'white-marshal-at-5-9',
  'capture-aftermath',
  'dense-engagement',
  'some-captured',
  'three-deep-stacks',
  'all-on-board',
  'sparse-board',
  'triple-stack-battlefield',
  'deep-capture-exchange',
  'one-side-fully-deployed',
  'empty-hands-endgame',
  'white-done-multi-count-hand',
];

// ---------------------------------------------------------------------------
// Parametric round-trip tests
// ---------------------------------------------------------------------------

describe('GSFEN round-trip — all fixture files', () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: parse(serialize(state)) structural round-trip`, () => {
      const raw = readFixture(name);
      const state = assertOk(parseGSFEN(raw));
      const serialized = serializeGSFEN(state);
      const reparsed = assertOk(parseGSFEN(serialized));
      expect(reparsed).toEqual(state);
    });
  }

  for (const name of FIXTURE_NAMES) {
    it(`${name}: serialize(parse(x)) text identity (canonical input)`, () => {
      const raw = readFixture(name);
      const state = assertOk(parseGSFEN(raw));
      const serialized = serializeGSFEN(state);
      // The input fixture IS canonical, so the round-trip should produce
      // the exact same string.
      expect(serialized).toBe(raw);
    });
  }
});

describe('GSFEN round-trip — startpos keyword', () => {
  it('serialize(parse("startpos")) produces START_GSFEN (not the keyword)', () => {
    const state = assertOk(parseGSFEN('startpos'));
    const serialized = serializeGSFEN(state);
    expect(serialized).toBe(START_GSFEN);
    // Confirm parse(serialize) matches
    const reparsed = assertOk(parseGSFEN(serialized));
    expect(reparsed).toEqual(state);
  });

  it('startpos.gsfen fixture: round-trip expands keyword to canonical string', () => {
    const raw = readFixture('startpos');
    expect(raw).toBe('startpos');
    const state = assertOk(parseGSFEN(raw));
    const serialized = serializeGSFEN(state);
    expect(serialized).toBe(START_GSFEN);
    // structural identity
    const reparsed = assertOk(parseGSFEN(serialized));
    expect(reparsed).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// Round-trip on the worked examples from GSFEN.md
// ---------------------------------------------------------------------------

describe('GSFEN round-trip — GSFEN.md worked examples', () => {
  it('Example 2: White Marshal at 5-9, Black to place', () => {
    const gsfen = WHITE_MARSHAL_AT_5_9;
    const state = assertOk(parseGSFEN(gsfen));
    expect(serializeGSFEN(state)).toBe(gsfen);
    const reparsed = assertOk(parseGSFEN(serializeGSFEN(state)));
    expect(reparsed).toEqual(state);
  });

  it('Example 3: Black done, White to place', () => {
    const gsfen = BLACK_DONE_DECLARED;
    const state = assertOk(parseGSFEN(gsfen));
    expect(serializeGSFEN(state)).toBe(gsfen);
    const reparsed = assertOk(parseGSFEN(serializeGSFEN(state)));
    expect(reparsed).toEqual(state);
  });

  it('Example 4: Mixed stack at 5-5', () => {
    const gsfen = EXAMPLE4_MIXED_STACK;
    const state = assertOk(parseGSFEN(gsfen));
    expect(serializeGSFEN(state)).toBe(gsfen);
    const reparsed = assertOk(parseGSFEN(serializeGSFEN(state)));
    expect(reparsed).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// Edge-case tests
// ---------------------------------------------------------------------------

describe('serializeGSFEN — edge cases', () => {
  it('empty hands marker: both hands empty → "-"', () => {
    const state: GameState = {
      position: Array.from({ length: 9 }, () => new Array<Stack | null>(9).fill(null)),
      turn: { phase: 'battle', activePlayer: 'white', done: null, counter: 1 },
      hands: { white: { ...EMPTY_HAND }, black: { ...EMPTY_HAND } },
    };
    // Manually put both Marshals on board for a valid state
    state.position[0][4] = [{ type: 'M', owner: 'black' }] as Stack;
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;

    const serialized = serializeGSFEN(state);
    // The hands field should be "-"
    const parts = serialized.split(' ');
    expect(parts[2]).toBe('-');
  });

  it('single-piece hand: count 1 omitted', () => {
    // White holds exactly one Marshal, black holds nothing
    const whiteHand: Hand = { ...EMPTY_HAND, M: 1 };
    const state: GameState = {
      position: Array.from({ length: 9 }, () => new Array<Stack | null>(9).fill(null)),
      turn: { phase: 'deploy', activePlayer: 'white', done: null, counter: 1 },
      hands: { white: whiteHand, black: { ...EMPTY_HAND } },
    };
    // No pieces on board yet (startpos-like, Marshal still in hand)
    const serialized = serializeGSFEN(state);
    // White's hand: "M", black's: "" (but combined they should be "M")
    // White hand "M" + black hand "" = "M"
    const parts = serialized.split(' ');
    expect(parts[2]).toBe('M');
  });

  it('multi-count hand renders with number prefixes for counts >= 2', () => {
    // White: 2 Archers, 1 Cannon, 3 Spears
    const whiteHand: Hand = { ...EMPTY_HAND, A: 2, C: 1, E: 3 };
    const state: GameState = {
      position: Array.from({ length: 9 }, () => new Array<Stack | null>(9).fill(null)),
      turn: { phase: 'deploy', activePlayer: 'white', done: null, counter: 1 },
      hands: { white: whiteHand, black: { ...EMPTY_HAND } },
    };
    const serialized = serializeGSFEN(state);
    const parts = serialized.split(' ');
    // A=2 → "2A", C=1 → "C", E=3 → "3E" = "2AC3E"
    expect(parts[2]).toBe('2AC3E');
  });

  it('full compaction: row with pieces only at columns 1 and 9', () => {
    // Row 1: empty at cols 2-8, piece at col 9 and col 1
    // GSFEN: "M,7,P" — piece at col 9, 7 empty, piece at col 1
    const row: (Stack | null)[] = new Array<Stack | null>(9).fill(null);
    row[8] = [{ type: 'M', owner: 'white' }]; // Col 9
    row[0] = [{ type: 'P', owner: 'white' }]; // Col 1
    // row[1] through row[7] remain null — 7 consecutive empties

    const position: Position = Array.from({ length: 9 }, () =>
      new Array<Stack | null>(9).fill(null),
    );
    position[0] = row;

    const state: GameState = {
      position,
      turn: { phase: 'deploy', activePlayer: 'white', done: null, counter: 1 },
      hands: { white: { ...EMPTY_HAND }, black: { ...EMPTY_HAND } },
    };

    const serialized = serializeGSFEN(state);
    const posField = serialized.split(' ')[0];
    const rows = posField.split('/');
    // Row 1: M at col 9 (idx 8), 7 empties (idx 7→1), P at col 1 (idx 0)
    // GSFEN items left to right: "M" (col 9), "7" (7 empty), "P" (col 1)
    expect(rows[0]).toBe('M,7,P');
  });

  it('counter serializes without leading zeros', () => {
    const state = assertOk(parseGSFEN(START_GSFEN));
    const serialized = serializeGSFEN(state);
    const parts = serialized.split(' ');
    expect(parts[3]).toBe('1');
    expect(parts[3]).not.toMatch(/^0/);
  });

  it('deploy turn with done flag serializes correctly (dwB / dbW)', () => {
    // Black done, white to place → dwB
    const gsfen = BLACK_DONE_DECLARED;
    const state = assertOk(parseGSFEN(gsfen));
    expect(serializeGSFEN(state)).toBe(gsfen);

    // White done, black to place → dbW
    const gsfen2 = WHITE_DONE_MULTI_COUNT_HAND;
    const state2 = assertOk(parseGSFEN(gsfen2));
    expect(serializeGSFEN(state2)).toBe(gsfen2);
  });
});

// ---------------------------------------------------------------------------
// Negative assertions: serializer only produces canonical output
// ---------------------------------------------------------------------------

describe('serializeGSFEN — canonical output guarantees', () => {
  it('never produces adjacent empty-run digits (C3 guarantee)', () => {
    const state = assertOk(parseGSFEN(START_GSFEN));
    // Add some pieces to create a non-trivial row
    state.position[8][4] = [{ type: 'M', owner: 'white' }] as Stack;
    state.position[8][3] = [{ type: 'G', owner: 'white' }] as Stack;
    state.hands.white.M = 0;

    const serialized = serializeGSFEN(state);
    const posField = serialized.split(' ')[0];
    const rows = posField.split('/');

    for (let r = 0; r < rows.length; r++) {
      // Check that there are no adjacent digits within comma-separated items
      const items = rows[r].split(',');
      let lastWasDigit = false;
      for (const item of items) {
        if (/^[1-9]$/.test(item)) {
          expect(lastWasDigit).toBe(false);
          lastWasDigit = true;
        } else {
          lastWasDigit = false;
        }
      }
    }
  });

  it('counter has no leading zeros (C6 guarantee)', () => {
    const state = assertOk(parseGSFEN(START_GSFEN));
    // Change counter to a value that could have leading zeros
    state.turn.counter = 42;
    const serialized = serializeGSFEN(state);
    const parts = serialized.split(' ');
    expect(parts[3]).toBe('42');
    expect(parts[3]).not.toMatch(/^0[0-9]/);
  });

  it('mixed-ownership stacks preserve case (ownership encoding)', () => {
    // Battle-midgame has a PyT mixed stack — verify it serializes correctly
    const raw = readFixture('battle-midgame');
    const state = assertOk(parseGSFEN(raw));
    const serialized = serializeGSFEN(state);
    expect(serialized).toBe(raw);
  });
});
