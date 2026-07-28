#!/usr/bin/env node

/**
 * GSFEN CLI — validate and visualize GSFEN strings.
 *
 * Usage:
 *   gsfen check "<string>"
 *   gsfen check --file <path>
 *   gsfen show "<string>"
 *   gsfen show --file <path>
 */

import { parseGSFEN } from '../src/gsfen/parse.js';
import { validateState } from '../src/gsfen/validate.js';
import { readFileSync } from 'node:fs';
import type { GameState, Position, PieceType } from '../src/types.js';
import { ALL_PIECE_TYPES } from '../src/constants.js';

// ---------------------------------------------------------------------------
// Display helpers
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
    // Columns 9→1 in standard diagram order, which is col index 8→0
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
  console.log(`Turn: ${phase}  active: ${activePlayer}  counter: ${counter}  Done: ${done || 'none'}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdCheck(input: string): void {
  const parsed = parseGSFEN(input);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error.rule}: ${parsed.error.message}\n`);
    process.exit(1);
  }
  const valid = validateState(parsed.state);
  if (!valid.ok) {
    process.stderr.write(`${valid.error.rule}: ${valid.error.message}\n`);
    process.exit(1);
  }
  console.log('OK');
}

function cmdShow(input: string): void {
  const parsed = parseGSFEN(input);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error.rule}: ${parsed.error.message}\n`);
    process.exit(1);
  }
  const state = parsed.state;
  printBoard(state);
  printHands(state);
  printTurn(state);
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8').trim();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.stderr.write(
      'Usage: gsfen check <string>\n' +
        '       gsfen check --file <path>\n' +
        '       gsfen show <string>\n' +
        '       gsfen show --file <path>\n',
    );
    process.exit(1);
  }

  const subcommand = args[0];

  if (subcommand === 'check') {
    if (args[1] === '--file') {
      if (!args[2]) {
        process.stderr.write('--file requires a file path\n');
        process.exit(1);
      }
      cmdCheck(readFile(args[2]));
    } else {
      cmdCheck(args.slice(1).join(' '));
    }
  } else if (subcommand === 'show') {
    if (args[1] === '--file') {
      if (!args[2]) {
        process.stderr.write('--file requires a file path\n');
        process.exit(1);
      }
      cmdShow(readFile(args[2]));
    } else {
      cmdShow(args.slice(1).join(' '));
    }
  } else {
    process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
    process.exit(1);
  }
}

main();
