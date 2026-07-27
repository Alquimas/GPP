import { describe, it, expect } from 'vitest';
import {
  serializeGAN,
  serializeSquare,
  serializeTurncoat,
  serializePlacement,
  serializeMove,
  serializeArata,
} from '../../src/gan/serialize.js';
import { parseGAN, type ParseResult } from '../../src/gan/parse.js';
import type { Action } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that parseGAN succeeds and return the parsed Action.
 */
function assertParseOk(result: ParseResult): Action {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.action;
}

/**
 * Assert round-trip: serialize(parse(gan)) === gan and parse(serialize(action))
 * deeply equals action.
 */
function assertRoundTrip(gan: string, action: Action): void {
  // Serialize → string
  const serialized = serializeGAN(action);
  expect(serialized).toBe(gan);

  // Parse → action
  const parsed = assertParseOk(parseGAN(serialized));
  expect(parsed).toEqual(action);
}

// ---------------------------------------------------------------------------
// serializeSquare
// ---------------------------------------------------------------------------

describe('serializeSquare', () => {
  it('serializes 5-9', () => {
    expect(serializeSquare({ col: 5, row: 9 })).toBe('5-9');
  });

  it('serializes 1-1', () => {
    expect(serializeSquare({ col: 1, row: 1 })).toBe('1-1');
  });

  it('serializes 9-9', () => {
    expect(serializeSquare({ col: 9, row: 9 })).toBe('9-9');
  });

  it('serializes 3-7', () => {
    expect(serializeSquare({ col: 3, row: 7 })).toBe('3-7');
  });
});

// ---------------------------------------------------------------------------
// serializeTurncoat
// ---------------------------------------------------------------------------

describe('serializeTurncoat', () => {
  it('empty array → empty string', () => {
    expect(serializeTurncoat([])).toBe('');
  });

  it('[1] → +1', () => {
    expect(serializeTurncoat([1])).toBe('+1');
  });

  it('[2] → +2', () => {
    expect(serializeTurncoat([2])).toBe('+2');
  });

  it('[1, 2] → +12', () => {
    expect(serializeTurncoat([1, 2])).toBe('+12');
  });
});

// ---------------------------------------------------------------------------
// serializePlacement
// ---------------------------------------------------------------------------

describe('serializePlacement', () => {
  it('basic placement without done', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'M',
      dest: { col: 5, row: 9 },
      done: false,
    };
    expect(serializePlacement(action)).toBe('M5-9');
  });

  it('placement with done', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'G',
      dest: { col: 5, row: 1 },
      done: true,
    };
    expect(serializePlacement(action)).toBe('G5-1!');
  });

  it('all 14 piece types', () => {
    const pieces = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
    for (const p of pieces) {
      const action: Action = {
        kind: 'placement',
        piece: p,
        dest: { col: 5, row: 9 },
        done: false,
      };
      expect(serializePlacement(action)).toBe(`${p}5-9`);
    }
  });

  it('boundary squares', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'P',
      dest: { col: 1, row: 1 },
      done: false,
    };
    expect(serializePlacement(action)).toBe('P1-1');
  });

  it('bottom-right corner', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'P',
      dest: { col: 9, row: 9 },
      done: false,
    };
    expect(serializePlacement(action)).toBe('P9-9');
  });
});

// ---------------------------------------------------------------------------
// serializeMove
// ---------------------------------------------------------------------------

describe('serializeMove', () => {
  it('plain move, no outcome, no turncoat', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    };
    expect(serializeMove(action)).toBe('2-7>2-6');
  });

  it('move with stack outcome', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [],
    };
    expect(serializeMove(action)).toBe('5-6>5-5=');
  });

  it('move with capture outcome', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [],
    };
    expect(serializeMove(action)).toBe('5-6>5-5x');
  });

  it('move with stack + turncoat level 2', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [2],
    };
    expect(serializeMove(action)).toBe('5-6>5-5=+2');
  });

  it('move with stack + turncoat level 1', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1],
    };
    expect(serializeMove(action)).toBe('5-6>5-5=+1');
  });

  it('move with stack + both turncoat levels', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1, 2],
    };
    expect(serializeMove(action)).toBe('5-6>5-5=+12');
  });

  it('move with forced outcome (null) + turncoat', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: null,
      turncoat: [1],
    };
    expect(serializeMove(action)).toBe('5-6>5-5+1');
  });

  it('corner-to-corner move', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 1, row: 1 },
      dest: { col: 9, row: 9 },
      outcome: null,
      turncoat: [],
    };
    expect(serializeMove(action)).toBe('1-1>9-9');
  });
});

// ---------------------------------------------------------------------------
// serializeArata
// ---------------------------------------------------------------------------

describe('serializeArata', () => {
  it('basic arata without turncoat', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [],
    };
    expect(serializeArata(action)).toBe('T*5-6');
  });

  it('arata with turncoat level 1', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [1],
    };
    expect(serializeArata(action)).toBe('T*5-6+1');
  });

  it('arata with turncoat level 2', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [2],
    };
    expect(serializeArata(action)).toBe('T*5-6+2');
  });

  it('arata with both turncoat levels', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [1, 2],
    };
    expect(serializeArata(action)).toBe('T*5-6+12');
  });

  it('all 14 piece types in aratas', () => {
    const pieces = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
    for (const p of pieces) {
      const action: Action = {
        kind: 'arata',
        piece: p,
        dest: { col: 5, row: 6 },
        turncoat: [],
      };
      expect(serializeArata(action)).toBe(`${p}*5-6`);
    }
  });

  it('boundary square arata', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 1, row: 1 },
      turncoat: [],
    };
    expect(serializeArata(action)).toBe('T*1-1');
  });
});

// ---------------------------------------------------------------------------
// serializeGAN — dispatch
// ---------------------------------------------------------------------------

describe('serializeGAN', () => {
  it('dispatches placement', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'M',
      dest: { col: 5, row: 9 },
      done: false,
    };
    expect(serializeGAN(action)).toBe('M5-9');
  });

  it('dispatches move', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    };
    expect(serializeGAN(action)).toBe('2-7>2-6');
  });

  it('dispatches arata', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [],
    };
    expect(serializeGAN(action)).toBe('T*5-6');
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests: Worked examples from GAN.md
// ---------------------------------------------------------------------------

describe('round-trip — worked examples from GAN.md', () => {
  // Example 1: Opening Placement
  // M5-9 → Placement: Marshal at 5-9, done=false
  it('Example 1: M5-9', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'M',
      dest: { col: 5, row: 9 },
      done: false,
    };
    assertRoundTrip('M5-9', action);
  });

  // Example 2: Placement with Done
  // G5-1! → Placement: General at 5-1, done=true
  it('Example 2: G5-1!', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'G',
      dest: { col: 5, row: 1 },
      done: true,
    };
    assertRoundTrip('G5-1!', action);
  });

  // Example 3: Plain Move, no choice available
  // 2-7>2-6 → Move: 2-7 to 2-6, outcome=null, turncoat=[]
  it('Example 3: 2-7>2-6', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    };
    assertRoundTrip('2-7>2-6', action);
  });

  // Example 4: Move with a forced Capture
  // 3-3>3-2 → Move: 3-3 to 3-2, outcome=null, turncoat=[]
  it('Example 4: 3-3>3-2', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 3, row: 3 },
      dest: { col: 3, row: 2 },
      outcome: null,
      turncoat: [],
    };
    assertRoundTrip('3-3>3-2', action);
  });

  // Example 5: Move with Stack choice, Turncoat declined
  // 5-6>5-5= → Move: 5-6 to 5-5, outcome='stack', turncoat=[]
  it('Example 5: 5-6>5-5=', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [],
    };
    assertRoundTrip('5-6>5-5=', action);
  });

  // Example 6: Same Move, Turncoat taken
  // 5-6>5-5=+2 → Move: 5-6 to 5-5, outcome='stack', turncoat=[2]
  it('Example 6: 5-6>5-5=+2', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [2],
    };
    assertRoundTrip('5-6>5-5=+2', action);
  });

  // Example 7: Arata with Turncoat
  // T*5-6+1 → Arata: Captain at 5-6, turncoat=[1]
  it('Example 7: T*5-6+1', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [1],
    };
    assertRoundTrip('T*5-6+1', action);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: Edge cases
// ---------------------------------------------------------------------------

describe('round-trip — edge cases', () => {
  it('turncoat level 1 only (move)', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1],
    };
    assertRoundTrip('5-6>5-5=+1', action);
  });

  it('turncoat with both levels (move)', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1, 2],
    };
    assertRoundTrip('5-6>5-5=+12', action);
  });

  it('capture outcome (move)', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [],
    };
    assertRoundTrip('5-6>5-5x', action);
  });

  it('capture outcome with turncoat (semantically invalid but serializable)', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [1],
    };
    assertRoundTrip('5-6>5-5x+1', action);
  });

  it('null outcome with turncoat (forced outcome + turncoat)', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: null,
      turncoat: [2],
    };
    assertRoundTrip('5-6>5-5+2', action);
  });

  it('arata with turncoat level 2', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [2],
    };
    assertRoundTrip('T*5-6+2', action);
  });

  it('arata with both turncoat levels', () => {
    const action: Action = {
      kind: 'arata',
      piece: 'T',
      dest: { col: 5, row: 6 },
      turncoat: [1, 2],
    };
    assertRoundTrip('T*5-6+12', action);
  });

  it('placement with all piece types round-trips', () => {
    const pieces = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
    for (const p of pieces) {
      const action: Action = {
        kind: 'placement',
        piece: p,
        dest: { col: 5, row: 9 },
        done: false,
      };
      assertRoundTrip(`${p}5-9`, action);
    }
  });

  it('arata with all piece types round-trips', () => {
    const pieces = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
    for (const p of pieces) {
      const action: Action = {
        kind: 'arata',
        piece: p,
        dest: { col: 5, row: 6 },
        turncoat: [],
      };
      assertRoundTrip(`${p}*5-6`, action);
    }
  });

  it('square boundary values: 1-1', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 1, row: 1 },
      dest: { col: 5, row: 5 },
      outcome: null,
      turncoat: [],
    };
    assertRoundTrip('1-1>5-5', action);
  });

  it('square boundary values: 9-9', () => {
    const action: Action = {
      kind: 'move',
      origin: { col: 5, row: 5 },
      dest: { col: 9, row: 9 },
      outcome: null,
      turncoat: [],
    };
    assertRoundTrip('5-5>9-9', action);
  });

  it('placement at 9-9 with done', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'P',
      dest: { col: 9, row: 9 },
      done: true,
    };
    assertRoundTrip('P9-9!', action);
  });

  it('placement at 1-1 without done', () => {
    const action: Action = {
      kind: 'placement',
      piece: 'P',
      dest: { col: 1, row: 1 },
      done: false,
    };
    assertRoundTrip('P1-1', action);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: parse(serialize(action)) invariant for arbitrary canonical inputs
// ---------------------------------------------------------------------------

describe('round-trip — parse(serialize(action)) === action invariant', () => {
  // A set of diverse canonical Action objects that should round-trip perfectly.
  const canonicalActions: Action[] = [
    // Placements
    { kind: 'placement', piece: 'M', dest: { col: 5, row: 9 }, done: false },
    { kind: 'placement', piece: 'G', dest: { col: 5, row: 1 }, done: true },
    { kind: 'placement', piece: 'P', dest: { col: 3, row: 8 }, done: false },
    { kind: 'placement', piece: 'P', dest: { col: 3, row: 8 }, done: true },
    { kind: 'placement', piece: 'A', dest: { col: 1, row: 1 }, done: false },
    { kind: 'placement', piece: 'Y', dest: { col: 9, row: 9 }, done: true },
    // Moves
    {
      kind: 'move',
      origin: { col: 2, row: 7 },
      dest: { col: 2, row: 6 },
      outcome: null,
      turncoat: [],
    },
    {
      kind: 'move',
      origin: { col: 3, row: 3 },
      dest: { col: 3, row: 2 },
      outcome: null,
      turncoat: [],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [2],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'stack',
      turncoat: [1, 2],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: 'capture',
      turncoat: [1],
    },
    {
      kind: 'move',
      origin: { col: 5, row: 6 },
      dest: { col: 5, row: 5 },
      outcome: null,
      turncoat: [2],
    },
    {
      kind: 'move',
      origin: { col: 1, row: 1 },
      dest: { col: 9, row: 9 },
      outcome: null,
      turncoat: [],
    },
    {
      kind: 'move',
      origin: { col: 9, row: 9 },
      dest: { col: 1, row: 1 },
      outcome: 'stack',
      turncoat: [1, 2],
    },
    // Aratas
    { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [] },
    { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [1] },
    { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [2] },
    { kind: 'arata', piece: 'T', dest: { col: 5, row: 6 }, turncoat: [1, 2] },
    { kind: 'arata', piece: 'P', dest: { col: 1, row: 1 }, turncoat: [] },
    { kind: 'arata', piece: 'M', dest: { col: 9, row: 9 }, turncoat: [1] },
  ];

  for (const action of canonicalActions) {
    const label = `${action.kind}: ${JSON.stringify(action)}`;
    it(`round-trips ${label}`, () => {
      const serialized = serializeGAN(action);
      const parsed = assertParseOk(parseGAN(serialized));
      expect(parsed).toEqual(action);
    });
  }
});

// ---------------------------------------------------------------------------
// Round-trip: serialize(parse(gan)) returns original for canonical inputs
// ---------------------------------------------------------------------------

describe('round-trip — serialize(parse(gan)) === gan invariant', () => {
  // This set only includes canonical GAN strings that the parser accepts
  // (no strings that fail semantic validation — those still parse).
  const canonicalGANs: string[] = [
    // Placements
    'M5-9',
    'G5-1!',
    'P3-8',
    'P3-8!',
    'A1-1',
    'Y9-9!',
    // Moves
    '2-7>2-6',
    '3-3>3-2',
    '5-6>5-5=',
    '5-6>5-5x',
    '5-6>5-5=+2',
    '5-6>5-5=+1',
    '5-6>5-5=+12',
    '5-6>5-5x+1', // semantically invalid but syntactically valid
    '5-6>5-5+2', // forced outcome with turncoat
    '1-1>9-9',
    '9-9>1-1',
    // Aratas
    'T*5-6',
    'T*5-6+1',
    'T*5-6+2',
    'T*5-6+12',
    'P*1-1',
    'M*9-9',
    'M*9-9+1',
  ];

  for (const gan of canonicalGANs) {
    it(`round-trips "${gan}"`, () => {
      const parsed = assertParseOk(parseGAN(gan));
      const serialized = serializeGAN(parsed);
      expect(serialized).toBe(gan);
    });
  }
});
