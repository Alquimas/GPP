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

describe('parseGAN --- worked examples from GAN.md', () => {
  // Example 1: Opening Placement
  // M5-9 -> Placement: Marshal at 5-9
  it('Example 1: M5-9', () => {
    const action = assertOk(parseGAN('M5-9'));
    expect(action.kind).toBe('placement');
    if (action.kind !== 'placement') return;
    expect(action.piece).toBe('M');
    expect(action.dest).toEqual({ col: 5, row: 9 });
  });

  // Example 2: Done
  // ! -> Done: standalone action token
  it('Example 2: !', () => {
    const action = assertOk(parseGAN('!'));
    expect(action.kind).toBe('done');
  });

  // Example 3: Plain Move, no choice available
  // 2-7>2-6 -> Move: 2-7 to 2-6, outcome=null, turncoat=[]
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
  // 3-3>3-2 -> Move: 3-3 to 3-2, outcome=null, turncoat=[]
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
  // 5-6>5-5= -> Move: 5-6 to 5-5, outcome='stack', turncoat=[]
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
  // 5-6>5-5=+2 -> Move: 5-6 to 5-5, outcome='stack', turncoat=[2]
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
  // T*5-6+1 -> Arata: Captain at 5-6, turncoat=[1]
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

describe('parseGAN --- invalid strings from GAN.md', () => {
  // 5-8-5-7 --- uses "-" instead of ">" between squares (BR-GAN-GRAMMAR-005)
  it('rejects 5-8-5-7 (uses - instead of >)', () => {
    const result = parseGAN('5-8-5-7');
    assertError(result, 'BR-GAN-GRAMMAR-005');
  });

  // 3-3>3-2x --- redundant x when capture is forced (BR-GAN-CANON-001 violation)
  // This is syntactically valid (grammar permits optional outcome), but
  // semantically non-canonical (narrowed BR-GAN-CANON-001). The parser accepts it; validation rejects it.
  it('parses 3-3>3-2x (valid syntax, BR-GAN-CANON-001 violation is semantic/validation)', () => {
    const result = parseGAN('3-3>3-2x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('move');
    if (result.action.kind !== 'move') return;
    expect(result.action.origin).toEqual({ col: 3, row: 3 });
    expect(result.action.dest).toEqual({ col: 3, row: 2 });
    expect(result.action.outcome).toBe('capture');
  });

  // 5-6>5-5 --- missing outcome when choice exists
  // This is a semantic (BR-GAN-VALID-003/narrowed BR-GAN-CANON-001) issue --- at parse level it's valid syntax
  it('parses 5-6>5-5 but validation would reject (BR-GAN-VALID-003/narrowed BR-GAN-CANON-001)', () => {
    // Parsing succeeds --- outcome=null, turncoat=[]
    const result = parseGAN('5-6>5-5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('move');
    if (result.action.kind !== 'move') return;
    expect(result.action.outcome).toBeNull();
    expect(result.action.turncoat).toEqual([]);
  });

  // T*5-6+21 --- levels not ascending (BR-GAN-GRAMMAR-010 violation)
  it('rejects T*5-6+21 (levels not ascending)', () => {
    const result = parseGAN('T*5-6+21');
    assertError(result, 'BR-GAN-GRAMMAR-010');
  });

  // M5-9!! --- '!' is a standalone Done token; multiple '!' are illegal (BR-GAN-GRAMMAR-011)
  it('rejects M5-9!! (multiple !)', () => {
    const result = parseGAN('M5-9!!');
    // '!' is a standalone Done Action token, never part of a placement.
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // G5-1! --- placement with a trailing '!' is now invalid (BR-GAN-GRAMMAR-011)
  it('rejects G5-1! (placement cannot carry Done)', () => {
    const result = parseGAN('G5-1!');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // P3-8! --- placement with a trailing '!' is now invalid (BR-GAN-GRAMMAR-011)
  it('rejects P3-8! (placement cannot carry Done)', () => {
    const result = parseGAN('P3-8!');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // M!5-9 --- '!' in the middle of a placement is also invalid (BR-GAN-GRAMMAR-011)
  it('rejects M!5-9 (interior !)', () => {
    const result = parseGAN('M!5-9');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // !! --- Done takes exactly one '!'
  it('rejects !! (Done takes exactly one !)', () => {
    const result = parseGAN('!!');
    assertError(result, 'BR-GAN-GRAMMAR-007');
  });

  // 5-6>5-5! --- '!' is a standalone Done token, never a Move suffix (GAN.md:459, BR-GAN-GRAMMAR-011)
  it('rejects 5-6>5-5! (Move cannot carry Done)', () => {
    const result = parseGAN('5-6>5-5!');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // 5-6>5-5!= --- '!' anywhere in a Move is illegal (BR-GAN-GRAMMAR-011)
  it('rejects 5-6>5-5!= (interior ! in Move)', () => {
    const result = parseGAN('5-6>5-5!=');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // T*5-6! --- '!' is a standalone Done token, never an Arata suffix (BR-GAN-GRAMMAR-011)
  it('rejects T*5-6! (Arata cannot carry Done)', () => {
    const result = parseGAN('T*5-6!');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  // T!*5-6 --- '!' anywhere in an Arata is illegal (BR-GAN-GRAMMAR-011)
  it('rejects T!*5-6 (interior ! in Arata)', () => {
    const result = parseGAN('T!*5-6');
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });
});

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe('parseGAN --- additional edge cases', () => {
  // Turncoat level 12: 5-6>5-5=+12 -> turncoat=[1, 2]
  it('parses move with turncoat +12', () => {
    const action = assertOk(parseGAN('5-6>5-5=+12'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.origin).toEqual({ col: 5, row: 6 });
    expect(action.dest).toEqual({ col: 5, row: 5 });
    expect(action.outcome).toBe('stack');
    expect(action.turncoat).toEqual([1, 2]);
  });

  // Empty turncoat: T*5-6 -> turncoat=[]
  it('parses arata without turncoat', () => {
    const action = assertOk(parseGAN('T*5-6'));
    expect(action.kind).toBe('arata');
    if (action.kind !== 'arata') return;
    expect(action.piece).toBe('T');
    expect(action.dest).toEqual({ col: 5, row: 6 });
    expect(action.turncoat).toEqual([]);
  });

  // Placement without Done: P3-8
  it('parses placement without done', () => {
    const action = assertOk(parseGAN('P3-8'));
    expect(action.kind).toBe('placement');
    if (action.kind !== 'placement') return;
    expect(action.piece).toBe('P');
    expect(action.dest).toEqual({ col: 3, row: 8 });
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

  // Move with capture outcome + turncoat is invalid by BR-GAN-VALID-005 but parses fine
  it('parses move with capture + turncoat (will fail BR-GAN-VALID-005 validation)', () => {
    const action = assertOk(parseGAN('5-6>5-5x+1'));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') return;
    expect(action.outcome).toBe('capture');
    expect(action.turncoat).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs --- rejection tests
// ---------------------------------------------------------------------------

describe('parseGAN --- invalid inputs', () => {
  it('rejects empty string', () => {
    const result = parseGAN('');
    // BR-GAN-GRAMMAR-001: empty input
    assertError(result, 'BR-GAN-GRAMMAR-001');
  });

  it('rejects whitespace-only string', () => {
    const result = parseGAN('   ');
    // BR-GAN-GRAMMAR-001: blank input
    assertError(result, 'BR-GAN-GRAMMAR-001');
  });

  it('rejects lowercase piece letter in placement', () => {
    const result = parseGAN('m5-9');
    // BR-GAN-GRAMMAR-002: 'm' is not an uppercase letter or digit, so first-char dispatch
    // rejects it before reaching piece-validation (GRAMMAR-003) logic
    assertError(result, 'BR-GAN-GRAMMAR-002');
  });

  it('rejects lowercase piece letter in arata', () => {
    const result = parseGAN('t*5-6');
    // BR-GAN-GRAMMAR-002: same as placement --- lowercase 't' fails first-char check
    assertError(result, 'BR-GAN-GRAMMAR-002');
  });

  it('rejects invalid square col=0: M0-1', () => {
    const result = parseGAN('M0-1');
    // BR-GAN-GRAMMAR-004: malformed square (col=0)
    assertError(result, 'BR-GAN-GRAMMAR-004');
  });

  it('rejects invalid square row=0: M1-0', () => {
    const result = parseGAN('M1-0');
    // BR-GAN-GRAMMAR-004: malformed square (row=0)
    assertError(result, 'BR-GAN-GRAMMAR-004');
  });

  it('rejects invalid square col=10: M10-1', () => {
    const result = parseGAN('M10-1');
    // BR-GAN-GRAMMAR-004: malformed square (col=10)
    assertError(result, 'BR-GAN-GRAMMAR-004');
  });

  it('rejects missing square: M5-', () => {
    const result = parseGAN('M5-');
    // BR-GAN-GRAMMAR-007: length 3 < 4 minimum for placement, caught before square parsing
    assertError(result, 'BR-GAN-GRAMMAR-007');
  });

  it('rejects missing square part: M-9', () => {
    const result = parseGAN('M-9');
    // BR-GAN-GRAMMAR-007: length 3 < 4 minimum for placement, caught before square parsing
    assertError(result, 'BR-GAN-GRAMMAR-007');
  });

  it('rejects missing entire square: M5', () => {
    const result = parseGAN('M5');
    // BR-GAN-GRAMMAR-007: placement too short (M5 < 4 chars)
    assertError(result, 'BR-GAN-GRAMMAR-007');
  });

  it('rejects missing > in move: 2-72-6', () => {
    const result = parseGAN('2-72-6');
    // BR-GAN-GRAMMAR-005: no '>' separator found
    assertError(result, 'BR-GAN-GRAMMAR-005');
  });

  it('T5-6 parses as a placement (no * means not an arata)', () => {
    const result = parseGAN('T5-6');
    // T5-6: piece='T', square='5-6' -> valid placement syntax
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action.kind).toBe('placement');
  });

  it('rejects leading whitespace', () => {
    const result = parseGAN(' M5-9');
    // BR-GAN-GRAMMAR-009: leading whitespace
    assertError(result, 'BR-GAN-GRAMMAR-009');
  });

  it('rejects trailing whitespace', () => {
    const result = parseGAN('M5-9 ');
    // BR-GAN-GRAMMAR-009: trailing whitespace
    assertError(result, 'BR-GAN-GRAMMAR-009');
  });

  it('rejects internal whitespace in placement', () => {
    const result = parseGAN('M 5-9');
    // BR-GAN-GRAMMAR-009: internal whitespace
    assertError(result, 'BR-GAN-GRAMMAR-009');
  });

  it('rejects unknown piece letter X', () => {
    const result = parseGAN('X5-9');
    // BR-GAN-GRAMMAR-003: X is not a valid piece type (not in the 14-type set)
    assertError(result, 'BR-GAN-GRAMMAR-003');
  });

  it('rejects starting with invalid character', () => {
    const result = parseGAN('?5-9');
    // BR-GAN-GRAMMAR-002: ? is not a digit nor uppercase letter
    assertError(result, 'BR-GAN-GRAMMAR-002');
  });

  it('rejects placement with ! not at end', () => {
    const result = parseGAN('M!5-9');
    // BR-GAN-GRAMMAR-011: ! is not after the square
    assertError(result, 'BR-GAN-GRAMMAR-011');
  });

  it('rejects arata with trailing characters after square', () => {
    const result = parseGAN('T*5-6x');
    // BR-GAN-GRAMMAR-008: trailing 'x' after square+turncoat region
    assertError(result, 'BR-GAN-GRAMMAR-008');
  });

  it('rejects move with too many > separators', () => {
    const result = parseGAN('5-6>5-5>5-4');
    // BR-GAN-GRAMMAR-006: multiple ">" separators
    assertError(result, 'BR-GAN-GRAMMAR-006');
  });

  it('rejects move with unexpected characters', () => {
    const result = parseGAN('5-6>5-5$');
    // BR-GAN-GRAMMAR-008: $ is not a valid character
    assertError(result, 'BR-GAN-GRAMMAR-008');
  });
});
