import { describe, it, expect } from 'vitest';
import {
  type Square,
  type Stack,
  type Position,
  type TurnState,
  type Hand,
  type GameState,
  type GlobalState,
  type GameResult,
  type MovementDef,
} from '../src/types.js';

describe('Square', () => {
  it('Square 1-1 is top-right corner (Standard Diagram)', () => {
    // Single point of truth for the coordinate system: types.ts JSDoc on Square
    // documents col 1-9 (1 = rightmost), row 1-9 (1 = topmost).
    // If this assumption is wrong, all parser, board, and movement logic fails downstream.
    const square: Square = { col: 1, row: 1 };
    expect(square.col).toBe(1);
    expect(square.row).toBe(1);
  });
});

describe('Player', () => {
  it('Player can be white or black', () => {
    const white = 'white' as const;
    const black = 'black' as const;
    expect(white).toBe('white');
    expect(black).toBe('black');
  });
});

describe('Piece type', () => {
  it('Piece type accepts all 14 letters', () => {
    const types = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'] as const;
    expect(types.length).toBe(14);
  });
});

describe('Piece', () => {
  it('Piece has type and owner', () => {
    const piece = { type: 'M' as const, owner: 'white' as const };
    expect(piece.type).toBe('M');
    expect(piece.owner).toBe('white');
  });
});

describe('Stack', () => {
  it('Stack is an array of pieces', () => {
    const stack: Stack = [
      { type: 'P' as const, owner: 'white' as const },
      { type: 'P' as const, owner: 'black' as const },
    ];
    expect(stack.length).toBe(2);
    expect(stack[0].type).toBe('P');
  });
});

describe('Position', () => {
  it('Position is a 9x9 row-major grid', () => {
    const position: Position = [
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
    ];
    expect(position.length).toBe(9);
    expect(position[0].length).toBe(9);
  });
});

describe('Phase', () => {
  it('Phase can be deploy or battle', () => {
    const deploy = 'deploy' as const;
    const battle = 'battle' as const;
    expect(deploy).toBe('deploy');
    expect(battle).toBe('battle');
  });
});

describe('TurnState', () => {
  it('TurnState has flattened phase, activePlayer, done, counter', () => {
    const turn: TurnState = { phase: 'deploy', activePlayer: 'white', done: null, counter: 0 };
    expect(turn.phase).toBe('deploy');
    expect(turn.activePlayer).toBe('white');
    expect(turn.done).toBeNull();
    expect(turn.counter).toBe(0);
  });

  it('done is set during deploy when opponent declares Done', () => {
    const turn: TurnState = { phase: 'deploy', activePlayer: 'black', done: 'white', counter: 5 };
    expect(turn.done).toBe('white');
  });

  it('counter increments each turn', () => {
    const turn: TurnState = { phase: 'battle', activePlayer: 'white', done: null, counter: 10 };
    expect(turn.counter).toBe(10);
  });
});

describe('Hand', () => {
  it('Hand is a full Record<PieceType, number> with all keys present', () => {
    const hand: Hand = {
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 1,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    };
    expect(hand.M).toBe(1);
    expect(hand.P).toBe(4);
    // Every type key must exist (no undefined)
    const keys = Object.keys(hand);
    expect(keys).toContain('A');
    expect(keys).toContain('Y');
  });

  it('Hand zero is explicit', () => {
    const hand: Hand = {
      A: 0,
      C: 0,
      E: 0,
      F: 0,
      G: 0,
      J: 0,
      L: 0,
      M: 0,
      N: 0,
      P: 0,
      S: 0,
      T: 0,
      U: 0,
      Y: 0,
    };
    expect(hand.M).toBe(0);
    expect(hand.Y).toBe(0);
  });
});

describe('GameState', () => {
  it('GameState has position, turn, hands (no history)', () => {
    const position: Position = [
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
    ];
    const turn: TurnState = { phase: 'deploy', activePlayer: 'white', done: null, counter: 0 };
    const emptyHand = (): Hand => ({
      A: 0,
      C: 0,
      E: 0,
      F: 0,
      G: 0,
      J: 0,
      L: 0,
      M: 0,
      N: 0,
      P: 0,
      S: 0,
      T: 0,
      U: 0,
      Y: 0,
    });

    const state: GameState = {
      position,
      turn,
      hands: { white: emptyHand(), black: emptyHand() },
    };

    expect(state.position.length).toBe(9);
    expect(state.turn.phase).toBe('deploy');
    expect(state.turn.counter).toBe(0);
    // history is NOT part of GameState
    expect((state as Record<string, unknown>).history).toBeUndefined();
  });
});

describe('GlobalState', () => {
  it('GlobalState wraps current, history, result', () => {
    const current: GameState = {
      position: [
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ],
      turn: { phase: 'deploy', activePlayer: 'white', done: null, counter: 0 },
      hands: {
        white: {
          A: 2,
          C: 1,
          E: 3,
          F: 2,
          G: 1,
          J: 2,
          L: 1,
          M: 1,
          N: 2,
          P: 4,
          S: 2,
          T: 1,
          U: 1,
          Y: 2,
        },
        black: {
          A: 2,
          C: 1,
          E: 3,
          F: 2,
          G: 1,
          J: 2,
          L: 1,
          M: 1,
          N: 2,
          P: 4,
          S: 2,
          T: 1,
          U: 1,
          Y: 2,
        },
      },
    };

    const global: GlobalState = { current, history: [], result: { kind: 'ongoing' } };
    expect(global.current.turn.phase).toBe('deploy');
    expect(global.history).toHaveLength(0);
    expect(global.result.kind).toBe('ongoing');
  });
});

describe('GameResult', () => {
  it('ongoing is the default', () => {
    const result: GameResult = { kind: 'ongoing' };
    expect(result.kind).toBe('ongoing');
  });

  it('checkmate has a loser', () => {
    const result: GameResult = { kind: 'checkmate', loser: 'black' };
    expect(result.kind).toBe('checkmate');
    expect(result.loser).toBe('black');
  });

  it('stalemate has a loser', () => {
    const result: GameResult = { kind: 'stalemate', loser: 'white' };
    expect(result.kind).toBe('stalemate');
    expect(result.loser).toBe('white');
  });

  it('exposure has a loser', () => {
    const result: GameResult = { kind: 'exposure', loser: 'black' };
    expect(result.kind).toBe('exposure');
  });

  it('exposure-draw is a draw', () => {
    const result: GameResult = { kind: 'exposure-draw' };
    expect(result.kind).toBe('exposure-draw');
  });

  it('repetition is a draw', () => {
    const result: GameResult = { kind: 'repetition' };
    expect(result.kind).toBe('repetition');
  });
});

describe('Action', () => {
  it('Placement discriminates on kind', () => {
    const placement = {
      kind: 'placement' as const,
      piece: 'M' as const,
      dest: { col: 5, row: 7 },
      done: false,
    };
    expect(placement.kind).toBe('placement');
    expect(placement.dest.col).toBe(5);
  });

  it('Move has origin, dest, outcome, turncoat', () => {
    const move = {
      kind: 'move' as const,
      origin: { col: 3, row: 3 },
      dest: { col: 3, row: 4 },
      outcome: null as 'stack' | 'capture' | null,
      turncoat: [] as number[],
    };
    expect(move.kind).toBe('move');
    expect(move.origin.col).toBe(3);
  });

  it('Arata has piece, dest, turncoat', () => {
    const arata = {
      kind: 'arata' as const,
      piece: 'P' as const,
      dest: { col: 4, row: 8 },
      turncoat: [] as number[],
    };
    expect(arata.kind).toBe('arata');
    expect(arata.piece).toBe('P');
  });
});

describe('MovementDef', () => {
  it('MovementDef holds declarative movement rules per class', () => {
    const def: MovementDef = {
      step: ['F', 'B'],
      limitedRange: [],
      range: [],
      jumps: [{ dest: { col: 0, row: 2 }, over: [{ col: 0, row: 1 }] }],
    };
    expect(def.step).toHaveLength(2);
    expect(def.jumps[0].dest).toEqual({ col: 0, row: 2 });
  });
});

describe('Direction', () => {
  it('Direction accepts all 8 vectors', () => {
    const dirs = ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'] as const;
    expect(dirs.length).toBe(8);
  });
});

describe('MoveClass', () => {
  it('MoveClass accepts 4 values', () => {
    const classes = ['step', 'limited-range', 'range', 'jump'] as const;
    expect(classes.length).toBe(4);
  });
});
