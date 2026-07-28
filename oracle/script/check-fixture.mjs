import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGSFEN } from '../src/gsfen/parse.js';
import { validateState } from '../src/gsfen/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) { console.error('Usage: check-fixture.mjs <fixture-name>'); process.exit(1); }

const raw = readFileSync(resolve(__dirname, '../fixtures', `${name}.gsfen`), 'utf-8').trim();
console.log('Content:', JSON.stringify(raw));
console.log('Length:', raw.length);
const p = parseGSFEN(raw);
console.log('Parse OK:', p.ok);
if (!p.ok) {
  console.log('Error:', p.error.rule, p.error.message);
  process.exit(0);
}
const s = p.state;
console.log('Turn:', JSON.stringify(s.turn));
console.log('White hands M:', s.hands.white.M, 'Black hands M:', s.hands.black.M);
// Check white M on board
for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const st = s.position[r][c];
    if (st && st.length > 0) {
      const top = st[st.length - 1];
      if (top.type === 'M') console.log(`M at position[${r}][${c}], owner: ${top.owner}`);
    }
  }
}
const v = validateState(s);
console.log('Validate OK:', v.ok);
if (!v.ok) console.log('Validate error:', v.error.rule, v.error.message);
