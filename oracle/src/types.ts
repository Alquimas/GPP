/** White or Black player. */
export type Player = 'white' | 'black';

/** 14 piece type letters (uppercase). Canonical alphabetical order. */
export type PieceType =
  'A' | 'C' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'P' | 'S' | 'T' | 'U' | 'Y';

/** A piece on the board. */
export type Piece = {
  type: PieceType;
  owner: Player;
};

/** 1-indexed board coordinate, constrained to the 9×9 grid. */
export type BoardCoord = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * A board coordinate.
 * col: 1–9 (1 = rightmost in Standard Diagram)
 * row: 1–9 (1 = topmost in Standard Diagram)
 * Square 1-1 = top-right corner.
 */
export type Square = {
  col: BoardCoord;
  row: BoardCoord;
};

/**
 * A stack of pieces on a single square.
 * Ordered bottom→top (Level 1 first, highest level last).
 * Length is always 1–3.
 */
export type Stack = [Piece] | [Piece, Piece] | [Piece, Piece, Piece];

/**
 * The 9×9 board, row-major: position[row][col].
 * Row 0 = Row 1 (top), Row 8 = Row 9 (bottom).
 * null = empty square.
 *
 * ## Contract
 * A valid Position MUST satisfy:
 *   - `position.length === 9`
 *   - `position[r].length === 9` for every r ∈ 0..8
 *   - each cell is `null` (empty square) or a `Stack` of 1–3 pieces
 *
 * The type system cannot enforce the rectangular shape, so the factory
 * `emptyPosition()` and the runtime checker `validatePosition()` in
 * `board/board.ts` are the single points of truth.  Any code that
 * constructs a Position by hand should pass it through
 * `validatePosition()` before use, or use `emptyPosition()` as the seed.
 *
 * Parsers (GSFEN, GAN) may produce malformed data — the semantic
 * validators (`validateState`, BR-GSFEN-VALID-002) catch stack-shape violations, but
 * `validatePosition()` is the cheaper, earlier guard for the 9×9 shape.
 */
export type Position = (Stack | null)[][];

/** Game phase. */
export type Phase = 'deploy' | 'battle';

/**
 * Player who has declared Done, or null.
 * Non-null only during the Deploy Phase when the non-active player has
 * declared Done.
 */
export type DoneFlag = Player | null;

/** Turn tracking state. */
export type TurnState = {
  phase: Phase;
  activePlayer: Player;
  done: DoneFlag;
  counter: number;
};

/**
 * A player's hand of unplaced pieces.
 * Every PieceType key is always present; count 0 means empty.
 * The full-record form keeps a single canonical in-memory representation,
 * which Repetition comparison relies on.
 */
export type Hand = Record<PieceType, number>;

/**
 * A complete snapshot of the game at a given instant.
 * Two Game States are equal only when position, turn, and hands all match —
 * Repetition compares full Game States.
 */
export type GameState = {
  position: Position;
  turn: TurnState;
  hands: {
    white: Hand;
    black: Hand;
  };
};

/** The full runtime state including history and terminal result. */
export type GlobalState = {
  current: GameState;
  history: GameState[];
  result: GameResult;
};

/**
 * Terminal condition that ends the game.
 * - ongoing: game continues
 * - checkmate / stalemate: `loser` is the player who lost
 * - exposure: exactly one Marshal exposed → that player loses
 * - exposure-draw: both Marshals exposed → draw
 * - repetition: four identical game states → draw
 */
export type GameResult =
  | { kind: 'ongoing' }
  | { kind: 'checkmate'; loser: Player }
  | { kind: 'stalemate'; loser: Player }
  | { kind: 'exposure'; loser: Player }
  | { kind: 'exposure-draw' }
  | { kind: 'repetition' };

/**
 * Turncoat swap levels for Captain moves/aratas.
 * Constrained by GAN spec rule BR-GAN-CANON-003: levels ascending, no duplicates, only 1 or 2.
 * Valid combinations: [] (no swaps), [1], [2], [1, 2].
 */
export type TurncoatLevels = [] | [1] | [2] | [1, 2];

/** Discriminated union of all possible player actions. */
export type Action =
  | {
      kind: 'placement';
      piece: PieceType;
      dest: Square;
      /** Player declaring Done after this placement? */
      done: boolean;
    }
  | {
      kind: 'move';
      origin: Square;
      dest: Square;
      /** Outcome choice: 'stack', 'capture', or null (not yet chosen/forced). */
      outcome: 'stack' | 'capture' | null;
      /** Elected turncoat swap levels (empty = none). */
      turncoat: TurncoatLevels;
    }
  | {
      kind: 'arata';
      piece: PieceType;
      dest: Square;
      /** Elected turncoat swap levels (empty = none). */
      turncoat: TurncoatLevels;
    };

/** Classification of a piece's movement type. */
export type MoveClass = 'step' | 'limited-range' | 'range' | 'jump';

/**
 * Player-relative directional vectors.
 * F=forward, B=backward, L=left, R=right, FL=forward-left, etc.
 */
export type Direction = 'F' | 'B' | 'L' | 'R' | 'FL' | 'FR' | 'BL' | 'BR';

/**
 * A raw coordinate delta in player-relative coordinates:
 * positive row = forward, positive col = left (BUSINESS_RULES.md, Jump
 * Movement). Negate both components for the opponent's perspective.
 */
export type CoordDelta = {
  col: number;
  row: number;
};

/**
 * A jump pattern at base size (Level 1).
 * `dest` is the destination relative to the origin, in player-relative
 * coordinates. `over` is the set of jumped-over squares relative to the
 * origin, ordered nearest→farthest.
 */
export type JumpPattern = {
  dest: CoordDelta;
  over: CoordDelta[];
};

/**
 * Declarative movement rules for a single piece type.
 * Directions are player-relative; jumps use player-relative deltas.
 * Pure data — the movement engine derives concrete destinations at runtime,
 * including stack-size scaling per BR-MOVEMENT-005.
 */
export type MovementDef = {
  /** Step movement directions (1 square at size 1; extends at larger stack sizes). */
  step: Direction[];
  /** Limited-range movement directions (base maximum 2 squares at size 1). */
  limitedRange: Direction[];
  /** Range movement directions (extends to board edge). */
  range: Direction[];
  /** Jump patterns at Level 1 (scaled by stack size per BR-MOVEMENT-005). */
  jumps: JumpPattern[];
};
