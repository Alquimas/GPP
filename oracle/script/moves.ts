#!/usr/bin/env node

/**
 * moves --- Enumerate all legal actions from a GSFEN position.
 *
 * Usage:
 *   npm run gsfen -- moves "<gsfen string>"
 *   npm run gsfen -- moves --file <path>
 */

import { parseGSFEN } from '../src/gsfen/parse.js';
import { validateState } from '../src/gsfen/validate.js';
import { serializeGAN } from '../src/gan/serialize.js';
import { Game } from '../src/game/game.js';
import { PIECE_NAMES } from '../src/constants.js';
import { topPiece } from '../src/board/board.js';
import { readFileSync } from 'node:fs';
import type { Action, GameState, PieceType } from '../src/types.js';
import { ALL_PIECE_TYPES } from '../src/constants.js';

// ---------------------------------------------------------------------------
// Display helpers (adapted from gsfen.ts)
// ---------------------------------------------------------------------------

function encodeStack(state: GameState, row: number, col: number): string {
  const stack = state.position[row][col];
  if (stack === null) return '.';
  return stack
    .map((p) => (p.owner === 'white' ? p.type : p.type.toLowerCase()))
    .join('');
}

function printBoard(state: GameState): void {
  const colHeader = '  ' + [9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => `${n}`.padStart(3)).join('  ');
  console.log(colHeader);
  for (let r = 0; r < 9; r++) {
    const cells: string[] = [];
    for (let c = 8; c >= 0; c--) {
      cells.push(encodeStack(state, r, c).padStart(3));
    }
    console.log(`${r + 1} ${cells.join('  ')}`);
  }
}

function printHands(state: GameState): void {
  const whiteParts: string[] = [];
  const blackParts: string[] = [];

  for (const type of ALL_PIECE_TYPES) {
    const wc = state.hands.white[type];
    if (wc > 0) whiteParts.push(wc > 1 ? `${wc}${type}` : type);
    const bc = state.hands.black[type];
    if (bc > 0) blackParts.push(bc > 1 ? `${bc}${type.toLowerCase()}` : type.toLowerCase());
  }

  const wStr = whiteParts.length > 0 ? whiteParts.join(' ') : 'empty';
  const bStr = blackParts.length > 0 ? blackParts.join(' ') : 'empty';
  console.log(`Hands: white: ${wStr}  black: ${bStr}`);
}

function printTurn(state: GameState): void {
  const { phase, activePlayer, counter, done } = state.turn;
  const activeLabel = activePlayer === 'white' ? 'White' : 'Black';
  console.log(`Turn: ${phase}  active: ${activeLabel}  counter: ${counter}${done ? `  done: ${done}` : ''}`);
}

// ---------------------------------------------------------------------------
// Action description helpers
// ---------------------------------------------------------------------------

function pieceName(type: PieceType): string {
  return PIECE_NAMES[type];
}

function describeAction(action: Action, state: GameState): string {
  const player = state.turn.activePlayer;
  const label = player === 'white' ? 'W' : 'B';

  switch (action.kind) {
    case 'placement': {
      return `${label} ${pieceName(action.piece)} ${action.piece}${action.dest.col}-${action.dest.row}`;
    }
    case 'done': {
      return `${label} Declare Done`;
    }
    case 'move': {
      const originStack = state.position[action.origin.row - 1][action.origin.col - 1];
      const pieceType = originStack ? topPiece(originStack).type : '?';
      const outcomeStr = action.outcome === 'stack' ? '=' : action.outcome === 'capture' ? 'x' : '';
      const turncoatStr = action.turncoat.length > 0 ? '+' + action.turncoat.join('') : '';
      return `${label} ${pieceName(pieceType)} ${action.origin.col}-${action.origin.row}>${action.dest.col}-${action.dest.row}${outcomeStr}${turncoatStr}`;
    }
    case 'arata': {
      const turncoatStr = action.turncoat.length > 0 ? '+' + action.turncoat.join('') : '';
      return `${label} ${pieceName(action.piece)} ${action.piece}*${action.dest.col}-${action.dest.row}${turncoatStr}`;
    }
  }
}

function ganString(action: Action): string {
  return serializeGAN(action);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readFile(path: string): string {
  return readFileSync(path, 'utf-8').trim();
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.stderr.write(
      'Usage: moves <gsfen string>\n' +
      '       moves --file <path>\n',
    );
    process.exit(1);
  }

  let input: string;

  if (args[0] === '--file') {
    if (!args[1]) {
      process.stderr.write('--file requires a file path\n');
      process.exit(1);
    }
    input = readFile(args[1]);
  } else {
    input = args.join(' ');
  }

  // Parse + validate
  const parsed = parseGSFEN(input);
  if (!parsed.ok) {
    process.stderr.write(`Parse error: ${parsed.error.rule}: ${parsed.error.message}\n`);
    process.exit(1);
  }

  const valid = validateState(parsed.state);
  if (!valid.ok) {
    process.stderr.write(`Validation error: ${valid.error.rule}: ${valid.error.message}\n`);
    process.exit(1);
  }

  const state = parsed.state;

  // Create Game and enumerate legal actions
  const game = Game.fromState(state);

  // ── Display position ──────────────────────────────────────────
  console.log('Position:');
  printBoard(state);
  printHands(state);
  printTurn(state);
  console.log('');

  // ── Enumerate legal actions ───────────────────────────────────
  const actions = game.legalActions;

  if (actions.length === 0) {
    console.log('No legal actions.');
    process.exit(0);
  }

  const placements = actions.filter((a) => a.kind === 'placement');
  const moves = actions.filter((a) => a.kind === 'move');
  const aratas = actions.filter((a) => a.kind === 'arata');
  const dones = actions.filter((a) => a.kind === 'done');

  if (placements.length > 0) {
    console.log(`Placements (${placements.length}):`);
    for (const a of placements) {
      const desc = describeAction(a, state);
      const gan = ganString(a);
      console.log(`  ${gan.padEnd(12)}  ${desc}`);
    }
    console.log('');
  }

  if (moves.length > 0) {
    console.log(`Moves (${moves.length}):`);
    for (const a of moves) {
      const desc = describeAction(a, state);
      const gan = ganString(a);
      console.log(`  ${gan.padEnd(16)}  ${desc}`);
    }
    console.log('');
  }

  if (aratas.length > 0) {
    console.log(`Aratas (${aratas.length}):`);
    for (const a of aratas) {
      const desc = describeAction(a, state);
      const gan = ganString(a);
      console.log(`  ${gan.padEnd(12)}  ${desc}`);
    }
    console.log('');
  }

  if (dones.length > 0) {
    console.log(`Done (${dones.length}):`);
    for (const a of dones) {
      const desc = describeAction(a, state);
      const gan = ganString(a);
      console.log(`  ${gan.padEnd(12)}  ${desc}`);
    }
    console.log('');
  }

  console.log(`Total: ${actions.length} legal action${actions.length !== 1 ? 's' : ''}.`);
}

main();
