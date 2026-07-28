#!/usr/bin/env node
/**
 * PROTOTYPE — board-to-test.mjs
 *
 * Reads a .state.txt (visual board) + .gsfen pair and outputs ready-to-paste
 * test code.  The answer it prototypes: "Can we quickly convert a described
 * board state into a reliable test?"
 *
 * Usage:  node prototype/board-to-test.mjs <name>
 *
 * Expects:
 *   ../fixtures/<name>.gsfen        — the GSFEN string (single line or file)
 *   ../../gsfen/<name>.state.txt    — visual description (see below)
 *
 * Visual format (.state.txt):
 *
 *   == Board ==
 *       9  8  7  6  5  4  3  2  1
 *    1  .  .  .  .  .  .  .  .  .
 *    2  .  .  .  .  M  .  .  .  .
 *    ...
 *    9  .  .  .  .  .  .  .  .  .
 *
 *   UPPERCASE = White piece, lowercase = Black piece.
 *   Stacks use / separator (bottom first):  P/M
 *   Empty cell = .
 *
 *   == Hands ==
 *   white: A2 C1 E3 F2 G1 J2 L1 M1 N2 P4 S2 T1 U1 Y2
 *   black: A2 C1 E3 F2 G1 J2 L1 M1 N2 P4 S2 T1 U1 Y2
 *
 *   == Turn ==
 *   phase: deploy  active: white  counter: 1  done: none
 *
 *   == Name ==
 *   optional-test-name  (defaults to <name> if omitted)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PIECE_TYPES = ['A', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'Y'];

function isPieceChar(ch) {
  return PIECE_TYPES.includes(ch.toUpperCase());
}

/** Parse a cell token into an array of { type, owner } objects. */
function parseCell(token) {
  if (token === '.' || token === '..' || token === '' || !token) return null;
  const chars = token.split('/');
  const stack = [];
  for (const ch of chars) {
    const upper = ch.toUpperCase();
    if (!PIECE_TYPES.includes(upper)) return null;
    const owner = ch === upper ? 'white' : 'black';
    stack.push({ type: upper, owner });
  }
  return stack;
}

/** Render a stack as an expect(...).toEqual(...) assertion. */
function renderStackAssertion(stack, rowVis, colVis, ci) {
  if (!stack || stack.length === 0) return '';
  const pieces = stack.map((p) => `{ type: '${p.type}', owner: '${p.owner}' }`).join(', ');
  const posCol = 8 - ci;
  return `    // Row ${rowVis}, Col ${colVis}\n    expect(state.position[${rowVis - 1}][${posCol}]).toEqual([${pieces}]);`;
}

/** Render a hands object into an expect(...).toEqual(...) assertion */
function renderHandsAssertion(label, hands) {
  const kvs = PIECE_TYPES.map((t) => `${t}: ${hands[t] ?? 0}`).join(', ');
  return `    expect(state.hands.${label}).toEqual({ ${kvs} });`;
}

// ---------------------------------------------------------------------------
// Parse .state.txt
// ---------------------------------------------------------------------------

function parseStateFile(text) {
  const lines = text.split('\n').map((l) => l.trimEnd());

  let boardRows = []; // array of { rowVis, cells[] }
  let handsWhite = null;
  let handsBlack = null;
  let turn = {};
  let testName = null;
  let currentSection = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;

    // Section header
    const secMatch = line.match(/^==+\s*(.+?)\s*==+$/);
    if (secMatch) {
      currentSection = secMatch[1].toLowerCase();
      continue;
    }

    if (currentSection === 'board') {
      // Row or header line: starts with optional spaces then a number
      const rowMatch = raw.match(/^\s*(\d+)\s+(.+)/);
      if (rowMatch) {
        const rowVis = parseInt(rowMatch[1], 10);
        // 1–9 = board row; anything else (e.g. the column-header line "9 8 7...") is skipped
        if (rowVis < 1 || rowVis > 9) continue;
        const tokens = rowMatch[2].trim().split(/\s+/);
        boardRows.push({ rowVis, tokens });
      }
    } else if (currentSection === 'hands') {
      const wMatch = line.match(/^white:\s*(.+)/i);
      if (wMatch) {
        handsWhite = {};
        for (const tok of wMatch[1].trim().split(/\s+/)) {
          const m = tok.match(/^([A-Z])(\d+)$/);
          if (m) handsWhite[m[1]] = parseInt(m[2], 10);
        }
      }
      const bMatch = line.match(/^black:\s*(.+)/i);
      if (bMatch) {
        handsBlack = {};
        for (const tok of bMatch[1].trim().split(/\s+/)) {
          const m = tok.match(/^([A-Z])(\d+)$/);
          if (m) handsBlack[m[1]] = parseInt(m[2], 10);
        }
      }
    } else if (currentSection === 'turn') {
      const parts = line.split(/\s{2,}|\s+(?=\w+:)/);
      for (const part of parts) {
        const kv = part.match(/^(\w+):\s*(.+)/);
        if (kv) turn[kv[1]] = kv[2];
      }
    } else if (currentSection === 'name') {
      testName = line;
    }
  }

  return { boardRows, handsWhite, handsBlack, turn, testName };
}

// ---------------------------------------------------------------------------
// Generate test code
// ---------------------------------------------------------------------------

function generateTestCode(name, parsed, gsfen) {
  const { boardRows, handsWhite, handsBlack, turn, testName } = parsed;
  const tName = testName || name;

  const out = [];
  out.push('');
  out.push(`  // --- board-to-test: ${tName} ---`);
  out.push(`  it('${tName}', () => {`);
  out.push(`    const state = parseOk(readFixture('${name}'));`);
  out.push('');

  // Board position assertions
  if (boardRows.length > 0) {
    out.push('    // Board position');
    // Sort by visual row (1-9)
    boardRows.sort((a, b) => a.rowVis - b.rowVis);
    for (const { rowVis, tokens } of boardRows) {
      for (let ci = 0; ci < tokens.length; ci++) {
        const token = tokens[ci];
        const stack = parseCell(token);
        if (stack && stack.length > 0) {
          const visualCol = 9 - ci; // ci=0 → col 9, ci=8 → col 1
          out.push(renderStackAssertion(stack, rowVis, visualCol, ci));
        }
      }
    }
    out.push('');
  }

  // Hands assertions
  if (handsWhite) {
    out.push(renderHandsAssertion('white', handsWhite));
  }
  if (handsBlack) {
    out.push(renderHandsAssertion('black', handsBlack));
  }
  if (handsWhite || handsBlack) out.push('');

  // Turn assertions
  if (turn.phase || turn.active || turn.counter || turn.done !== undefined) {
    const props = [];
    if (turn.phase) props.push(`phase: '${turn.phase}'`);
    if (turn.active) props.push(`activePlayer: '${turn.active}'`);
    if (turn.counter) props.push(`counter: ${turn.counter}`);
    if (turn.done !== undefined) {
      props.push(`done: ${turn.done === 'none' ? 'null' : `'${turn.done}'`}`);
    }
    out.push(`    expect(state.turn).toMatchObject({ ${props.join(', ')} });`);
    out.push('');
  }

  // Validation check
  out.push('    // Semantic validation');
  out.push('    const vResult = validateState(state);');
  out.push('    assertValid(vResult);');
  out.push('  });');
  out.push('');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: node prototype/board-to-test.mjs <name>');
    console.error('  Reads ../fixtures/<name>.gsfen  +  ../../gsfen/<name>.state.txt');
    console.error('  Outputs test code to stdout.');
    process.exit(1);
  }

  const fixtureDir = join(__dirname, '..', 'fixtures');
  const stateFile = join(__dirname, '..', '..', 'gsfen', `${name}.state.txt`);
  const gsfenFile = join(fixtureDir, `${name}.gsfen`);

  if (!existsSync(stateFile)) {
    console.error(`Missing: ${stateFile}`);
    process.exit(1);
  }
  if (!existsSync(gsfenFile)) {
    console.error(`Missing: ${gsfenFile}`);
    process.exit(1);
  }

  const stateText = readFileSync(stateFile, 'utf-8');
  const gsfen = readFileSync(gsfenFile, 'utf-8').trim();

  const parsed = parseStateFile(stateText);
  const testCode = generateTestCode(name, parsed, gsfen);

  process.stdout.write(testCode);
}

main();
