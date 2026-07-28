#!/usr/bin/env node

/**
 * gsfen-gen — Generate GSFEN fixture files by loading a fixture and applying
 * overlay mutations.
 *
 * Usage:
 *   gsfen:gen \
 *     --from <path> \
 *     [--set <col>-<row> <p1>,<p2>,...] \
 *     [--clear <col>-<row>] \
 *     [--hands "<tokens>"] \
 *     [--turn <token>] \
 *     [--counter <n>] \
 *     --write <path>
 *
 * All mutations compose: --set and --clear are applied in argument order,
 * then --hands, then --turn/--counter.  The result is validated via
 * parseGSFEN + validateState before writing.  A failed validation prints
 * the error and exits 1 without writing.
 *
 * Examples:
 *
 *   # Place a mixed-ownership stack on a battle-midgame state
 *   gsfen:gen \
 *     --from fixtures/valid/battle-midgame.gsfen \
 *     --set 5-5 P,y,T \
 *     --hands "+y +p -P -Y -T" \
 *     --write fixtures/valid/gsfen-gen-test-1.gsfen
 *
 *   # Change the turn token and counter
 *   gsfen:gen \
 *     --from fixtures/valid/battle-start.gsfen \
 *     --turn b --counter 5 \
 *     --write fixtures/valid/gsfen-gen-test-2.gsfen
 */

import { parseGSFEN } from '../src/gsfen/parse.js';
import { validateState } from '../src/gsfen/validate.js';
import { serializeGSFEN } from '../src/gsfen/serialize.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import type { GameState, PieceType, Player, Stack, Piece, TurnState } from '../src/types.js';
import { ALL_PIECE_TYPES } from '../src/constants.js';

const VALID_TURN_TOKENS = new Set(['w', 'b', 'dw', 'db', 'dwB', 'dbW']);
const VALID_PIECE_SET = new Set<string>(ALL_PIECE_TYPES);

// ===========================================================================
// Error helpers
// ===========================================================================

function die(msg: string): never {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

// ===========================================================================
// Argument parsing
// ===========================================================================

type SetOp = { col: number; row: number; stack: string[] };
type ClearOp = { col: number; row: number };

type Args = {
  from: string;
  sets: SetOp[];
  clears: ClearOp[];
  handsTokens: string[];  // split from --hands
  turn: string | null;
  counter: string | null;
  write: string;
};

function parseCoord(s: string): { col: number; row: number } {
  const m = s.match(/^([1-9])-([1-9])$/);
  if (!m) die(`Invalid coordinate "${s}".  Expected col-row, e.g. "5-5".`);
  return { col: parseInt(m[1], 10), row: parseInt(m[2], 10) };
}

function parseArgs(argv: string[]): Args {
  let from: string | null = null;
  let write: string | null = null;
  const sets: SetOp[] = [];
  const clears: ClearOp[] = [];
  let hands: string | null = null;
  let turn: string | null = null;
  let counter: string | null = null;

  let i = 0;
  while (i < argv.length) {
    const flag = argv[i];
    switch (flag) {
      case '--from':
        i++;
        if (i >= argv.length) die('--from requires a file path');
        from = argv[i];
        i++;
        break;

      case '--set': {
        i++;
        if (i + 1 >= argv.length) die('--set requires <coord> <stack>');
        const coord = argv[i];
        const stackStr = argv[i + 1];
        sets.push({
          ...parseCoord(coord),
          stack: stackStr.split(',').map((s) => s.trim()).filter(Boolean),
        });
        i += 2;
        break;
      }

      case '--clear':
        i++;
        if (i >= argv.length) die('--clear requires a coordinate');
        clears.push(parseCoord(argv[i]));
        i++;
        break;

      case '--hands':
        i++;
        if (i >= argv.length) die('--hands requires a token string');
        hands = argv[i];
        i++;
        break;

      case '--turn':
        i++;
        if (i >= argv.length) die('--turn requires a token');
        turn = argv[i];
        i++;
        break;

      case '--counter':
        i++;
        if (i >= argv.length) die('--counter requires a number');
        counter = argv[i];
        i++;
        break;

      case '--write':
        i++;
        if (i >= argv.length) die('--write requires a file path');
        write = argv[i];
        i++;
        break;

      default:
        die(`Unknown argument: ${flag}`);
    }
  }

  if (!from) die('--from is required');
  if (!write) die('--write is required');

  // Normalise hands string into tokens, handling both quoted and unquoted
  // whitespace-separated forms.
  const handsTokens: string[] = [];
  if (hands !== null) {
    for (const tok of hands.split(/\s+/)) {
      if (tok.length > 0) handsTokens.push(tok);
    }
  }

  return { from, sets, clears, handsTokens, turn, counter, write };
}

// ===========================================================================
// Parsing helpers
// ===========================================================================

function toPlayerAndType(letter: string): { owner: Player; type: PieceType } {
  if (letter.length !== 1) die(`Invalid piece spec: "${letter}" (must be a single letter)`);
  const upper = letter.toUpperCase() as PieceType;
  if (!VALID_PIECE_SET.has(upper)) die(`Unknown piece type: "${letter}"`);
  return {
    owner: letter === upper ? 'white' : 'black',
    type: upper,
  };
}

function parseTurnToken(token: string): TurnState {
  if (!VALID_TURN_TOKENS.has(token)) {
    die(`Invalid turn token "${token}".  Must be one of: w, b, dw, db, dwB, dbW`);
  }
  switch (token) {
    case 'w':   return { phase: 'battle', activePlayer: 'white', done: null, counter: 0 };
    case 'b':   return { phase: 'battle', activePlayer: 'black', done: null, counter: 0 };
    case 'dw':  return { phase: 'deploy', activePlayer: 'white', done: null, counter: 0 };
    case 'db':  return { phase: 'deploy', activePlayer: 'black', done: null, counter: 0 };
    case 'dwB': return { phase: 'deploy', activePlayer: 'white', done: 'black', counter: 0 };
    case 'dbW': return { phase: 'deploy', activePlayer: 'black', done: 'white', counter: 0 };
    default:    return { phase: 'battle', activePlayer: 'white', done: null, counter: 0 }; // unreachable
  }
}

function validateCounter(s: string): number {
  const n = parseInt(s, 10);
  if (!/^[1-9][0-9]*$/.test(s)) die(`Invalid counter "${s}".  Must be a positive integer (no leading zeros).`);
  return n;
}

// ===========================================================================
// Mutators
// ===========================================================================

function applySetOp(state: GameState, op: SetOp): void {
  const { col, row, stack } = op;
  const r = row - 1;
  const c = col - 1;

  if (stack.length === 0) die(`--set ${col}-${row} has an empty stack`);
  if (stack.length > 3) die(`--set ${col}-${row}: stack too deep (${stack.length} pieces, max 3)`);

  const pieces: Piece[] = stack.map((letter) => {
    const { owner, type } = toPlayerAndType(letter);
    return { owner, type };
  });

  state.position[r][c] = pieces as unknown as Stack;
}

function applyClearOp(state: GameState, op: ClearOp): void {
  const { col, row } = op;
  const r = row - 1;
  const c = col - 1;

  if (state.position[r][c] === null) {
    die(`--clear ${col}-${row}: square is already empty`);
  }
  state.position[r][c] = null;
}

function applyHandsTokens(state: GameState, tokens: string[]): void {
  for (const token of tokens) {
    if (token.length < 2) die(`Invalid hand token: "${token}"`);

    const sign = token[0];
    if (sign !== '+' && sign !== '-') {
      die(`Invalid hand token: "${token}" — expected "+M" or "-P" format`);
    }
    if (token.length !== 2) {
      die(`Invalid hand token: "${token}" — tokens must be exactly 2 characters (e.g. "+M", "-P")`);
    }

    const letter = token[1];
    const { owner, type } = toPlayerAndType(letter);
    const delta = sign === '+' ? 1 : -1;

    const newCount = state.hands[owner][type] + delta;
    if (newCount < 0) {
      die(`Cannot remove piece: "${token}" would make ${owner}'s ${type} count negative ` +
        `(currently ${state.hands[owner][type]})`);
    }

    state.hands[owner][type] = newCount;
  }
}

// ===========================================================================
// Output path validation
// ===========================================================================

function validateWritePath(writeArg: string): string {
  const resolved = resolve(process.cwd(), writeArg);
  if (!resolved.endsWith('.gsfen')) {
    die(`--write path must end in .gsfen: "${writeArg}"`);
  }
  // Ensure the resolved path lives under .../oracle/fixtures/
  // Walk up the resolved path looking for the fixtures/ directory.
  const parts = normalize(resolved).split('/');
  const fixturesIdx = parts.lastIndexOf('fixtures');
  if (fixturesIdx < 1 || parts[fixturesIdx - 1] !== 'oracle') {
    die(`--write path must be under oracle/fixtures/: "${writeArg}"`);
  }
  return resolved;
}

// ===========================================================================
// Main
// ===========================================================================

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // -----------------------------------------------------------------------
  // 1 — Load fixture
  // -----------------------------------------------------------------------
  if (!existsSync(args.from)) {
    die(`--from file not found: "${args.from}"`);
  }
  const raw = readFileSync(args.from, 'utf-8').trim();
  const parsed = parseGSFEN(raw);
  if (!parsed.ok) {
    process.stderr.write(`parse error in fixture: ${parsed.error.rule}: ${parsed.error.message}\n`);
    process.exit(1);
  }
  const state: GameState = parsed.state;

  // -----------------------------------------------------------------------
  // 2 — Apply board mutations (in argument order)
  // -----------------------------------------------------------------------
  for (const op of args.sets) applySetOp(state, op);
  for (const op of args.clears) applyClearOp(state, op);

  // -----------------------------------------------------------------------
  // 3 — Apply hand mutations
  // -----------------------------------------------------------------------
  if (args.handsTokens.length > 0) applyHandsTokens(state, args.handsTokens);

  // -----------------------------------------------------------------------
  // 4 — Apply turn / counter overrides
  // -----------------------------------------------------------------------
  if (args.turn !== null) {
    state.turn = parseTurnToken(args.turn);
  }
  if (args.counter !== null) {
    state.turn.counter = validateCounter(args.counter);
  }

  // -----------------------------------------------------------------------
  // 5 — Validate semantics
  // -----------------------------------------------------------------------
  const validation = validateState(state);
  if (!validation.ok) {
    process.stderr.write(`${validation.error.rule}: ${validation.error.message}\n`);
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 6 — Serialize and defensive re-parse
  // -----------------------------------------------------------------------
  const gsfen = serializeGSFEN(state);
  const reparsed = parseGSFEN(gsfen);
  if (!reparsed.ok) {
    process.stderr.write(
      `BUG: serializeGSFEN produced output that does not re-parse:\n` +
      `${reparsed.error.rule}: ${reparsed.error.message}\n` +
      `Output: ${gsfen}\n`,
    );
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 7 — Write
  // -----------------------------------------------------------------------
  const writePath = validateWritePath(args.write);
  writeFileSync(writePath, gsfen + '\n');
  console.log(`Wrote ${writePath}`);
}

main();
