import { describe, it, expect } from 'vitest';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(__dirname, '..', '..', '..', 'gsfen', `${name}.gsfen`), 'utf-8').trim();
}

function parseOk(gsfen: string) {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state;
}

function assertValid(result: ReturnType<typeof validateState>): void {
  if (!result.ok) {
    // Show the rule and message directly in the test failure output
    expect(`${result.error.rule}: ${result.error.message}`).toBe(undefined);
  }
}

describe('board-to-test verification', () => {
  // --- board-to-test: both-marshals-placed-valid ---
  it('both-marshals-placed-valid', () => {
    const state = parseOk(readFixture('both-marshals-placed'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 3,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: all-on-board-valid ---
  it('all-on-board-valid', () => {
    const state = parseOk(readFixture('all-on-board'));

    // Board position
    // Row 1, Col 9
    expect(state.position[0][8]).toEqual([
      { type: 'A', owner: 'black' },
      { type: 'C', owner: 'black' },
    ]);
    // Row 1, Col 8
    expect(state.position[0][7]).toEqual([
      { type: 'E', owner: 'black' },
      { type: 'F', owner: 'black' },
    ]);
    // Row 1, Col 7
    expect(state.position[0][6]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 1, Col 6
    expect(state.position[0][5]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]);
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    // Row 2, Col 9
    expect(state.position[1][8]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 2, Col 8
    expect(state.position[1][7]).toEqual([{ type: 'E', owner: 'black' }]);
    // Row 2, Col 7
    expect(state.position[1][6]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 2, Col 6
    expect(state.position[1][5]).toEqual([{ type: 'J', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'L', owner: 'black' }]);
    // Row 2, Col 4
    expect(state.position[1][3]).toEqual([{ type: 'N', owner: 'black' }]);
    // Row 2, Col 3
    expect(state.position[1][2]).toEqual([{ type: 'P', owner: 'black' }]);
    // Row 2, Col 2
    expect(state.position[1][1]).toEqual([{ type: 'S', owner: 'black' }]);
    // Row 2, Col 1
    expect(state.position[1][0]).toEqual([{ type: 'U', owner: 'black' }]);
    // Row 3, Col 9
    expect(state.position[2][8]).toEqual([{ type: 'E', owner: 'black' }]);
    // Row 3, Col 8
    expect(state.position[2][7]).toEqual([{ type: 'J', owner: 'black' }]);
    // Row 3, Col 7
    expect(state.position[2][6]).toEqual([{ type: 'P', owner: 'black' }]);
    // Row 3, Col 6
    expect(state.position[2][5]).toEqual([
      { type: 'Y', owner: 'black' },
      { type: 'Y', owner: 'black' },
    ]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([{ type: 'P', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([{ type: 'F', owner: 'black' }]);
    // Row 7, Col 9
    expect(state.position[6][8]).toEqual([{ type: 'E', owner: 'white' }]);
    // Row 7, Col 8
    expect(state.position[6][7]).toEqual([{ type: 'J', owner: 'white' }]);
    // Row 7, Col 7
    expect(state.position[6][6]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 7, Col 6
    expect(state.position[6][5]).toEqual([
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 7, Col 4
    expect(state.position[6][3]).toEqual([{ type: 'F', owner: 'white' }]);
    // Row 8, Col 9
    expect(state.position[7][8]).toEqual([{ type: 'A', owner: 'white' }]);
    // Row 8, Col 8
    expect(state.position[7][7]).toEqual([{ type: 'E', owner: 'white' }]);
    // Row 8, Col 7
    expect(state.position[7][6]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 8, Col 6
    expect(state.position[7][5]).toEqual([{ type: 'J', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'L', owner: 'white' }]);
    // Row 8, Col 4
    expect(state.position[7][3]).toEqual([{ type: 'N', owner: 'white' }]);
    // Row 8, Col 3
    expect(state.position[7][2]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 8, Col 2
    expect(state.position[7][1]).toEqual([{ type: 'S', owner: 'white' }]);
    // Row 8, Col 1
    expect(state.position[7][0]).toEqual([{ type: 'U', owner: 'white' }]);
    // Row 9, Col 9
    expect(state.position[8][8]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    // Row 9, Col 8
    expect(state.position[8][7]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'F', owner: 'white' },
    ]);
    // Row 9, Col 7
    expect(state.position[8][6]).toEqual([{ type: 'M', owner: 'white' }]);
    // Row 9, Col 6
    expect(state.position[8][5]).toEqual([
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);

    expect(state.hands.white).toEqual({
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
    expect(state.hands.black).toEqual({
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

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: battle-midgame ---
  it('battle-midgame', () => {
    const state = parseOk(readFixture('battle-midgame'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([{ type: 'S', owner: 'black' }]);
    // Row 5, Col 5
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([{ type: 'A', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 0,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 0,
      T: 0,
      U: 1,
      Y: 1,
    });
    expect(state.hands.black).toEqual({
      A: 1,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 0,
      T: 1,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 14,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: battle-start ---
  it('battle-start', () => {
    const state = parseOk(readFixture('battle-start'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    // Row 7, Col 4
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: black-done-declared ---
  it('black-done-declared', () => {
    const state = parseOk(readFixture('black-done-declared'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 5,
      done: 'black',
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: capture-aftermath ---
  it('capture-aftermath', () => {
    const state = parseOk(readFixture('capture-aftermath'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 5, Col 5
    expect(state.position[4][4]).toEqual([{ type: 'N', owner: 'white' }]);
    // Row 6, Col 5
    expect(state.position[5][4]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'Y', owner: 'white' },
    ]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 1,
      L: 1,
      M: 0,
      N: 1,
      P: 2,
      S: 2,
      T: 1,
      U: 1,
      Y: 1,
    });
    expect(state.hands.black).toEqual({
      A: 0,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 1,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 22,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: dense-engagement ---
  it('dense-engagement', () => {
    const state = parseOk(readFixture('dense-engagement'));

    // Board position
    // Row 1, Col 7
    expect(state.position[0][6]).toEqual([{ type: 'P', owner: 'black' }]);
    // Row 1, Col 3
    expect(state.position[0][2]).toEqual([{ type: 'E', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    // Row 3, Col 7
    expect(state.position[2][6]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 3, Col 3
    expect(state.position[2][2]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 5, Col 7
    expect(state.position[4][6]).toEqual([
      { type: 'Y', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    // Row 5, Col 3
    expect(state.position[4][2]).toEqual([{ type: 'F', owner: 'white' }]);
    // Row 6, Col 5
    expect(state.position[5][4]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 7, Col 6
    expect(state.position[6][5]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    // Row 7, Col 3
    expect(state.position[6][2]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
    ]);
    // Row 8, Col 7
    expect(state.position[7][6]).toEqual([{ type: 'S', owner: 'black' }]);
    // Row 8, Col 4
    expect(state.position[7][3]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 8, Col 3
    expect(state.position[7][2]).toEqual([{ type: 'S', owner: 'black' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 1,
      C: 1,
      E: 2,
      F: 0,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 0,
      P: 0,
      S: 1,
      T: 1,
      U: 0,
      Y: 1,
    });
    expect(state.hands.black).toEqual({
      A: 0,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 1,
      L: 1,
      M: 0,
      N: 1,
      P: 1,
      S: 0,
      T: 0,
      U: 0,
      Y: 0,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 45,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: deploy-near-end ---
  it('deploy-near-end', () => {
    const state = parseOk(readFixture('deploy-near-end'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'S', owner: 'black' },
    ]);
    // Row 7, Col 4
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 1,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 1,
      T: 1,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 12,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: deploy-stacks-in-zones ---
  it('deploy-stacks-in-zones', () => {
    const state = parseOk(readFixture('deploy-stacks-in-zones'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
    ]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 1,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 1,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 9,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: some-captured ---
  it('some-captured', () => {
    const state = parseOk(readFixture('some-captured'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    // Row 5, Col 5
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 7, Col 9
    expect(state.position[6][8]).toEqual([{ type: 'A', owner: 'white' }]);
    // Row 7, Col 4
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 0,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 0,
      S: 2,
      T: 0,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 3,
      S: 1,
      T: 1,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 20,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: sparse-board ---
  it('sparse-board', () => {
    const state = parseOk(readFixture('sparse-board'));

    // Board position
    // Row 1, Col 4
    expect(state.position[0][3]).toEqual([
      { type: 'E', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 2,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 1,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 1,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 35,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: startpos ---
  it('startpos', () => {
    const state = parseOk(readFixture('startpos'));

    // Board position

    expect(state.hands.white).toEqual({
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
    });
    expect(state.hands.black).toEqual({
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
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: three-deep-stacks ---
  it('three-deep-stacks', () => {
    const state = parseOk(readFixture('three-deep-stacks'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    // Row 5, Col 5
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 1,
      S: 1,
      T: 0,
      U: 1,
      Y: 1,
    });
    expect(state.hands.black).toEqual({
      A: 1,
      C: 1,
      E: 2,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 2,
      T: 0,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 18,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: white-done-declared ---
  it('white-done-declared', () => {
    const state = parseOk(readFixture('white-done-declared'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    // Row 7, Col 4
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 6,
      done: 'white',
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: white-marshal-at-5-9 ---
  it('white-marshal-at-5-9', () => {
    const state = parseOk(readFixture('white-marshal-at-5-9'));

    // Board position
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
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
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 2,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: triple-stack-battlefield ---
  it('triple-stack-battlefield', () => {
    const state = parseOk(readFixture('triple-stack-battlefield'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([
      { type: 'P', owner: 'black' },
      { type: 'Y', owner: 'white' },
      { type: 'N', owner: 'black' },
    ]);
    // Row 4, Col 7
    expect(state.position[3][6]).toEqual([{ type: 'E', owner: 'white' }]);
    // Row 4, Col 3
    expect(state.position[3][2]).toEqual([{ type: 'E', owner: 'black' }]);
    // Row 6, Col 7
    expect(state.position[5][6]).toEqual([{ type: 'F', owner: 'black' }]);
    // Row 6, Col 3
    expect(state.position[5][2]).toEqual([{ type: 'F', owner: 'white' }]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'N', owner: 'white' },
    ]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 1,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 3,
      S: 1,
      T: 0,
      U: 1,
      Y: 1,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 2,
      F: 1,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 1,
      P: 3,
      S: 1,
      T: 0,
      U: 1,
      Y: 1,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 30,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: deep-capture-exchange ---
  it('deep-capture-exchange', () => {
    const state = parseOk(readFixture('deep-capture-exchange'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 4, Col 5
    expect(state.position[3][4]).toEqual([{ type: 'N', owner: 'black' }]);
    // Row 5, Col 5
    expect(state.position[4][4]).toEqual([{ type: 'A', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 0,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 3,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 2,
      L: 1,
      M: 0,
      N: 0,
      P: 4,
      S: 1,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 40,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: one-side-fully-deployed ---
  it('one-side-fully-deployed', () => {
    const state = parseOk(readFixture('one-side-fully-deployed'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 8, Col 9
    expect(state.position[7][8]).toEqual([
      { type: 'N', owner: 'white' },
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 8, Col 8
    expect(state.position[7][7]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 8, Col 7
    expect(state.position[7][6]).toEqual([
      { type: 'S', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 8, Col 6
    expect(state.position[7][5]).toEqual([
      { type: 'U', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    // Row 9, Col 4
    expect(state.position[8][3]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    // Row 9, Col 3
    expect(state.position[8][2]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'E', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    // Row 9, Col 2
    expect(state.position[8][1]).toEqual([
      { type: 'F', owner: 'white' },
      { type: 'F', owner: 'white' },
      { type: 'G', owner: 'white' },
    ]);
    // Row 9, Col 1
    expect(state.position[8][0]).toEqual([
      { type: 'J', owner: 'white' },
      { type: 'J', owner: 'white' },
      { type: 'L', owner: 'white' },
    ]);

    expect(state.hands.white).toEqual({
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
    expect(state.hands.black).toEqual({
      A: 2,
      C: 1,
      E: 3,
      F: 2,
      G: 1,
      J: 2,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 2,
      T: 1,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 3,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: empty-hands-endgame ---
  it('empty-hands-endgame', () => {
    const state = parseOk(readFixture('empty-hands-endgame'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 1, Col 4
    expect(state.position[0][3]).toEqual([
      { type: 'A', owner: 'black' },
      { type: 'C', owner: 'black' },
      { type: 'E', owner: 'black' },
    ]);
    // Row 1, Col 3
    expect(state.position[0][2]).toEqual([
      { type: 'F', owner: 'black' },
      { type: 'F', owner: 'black' },
      { type: 'J', owner: 'black' },
    ]);
    // Row 1, Col 2
    expect(state.position[0][1]).toEqual([
      { type: 'J', owner: 'black' },
      { type: 'L', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    // Row 1, Col 1
    expect(state.position[0][0]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'U', owner: 'black' },
    ]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([
      { type: 'Y', owner: 'black' },
      { type: 'Y', owner: 'black' },
    ]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    // Row 9, Col 4
    expect(state.position[8][3]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    // Row 9, Col 3
    expect(state.position[8][2]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'F', owner: 'white' },
      { type: 'J', owner: 'white' },
    ]);
    // Row 9, Col 2
    expect(state.position[8][1]).toEqual([
      { type: 'L', owner: 'white' },
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    // Row 9, Col 1
    expect(state.position[8][0]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);

    expect(state.hands.white).toEqual({
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
    expect(state.hands.black).toEqual({
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

    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 60,
      done: null,
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });

  // --- board-to-test: white-done-multi-count-hand ---
  it('white-done-multi-count-hand', () => {
    const state = parseOk(readFixture('white-done-multi-count-hand'));

    // Board position
    // Row 1, Col 5
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    // Row 1, Col 4
    expect(state.position[0][3]).toEqual([{ type: 'G', owner: 'black' }]);
    // Row 1, Col 3
    expect(state.position[0][2]).toEqual([{ type: 'E', owner: 'black' }]);
    // Row 2, Col 5
    expect(state.position[1][4]).toEqual([{ type: 'S', owner: 'black' }]);
    // Row 2, Col 4
    expect(state.position[1][3]).toEqual([{ type: 'T', owner: 'black' }]);
    // Row 3, Col 5
    expect(state.position[2][4]).toEqual([{ type: 'A', owner: 'black' }]);
    // Row 3, Col 4
    expect(state.position[2][3]).toEqual([{ type: 'C', owner: 'black' }]);
    // Row 7, Col 5
    expect(state.position[6][4]).toEqual([{ type: 'A', owner: 'white' }]);
    // Row 8, Col 5
    expect(state.position[7][4]).toEqual([{ type: 'S', owner: 'white' }]);
    // Row 8, Col 4
    expect(state.position[7][3]).toEqual([{ type: 'T', owner: 'white' }]);
    // Row 9, Col 5
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    // Row 9, Col 4
    expect(state.position[8][3]).toEqual([{ type: 'G', owner: 'white' }]);

    expect(state.hands.white).toEqual({
      A: 1,
      C: 1,
      E: 3,
      F: 2,
      G: 0,
      J: 1,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 1,
      T: 0,
      U: 1,
      Y: 2,
    });
    expect(state.hands.black).toEqual({
      A: 1,
      C: 0,
      E: 2,
      F: 2,
      G: 0,
      J: 1,
      L: 1,
      M: 0,
      N: 2,
      P: 4,
      S: 1,
      T: 0,
      U: 1,
      Y: 2,
    });

    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 13,
      done: 'white',
    });

    // Semantic validation
    const vResult = validateState(state);
    assertValid(vResult);
  });
});
