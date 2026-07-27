import { describe, it, expect } from 'vitest';
import { parseGAN, parseSquare, parseTurncoat, type ParseResult } from '../../src/gan/parse.js';
import type { Action } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a parse is successful and return the action. */
function assertOk(result: ParseResult): Action {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.action;
}

/** Assert a parse fails with the given rule. */
function assertError(result: ParseResult, expectedRule: string, _msgPattern?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.rule).toBe(expectedRule);
}

// ---------------------------------------------------------------------------
// parseSquare
// ---------------------------------------------------------------------------

describe('parseSquare', () => {
  it('parses valid squares: 5-9', () => {
    expect(parseSquare('5-9')).toEqual({ col: 5, row: 9 });
  });

  it('parses valid squares: 1-1', () => {
    expect(parseSquare('1-1')).toEqual({ col: 1, row: 1 });
  });

  it('parses valid squares: 9-9', () => {
    expect(parseSquare('9-9')).toEqual({ col: 9, row: 9 });
  });

  it('parses valid squares: 3-7', () => {
    expect(parseSquare('3-7')).toEqual({ col: 3, row: 7 });
  });

  it('rejects col=0: 0-1', () => {
    expect(() => parseSquare('0-1')).toThrow();
  });

  it('rejects row=0: 1-0', () => {
    expect(() => parseSquare('1-0')).toThrow();
  });

  it('rejects col=10: 10-1', () => {
    expect(() => parseSquare('10-1')).toThrow();
  });

  it('rejects malformed: 5-', () => {
    expect(() => parseSquare('5-')).toThrow();
  });

  it('rejects malformed: -9', () => {
    expect(() => parseSquare('-9')).toThrow();
  });

  it('rejects malformed: 5', () => {
    expect(() => parseSquare('5')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseTurncoat
// ---------------------------------------------------------------------------

describe('parseTurncoat', () => {
  it('parses +1 as [1]', () => {
    expect(parseTurncoat('+1')).toEqual([1]);
  });

  it('parses +2 as [2]', () => {
    expect(parseTurncoat('+2')).toEqual([2]);
  });

  it('parses +12 as [1, 2]', () => {
    expect(parseTurncoat('+12')).toEqual([1, 2]);
  });

  it('rejects +21 (not ascending)', () => {
    expect(() => parseTurncoat('+21')).toThrow();
  });

  it('rejects +3 (invalid level)', () => {
    expect(() => parseTurncoat('+3')).toThrow();
  });

  it('rejects empty +', () => {
    expect(() => parseTurncoat('+')).toThrow();
  });

  it('rejects missing + prefix', () => {
    expect(() => parseTurncoat('1')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Worked examples from GAN.md
// ---------------------------------------------------------------------------

describe('parseGAN — worked examples from GAN.md', () => {
  // Example 1: Opening Placement
  // M5-9 → Placement: Marshal at 5-9, done=false
  it('Example 1: M5-9', () => {
    const action = assertOk(parseGAN('M5-9'));
    expect(action.kind).toBe('placement');
    if (action.kind !== 'placement') return;
    expect(action.piece).toBe('M');
    expect(action.dest).toEqual({ col: 5, row: 9 });
    expect(action.done).toBe(false);
  });

  // Example 2: Placement with Done
  // G5-1! → Placement: General at 5-1, done=true
  it('Example 2: G5-1!', () => {
    const action = assertOk(parseGAN('G5-1!'));
    expect(action.kind).toBe('placement');
    if (action.kind !== 'placement') return;
    expect(action.piece).toBe('G');
    expect(action.dest).toEqual({ col: 5, row: 1 });
    expect(action.done).toBe(true);
  });

  // Example 3: Plain Move, no choice available
  // 2-7>2-6 → Move: 2-7 to 2-6, outcome=null, turncoat=[]
  it('Example 3: 2-7>2-6', () => {
    const action = assertOk(parseGAN('2-7>2-6'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 2, row: 7 });
    expect(action.dest).toEqual({ col: 2, row: 6 });
    expect(action.outcome).toBeNull();
    expect(action.turncoat).toEqual([]);
  });

  // Example 4: Move with a forced Capture
  // 3-3>3-2 → Move: 3-3 to 3-2, outcome=null, turncoat=[]
  it('Example 4: 3-3>3-2', () => {
    const action = assertOk(parseGAN('3-3>3-2'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 3, row: 3 });
    expect(action.dest).toEqual({ col: 3, row: 2 });
    expect(action.outcome).toBeNull();
    expect(action.turncoat).toEqual([]);
  });

  // Example 5: Move with Stack choice, Turncoat declined
  // 5-6>5-5= → Move: 5-6 to 5-5, outcome='stack', turncoat=[]
  it('Example 5: 5-6>5-5=', () => {
    const action = assertOk(parseGAN('5-6>5-5='));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 5, row: 6 });
    expect(action.dest).toEqual({ col: 5, row: 5 });
    expect(action.outcome).toBe('stack');
    expect(action.turncoat).toEqual([]);
  });

  // Example 6: Same Move, Turncoat taken
  // 5-6>5-5=+2 → Move: 5-6 to 5-5, outcome='stack', turncoat=[2]
  it('Example 6: 5-6>5-5=+2', () => {
    const action = assertOk(parseGAN('5-6>5-5=+2'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 5, row: 6 });
    expect(action.dest).toEqual({ col: 5, row: 5 });
    expect(action.outcome).toBe('stack');
    expect(action.turncoat).toEqual([2]);
  });

  // Example 7: Arata with Turncoat
  // T*5-6+1 → Arata: Captain at 5-6, turncoat=[1]
  it('Example 7: T*5-6+1', () => {
    const action = assertOk(parseGAN('T*5-6+1'));
    expect(action.kind).toBe('arata');
    if (action.kind !== 'arata') return;
    expect(action.piece).toBe('T');
    expect(action.dest).toEqual({ col: 5, row: 6 });
    expect(action.turncoat).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// Invalid strings from GAN.md
// ---------------------------------------------------------------------------

describe('parseGAN — invalid strings from GAN.md', () => {
  // 5-8-5-7 — uses "-" instead of ">" between squares
  it('rejects 5-8-5-7 (uses - instead of >)', () => {
    const result = parseGAN('5-8-5-7');
    assertError(result, 'A1');
  });

  // 3-3>3-2x — redundant x when capture is forced (A1 violation)
  // This is syntactically valid (grammar permits optional outcome), but
  // semantically non-canonical (A1). The parser accepts it; validation rejects it.
  it('parses 3-3>3-2x (valid syntax, A1 violation is semantic/validation)', () => {
    const result = parseGAN('3-3>3-2x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('move');
    if (result.action.kind !== 'move') return;
    expect(result.action.origin).toEqual({ col: 3, row: 3 });
    expect(result.action.dest).toEqual({ col: 3, row: 2 });
    expect(result.action.outcome).toBe('capture');
  });

  // 5-6>5-5 — missing outcome when choice exists
  // This is a semantic (S3/A1) issue — at parse level it's valid syntax
  it('parses 5-6>5-5 but validation would reject (S3/A1)', () => {
    // Parsing succeeds — outcome=null, turncoat=[]
    const result = parseGAN('5-6>5-5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('move');
    if (result.action.kind !== 'move') return;
    expect(result.action.outcome).toBeNull();
    expect(result.action.turncoat).toEqual([]);
  });

  // T*5-6+21 — levels not ascending (A3 violation)
  it('rejects T*5-6+21 (levels not ascending)', () => {
    const result = parseGAN('T*5-6+21');
    assertError(result, 'A3');
  });

  // M5-9!! — multiple "!" (A4/grammar violation)
  it('rejects M5-9!! (multiple !)', () => {
    const result = parseGAN('M5-9!!');
    // This has two '!' marks — the parser should reject it
    assertError(result, 'A4');
  });
});

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe('parseGAN — additional edge cases', () => {
  // Turncoat level 12: 5-6>5-5=+12 → turncoat=[1, 2]
  it('parses move with turncoat +12', () => {
    const action = assertOk(parseGAN('5-6>5-5=+12'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 5, row: 6 });
    expect(action.dest).toEqual({ col: 5, row: 5 });
    expect(action.outcome).toBe('stack');
    expect(action.turncoat).toEqual([1, 2]);
  });

  // Empty turncoat: T*5-6 → turncoat=[]
  it('parses arata without turncoat', () => {
    const action = assertOk(parseGAN('T*5-6'));
    expect(action.kind).toBe('arata');
    if (action.kind !== 'arata') return;
    expect(action.piece).toBe('T');
    expect(action.dest).toEqual({ col: 5, row: 6 });
    expect(action.turncoat).toEqual([]);
  });

  // Placement without Done: P3-8 → done=false
  it('parses placement without done', () => {
    const action = assertOk(parseGAN('P3-8'));
    expect(action.kind).toBe('placement');
    if (action.kind !== 'placement') return;
    expect(action.piece).toBe('P');
    expect(action.dest).toEqual({ col: 3, row: 8 });
    expect(action.done).toBe(false);
  });

  // All 14 piece types in placements
  const PIECES = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
  for (const p of PIECES) {
    it(`parses placement for piece ${p}`, () => {
      const gan = `${p}5-9`;
      const action = assertOk(parseGAN(gan));
      expect(action.kind).toBe('placement');
      if (action.kind !== 'placement') return;
      expect(action.piece).toBe(p);
      expect(action.dest).toEqual({ col: 5, row: 9 });
      expect(action.done).toBe(false);
    });
  }

  // All 14 piece types in aratas
  for (const p of PIECES) {
    it(`parses arata for piece ${p}`, () => {
      const gan = `${p}*5-9`;
      const action = assertOk(parseGAN(gan));
      expect(action.kind).toBe('arata');
      if (action.kind !== 'arata') return;
      expect(action.piece).toBe(p);
      expect(action.dest).toEqual({ col: 5, row: 9 });
      expect(action.turncoat).toEqual([]);
    });
  }

  // Square boundary values: 1-1, 9-9
  it('parses move with corner squares 1-1>9-9', () => {
    const action = assertOk(parseGAN('1-1>9-9'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 1, row: 1 });
    expect(action.dest).toEqual({ col: 9, row: 9 });
    expect(action.outcome).toBeNull();
    expect(action.turncoat).toEqual([]);
  });

  // Move with capture outcome
  it('parses move with capture outcome (chosen over stack)', () => {
    const action = assertOk(parseGAN('5-6>5-5x'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.outcome).toBe('capture');
    expect(action.turncoat).toEqual([]);
  });

  // Move with capture outcome + turncoat is invalid by S5 but parses fine
  it('parses move with capture + turncoat (will fail S5 validation)', () => {
    const action = assertOk(parseGAN('5-6>5-5x+1'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.outcome).toBe('capture');
    expect(action.turncoat).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — rejection tests
// ---------------------------------------------------------------------------

describe('parseGAN — invalid inputs', () => {
  it('rejects empty string', () => {
    const result = parseGAN('');
    assertError(result, 'A1');
  });

  it('rejects whitespace-only string', () => {
    const result = parseGAN('   ');
    assertError(result, 'A1');
  });

  it('rejects lowercase piece letter in placement', () => {
    const result = parseGAN('m5-9');
    assertError(result, 'A1');
  });

  it('rejects lowercase piece letter in arata', () => {
    const result = parseGAN('t*5-6');
    assertError(result, 'A1');
  });

  it('rejects invalid square col=0: M0-1', () => {
    const result = parseGAN('M0-1');
    // The parser first validates piece letter (M is valid) then tries square
    // parseSquare('0-1') should throw
    assertError(result, 'A1');
  });

  it('rejects invalid square row=0: M1-0', () => {
    const result = parseGAN('M1-0');
    assertError(result, 'A1');
  });

  it('rejects invalid square col=10: M10-1', () => {
    const result = parseGAN('M10-1');
    assertError(result, 'A1');
  });

  it('rejects missing square: M5-', () => {
    const result = parseGAN('M5-');
    assertError(result, 'A1');
  });

  it('rejects missing square part: M-9', () => {
    const result = parseGAN('M-9');
    assertError(result, 'A1');
  });

  it('rejects missing entire square: M5', () => {
    const result = parseGAN('M5');
    assertError(result, 'A1');
  });

  it('rejects missing > in move: 2-72-6', () => {
    const result = parseGAN('2-72-6');
    assertError(result, 'A1');
  });

  it('T5-6 parses as a placement (no * means not an arata)', () => {
    const result = parseGAN('T5-6');
    // T5-6: piece='T', square='5-6' → valid placement syntax
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('placement');
  });

  it('rejects leading whitespace', () => {
    const result = parseGAN(' M5-9');
    assertError(result, 'A5');
  });

  it('rejects trailing whitespace', () => {
    const result = parseGAN('M5-9 ');
    assertError(result, 'A5');
  });

  it('rejects internal whitespace in placement', () => {
    const result = parseGAN('M 5-9');
    assertError(result, 'A5');
  });

  it('rejects unknown piece letter X', () => {
    const result = parseGAN('X5-9');
    assertError(result, 'A1');
  });

  it('rejects starting with invalid character', () => {
    const result = parseGAN('?5-9');
    assertError(result, 'A1');
  });

  it('rejects placement with ! not at end', () => {
    const result = parseGAN('M!5-9');
    // A4: ! must be a suffix on a placement, not in the middle
    assertError(result, 'A4');
  });

  it('rejects arata with trailing characters after square', () => {
    const result = parseGAN('T*5-6x');
    assertError(result, 'A6');
  });

  it('rejects move with too many > separators', () => {
    const result = parseGAN('5-6>5-5>5-4');
    // The parser detects multiple ">" separators and rejects with A1
    assertError(result, 'A1');
  });

  it('rejects move with unexpected characters', () => {
    const result = parseGAN('5-6>5-5$');
    // This should fail A6 — the $ is not valid
    assertError(result, 'A6');
  });
});
