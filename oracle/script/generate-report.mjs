/**
 * Generate fixtures/report.html from all .gsfen fixture files.
 * Reads from `fixtures/valid/` and `fixtures/invalid/` (recursively).
 * Exits non-zero when a fixture behaves contrary to its directory:
 * a valid/ fixture that fails validation, or an invalid/ fixture that passes.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGSFEN } from '../src/gsfen/parse.js';
import { validateState } from '../src/gsfen/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../fixtures');

/** Recursively collect .gsfen files under `dir`, returned as paths relative to FIXTURE_DIR. */
function collectGsfenFiles(dir) {
  const full = resolve(FIXTURE_DIR, dir);
  if (!existsSync(full)) return [];
  const files = [];
  for (const entry of readdirSync(full, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectGsfenFiles(rel));
    } else if (entry.name.endsWith('.gsfen')) {
      files.push(rel);
    }
  }
  return files;
}

function readFixture(relPath) {
  return readFileSync(resolve(FIXTURE_DIR, relPath), 'utf-8').trim();
}

function renderBoardAscii(position) {
  const rows = [];
  for (let r = 0; r < 9; r++) {
    const cells = [];
    for (let c = 0; c < 9; c++) {
      const stack = position[r][c];
      if (!stack || stack.length === 0) {
        cells.push(' .');
      } else {
        const top = stack[stack.length - 1];
        const ch = top.owner === 'white' ? top.type.toUpperCase() : top.type.toLowerCase();
        if (stack.length > 1) {
          const s = stack.map(p => p.owner === 'white' ? p.type.toUpperCase() : p.type.toLowerCase()).join('');
          cells.push(s.padStart(4).slice(-4));
        } else {
          cells.push(` ${ch}`);
        }
      }
    }
    const line = cells.map(c => c.padStart(4)).join('');
    rows.push(`${r + 1} ${line}`);
  }
  return `    9   8   7   6   5   4   3   2   1\n${rows.join('\n')}`;
}

function formatHand(hand) {
  const ORDER = ['A','C','E','F','G','J','L','M','N','P','S','T','U','Y'];
  const parts = [];
  for (const t of ORDER) {
    const c = hand[t] || 0;
    if (c > 0) parts.push(c > 1 ? `${c}${t}` : t);
  }
  return parts.length === 0 ? 'empty' : parts.join(' ');
}

function fixtureHTML(name, raw) {
  const isStartpos = raw === 'startpos';

  let errMsg = null;
  let state = null;

  if (!isStartpos) {
    const parseResult = parseGSFEN(raw);
    if (parseResult.ok) {
      state = parseResult.state;
      const valResult = validateState(state);
      if (!valResult.ok) {
        errMsg = `${valResult.error.rule}: ${valResult.error.message}`;
      }
    } else {
      errMsg = `${parseResult.error.rule}: ${parseResult.error.message}`;
    }
  } else {
    const parseResult = parseGSFEN(raw);
    if (parseResult.ok) state = parseResult.state;
    else errMsg = `${parseResult.error.rule}: ${parseResult.error.message}`;
  }

  const statusClass = errMsg ? 'invalid' : 'valid';
  const statusLabel = errMsg ? 'INVALID' : 'VALID';

  let boardHtml = '';
  let handsTurnHtml = '';

  if (state) {
    boardHtml = renderBoardAscii(state.position);
    const wh = formatHand(state.hands.white);
    const bh = formatHand(state.hands.black).toLowerCase();
    const phase = state.turn.phase;
    const active = state.turn.activePlayer;
    const ctr = state.turn.counter;
    const done = state.turn.done || 'none';
    handsTurnHtml = `white: ${wh}  |  black: ${bh}  |  ${phase}  ${active}  ctr:${ctr}  Done: ${done}`;
  } else {
    boardHtml = '(parse failed)';
    handsTurnHtml = '(parse failed)';
  }

  return {
    valid: !errMsg,
    html: `
  <div class="fixture">
    <div class="fixture-header" onclick="toggle(this)">
      <span class="fixture-name">${name}</span>
      <span class="fixture-status ${statusClass}">${statusLabel}</span>
    </div>
    <div class="fixture-body">
      <h3>GSFEN</h3>
      <div class="gsfen-string">${raw}</div>
      <h3>Board</h3>
      <div class="board">${boardHtml}</div>
      <h3>Hands / Turn</h3>
      <div class="hands-turn">${handsTurnHtml}</div>
      ${errMsg ? `<h3>Validation Error</h3><div class="error-box">${errMsg}</div>` : ''}
    </div>
  </div>`,
  };
}

// Scan directories (recursively) for .gsfen files.
const validFiles = collectGsfenFiles('valid');
const invalidFiles = collectGsfenFiles('invalid');

const validResults = validFiles.map((rel) => ({
  name: rel.replace(/\.gsfen$/, ''),
  rel,
  ...fixtureHTML(rel.replace(/\.gsfen$/, ''), readFixture(rel)),
}));
const invalidResults = invalidFiles.map((rel) => ({
  name: rel.replace(/\.gsfen$/, ''),
  rel,
  ...fixtureHTML(rel.replace(/\.gsfen$/, ''), readFixture(rel)),
}));

const validCount = validResults.length;
const validPass = validResults.filter((r) => r.valid).length;
const validFail = validCount - validPass;

const invalidCount = invalidResults.length;
const invalidFail = invalidResults.filter((r) => !r.valid).length;
const invalidPass = invalidCount - invalidFail;

let validHTML = '';
for (const r of validResults) validHTML += r.html;

let invalidHTML = '';
for (const r of invalidResults) invalidHTML += r.html;

// Honest exit code: a fixture that contradicts its directory is a regression
// (broken fixture or broken validation) and must fail the report run.
if (validFail > 0) {
  process.stderr.write(
    `ERROR: ${validFail}/${validCount} fixture(s) in valid/ failed validation: ` +
      validResults.filter((r) => !r.valid).map((r) => r.name).join(', ') + '\n',
  );
}
if (invalidPass > 0) {
  process.stderr.write(
    `ERROR: ${invalidPass}/${invalidCount} fixture(s) in invalid/ passed validation: ` +
      invalidResults.filter((r) => r.valid).map((r) => r.name).join(', ') + '\n',
  );
}
if (validFail > 0 || invalidPass > 0) {
  process.exitCode = 1;
}

const totalCount = validCount + invalidCount;
// Pass/Fail cards count validation results across ALL fixtures, so the
// numbers sum to the total. Directory-contradicting fixtures are still
// reported on stderr and fail the run via process.exitCode above.
const totalValid = validPass + invalidPass;
const totalInvalid = totalCount - totalValid;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GSFEN Fixture Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #222; padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
  .subtitle { color: #666; margin-bottom: 1.5rem; }
  .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .summary-card { background: #fff; border-radius: 8px; padding: 1rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; min-width: 120px; }
  .summary-card .num { font-size: 2rem; font-weight: 700; }
  .summary-card .label { font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-card.total .num { color: #2563eb; }
  .summary-card.valid .num { color: #16a34a; }
  .summary-card.invalid .num { color: #dc2626; }
  .fixture { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; overflow: hidden; }
  .fixture-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #fafafa; border-bottom: 1px solid #eee; cursor: pointer; user-select: none; }
  .fixture-header:hover { background: #f0f0f0; }
  .fixture-name { font-weight: 600; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 1.1rem; }
  .fixture-status { font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; }
  .fixture-status.valid { background: #dcfce7; color: #166534; }
  .fixture-status.invalid { background: #fecaca; color: #991b1b; }
  .fixture-body { padding: 1rem; display: none; }
  .fixture-body.open { display: block; }
  .fixture-body h3 { font-size: 0.9rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; margin-top: 1rem; }
  .fixture-body h3:first-child { margin-top: 0; }
  .gsfen-string { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; background: #f8f8f8; padding: 0.75rem; border-radius: 4px; word-break: break-all; border: 1px solid #e5e5e5; }
  .board { font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; font-size: 0.8rem; line-height: 1.5; background: #f8f8f8; padding: 0.75rem; border-radius: 4px; border: 1px solid #e5e5e5; white-space: pre; overflow-x: auto; }
  .error-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem; border-radius: 4px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; }
  .hands-turn { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; background: #f8f8f8; padding: 0.75rem; border-radius: 4px; border: 1px solid #e5e5e5; }
  .expand-all { background: #2563eb; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; }
  .expand-all:hover { background: #1d4ed8; }
  .empty-state { background: #fff; border-radius: 8px; padding: 2rem; text-align: center; color: #666; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .loc { display: inline-block; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 3px; margin-left: 0.5rem; }
  .loc.valid-dir { background: #dcfce7; color: #166534; }
  .loc.invalid-dir { background: #fecaca; color: #991b1b; }
</style>
</head>
<body>

<h1>GSFEN Fixture Report</h1>
<p class="subtitle">Generated from <code>oracle/fixtures/valid/</code> &amp; <code>oracle/fixtures/invalid/</code> &mdash; ${totalCount} fixtures</p>

<div class="summary">
  <div class="summary-card total">
    <div class="num">${totalCount}</div>
    <div class="label">Total Fixtures</div>
  </div>
  <div class="summary-card valid">
    <div class="num">${totalValid}</div>
    <div class="label">Pass Validation</div>
  </div>
  <div class="summary-card invalid">
    <div class="num">${totalInvalid}</div>
    <div class="label">Fail Validation</div>
  </div>
</div>

<p><button class="expand-all" onclick="toggleAll()">Expand / Collapse All</button></p>

<h2 style="margin-bottom: 1rem;">Valid Fixtures <span class="loc valid-dir">valid/</span></h2>
<div id="fixtures-valid">
${validHTML}
</div>

<h2 style="margin-top: 2rem;">Invalid Fixtures <span class="loc invalid-dir">invalid/</span></h2>

<div id="fixtures-invalid">
${invalidHTML}
</div>

<script>
function toggle(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

function toggleAll() {
  const bodies = document.querySelectorAll('.fixture-body');
  const anyClosed = Array.from(bodies).some(b => !b.classList.contains('open'));
  bodies.forEach(b => b.classList.toggle('open', anyClosed));
}
</script>

</body>
</html>`;

writeFileSync(resolve(FIXTURE_DIR, 'report.html'), html);
console.log(`Report generated: ${validCount} in valid/, ${invalidCount} in invalid/, ${totalCount} total`);
console.log(`Validate results: ${totalValid} pass, ${totalInvalid} fail`);
