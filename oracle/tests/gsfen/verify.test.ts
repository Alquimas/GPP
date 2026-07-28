import { describe, it, expect } from 'vitest';
import { parseGSFEN } from '../../src/gsfen/parse.js';
import { validateState } from '../../src/gsfen/validate.js';
import { INITIAL_COUNTS, EMPTY_HAND } from '../../src/constants.js';
import type { Hand } from '../../src/types.js';
import {
  ALL_ON_BOARD,
  BATTLE_MIDGAME,
  BATTLE_START,
  BLACK_DONE_DECLARED,
  BOTH_MARSHALS_PLACED,
  CAPTURE_AFTERMATH,
  DEEP_CAPTURE_EXCHANGE,
  DENSE_ENGAGEMENT,
  DEPLOY_NEAR_END,
  DEPLOY_STACKS_IN_ZONES,
  EMPTY_HANDS_ENDGAME,
  ONE_SIDE_FULLY_DEPLOYED,
  SOME_CAPTURED,
  SPARSE_BOARD,
  STARTPOS,
  THREE_DEEP_STACKS,
  TRIPLE_STACK_BATTLEFIELD,
  WHITE_DONE_DECLARED,
  WHITE_DONE_MULTI_COUNT_HAND,
  WHITE_MARSHAL_AT_5_9,
} from '../../src/gsfen/fixtures.js';

function parseOk(gsfen: string) {
  const result = parseGSFEN(gsfen);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.state;
}

/** Create a full Hand from initial counts with optional overrides. */
function H(overrides?: Partial<Hand>): Hand {
  return { ...INITIAL_COUNTS, ...overrides };
}

describe('board-to-test verification', () => {
  it('both-marshals-placed', () => {
    const state = parseOk(BOTH_MARSHALS_PLACED);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0 }));
    expect(state.hands.black).toEqual(H({ M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 3,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('all-on-board', () => {
    const state = parseOk(ALL_ON_BOARD);
    expect(state.position[0][8]).toEqual([
      { type: 'A', owner: 'black' },
      { type: 'C', owner: 'black' },
    ]);
    expect(state.position[0][7]).toEqual([
      { type: 'E', owner: 'black' },
      { type: 'F', owner: 'black' },
    ]);
    expect(state.position[0][6]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[0][5]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'P', owner: 'black' },
    ]);
    expect(state.position[0][4]).toEqual([
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    expect(state.position[1][8]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[1][7]).toEqual([{ type: 'E', owner: 'black' }]);
    expect(state.position[1][6]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[1][5]).toEqual([{ type: 'J', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'L', owner: 'black' }]);
    expect(state.position[1][3]).toEqual([{ type: 'N', owner: 'black' }]);
    expect(state.position[1][2]).toEqual([{ type: 'P', owner: 'black' }]);
    expect(state.position[1][1]).toEqual([{ type: 'S', owner: 'black' }]);
    expect(state.position[1][0]).toEqual([{ type: 'U', owner: 'black' }]);
    expect(state.position[2][8]).toEqual([{ type: 'E', owner: 'black' }]);
    expect(state.position[2][7]).toEqual([{ type: 'J', owner: 'black' }]);
    expect(state.position[2][6]).toEqual([{ type: 'P', owner: 'black' }]);
    expect(state.position[2][5]).toEqual([
      { type: 'Y', owner: 'black' },
      { type: 'Y', owner: 'black' },
    ]);
    expect(state.position[2][4]).toEqual([{ type: 'P', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([{ type: 'F', owner: 'black' }]);
    expect(state.position[6][8]).toEqual([{ type: 'E', owner: 'white' }]);
    expect(state.position[6][7]).toEqual([{ type: 'J', owner: 'white' }]);
    expect(state.position[6][6]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[6][5]).toEqual([
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    expect(state.position[6][4]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[6][3]).toEqual([{ type: 'F', owner: 'white' }]);
    expect(state.position[7][8]).toEqual([{ type: 'A', owner: 'white' }]);
    expect(state.position[7][7]).toEqual([{ type: 'E', owner: 'white' }]);
    expect(state.position[7][6]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[7][5]).toEqual([{ type: 'J', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'L', owner: 'white' }]);
    expect(state.position[7][3]).toEqual([{ type: 'N', owner: 'white' }]);
    expect(state.position[7][2]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[7][1]).toEqual([{ type: 'S', owner: 'white' }]);
    expect(state.position[7][0]).toEqual([{ type: 'U', owner: 'white' }]);
    expect(state.position[8][8]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    expect(state.position[8][7]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'F', owner: 'white' },
    ]);
    expect(state.position[8][6]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.position[8][5]).toEqual([
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('battle-midgame', () => {
    const state = parseOk(BATTLE_MIDGAME);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[2][4]).toEqual([{ type: 'S', owner: 'black' }]);
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[6][4]).toEqual([{ type: 'A', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, E: 2, G: 0, M: 0, P: 3, S: 0, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, G: 0, M: 0, N: 1, S: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 14,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('battle-start', () => {
    const state = parseOk(BATTLE_START);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('black-done-declared', () => {
    const state = parseOk(BLACK_DONE_DECLARED);
    expect(state.position[0][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 5,
      done: 'black',
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('capture-aftermath', () => {
    const state = parseOk(CAPTURE_AFTERMATH);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[4][4]).toEqual([{ type: 'N', owner: 'white' }]);
    expect(state.position[5][4]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'Y', owner: 'white' },
    ]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, J: 1, M: 0, N: 1, P: 2, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 0, J: 1, M: 0, N: 1, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 22,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('dense-engagement', () => {
    const state = parseOk(DENSE_ENGAGEMENT);
    expect(state.position[0][6]).toEqual([{ type: 'P', owner: 'black' }]);
    expect(state.position[0][2]).toEqual([{ type: 'E', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    expect(state.position[2][6]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[2][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[2][2]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[4][6]).toEqual([
      { type: 'Y', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    expect(state.position[4][2]).toEqual([{ type: 'F', owner: 'white' }]);
    expect(state.position[5][4]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[6][5]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    expect(state.position[6][2]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
    ]);
    expect(state.position[7][6]).toEqual([{ type: 'S', owner: 'black' }]);
    expect(state.position[7][3]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[7][2]).toEqual([{ type: 'S', owner: 'black' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(
      H({ A: 1, E: 2, F: 0, G: 0, M: 0, N: 0, P: 0, S: 1, U: 0, Y: 1 }),
    );
    expect(state.hands.black).toEqual(
      H({ A: 0, E: 2, G: 0, J: 1, M: 0, N: 1, P: 1, S: 0, T: 0, U: 0, Y: 0 }),
    );
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 45,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('deploy-near-end', () => {
    const state = parseOk(DEPLOY_NEAR_END);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'S', owner: 'black' },
    ]);
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 12,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('deploy-stacks-in-zones', () => {
    const state = parseOk(DEPLOY_STACKS_IN_ZONES);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
    ]);
    expect(state.position[2][4]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[6][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'S', owner: 'white' },
    ]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3, S: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, E: 2, G: 0, M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 9,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('some-captured', () => {
    const state = parseOk(SOME_CAPTURED);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[6][8]).toEqual([{ type: 'A', owner: 'white' }]);
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, E: 2, G: 0, M: 0, N: 1, P: 0, T: 0 }));
    expect(state.hands.black).toEqual(H({ E: 2, G: 0, M: 0, N: 1, P: 3, S: 1, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 20,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('sparse-board', () => {
    const state = parseOk(SPARSE_BOARD);
    expect(state.position[0][3]).toEqual([
      { type: 'E', owner: 'black' },
      { type: 'M', owner: 'black' },
    ]);
    expect(state.position[6][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0, N: 1, P: 2 }));
    expect(state.hands.black).toEqual(H({ E: 2, F: 1, M: 0, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 35,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('startpos', () => {
    const state = parseOk(STARTPOS);
    expect(state.hands.white).toEqual(H());
    expect(state.hands.black).toEqual(H());
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'white',
      counter: 1,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('three-deep-stacks', () => {
    const state = parseOk(THREE_DEEP_STACKS);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'E', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    expect(state.position[4][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'N', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, G: 0, M: 0, N: 1, P: 1, S: 1, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ A: 1, E: 2, G: 0, M: 0, N: 1, T: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 18,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('white-done-declared', () => {
    const state = parseOk(WHITE_DONE_DECLARED);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([{ type: 'N', owner: 'black' }]);
    expect(state.position[6][3]).toEqual([{ type: 'P', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 6,
      done: 'white',
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('white-marshal-at-5-9', () => {
    const state = parseOk(WHITE_MARSHAL_AT_5_9);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ M: 0 }));
    expect(state.hands.black).toEqual(H());
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 2,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('triple-stack-battlefield', () => {
    const state = parseOk(TRIPLE_STACK_BATTLEFIELD);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    expect(state.position[2][4]).toEqual([
      { type: 'P', owner: 'black' },
      { type: 'Y', owner: 'white' },
      { type: 'N', owner: 'black' },
    ]);
    expect(state.position[3][6]).toEqual([{ type: 'E', owner: 'white' }]);
    expect(state.position[3][2]).toEqual([{ type: 'E', owner: 'black' }]);
    expect(state.position[5][6]).toEqual([{ type: 'F', owner: 'black' }]);
    expect(state.position[5][2]).toEqual([{ type: 'F', owner: 'white' }]);
    expect(state.position[6][4]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'Y', owner: 'black' },
      { type: 'N', owner: 'white' },
    ]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ E: 2, F: 1, G: 0, M: 0, N: 1, P: 3, S: 1, T: 0, Y: 1 }));
    expect(state.hands.black).toEqual(H({ E: 2, F: 1, G: 0, M: 0, N: 1, P: 3, S: 1, T: 0, Y: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 30,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('deep-capture-exchange', () => {
    const state = parseOk(DEEP_CAPTURE_EXCHANGE);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[3][4]).toEqual([{ type: 'N', owner: 'black' }]);
    expect(state.position[4][4]).toEqual([{ type: 'A', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 0, G: 0, M: 0, P: 3 }));
    expect(state.hands.black).toEqual(H({ G: 0, M: 0, N: 0, S: 1 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 40,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('one-side-fully-deployed', () => {
    const state = parseOk(ONE_SIDE_FULLY_DEPLOYED);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[7][8]).toEqual([
      { type: 'N', owner: 'white' },
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[7][7]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[7][6]).toEqual([
      { type: 'S', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[7][5]).toEqual([
      { type: 'U', owner: 'white' },
      { type: 'Y', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.position[8][3]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
    ]);
    expect(state.position[8][2]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'E', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    expect(state.position[8][1]).toEqual([
      { type: 'F', owner: 'white' },
      { type: 'F', owner: 'white' },
      { type: 'G', owner: 'white' },
    ]);
    expect(state.position[8][0]).toEqual([
      { type: 'J', owner: 'white' },
      { type: 'J', owner: 'white' },
      { type: 'L', owner: 'white' },
    ]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(H({ M: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'black',
      counter: 3,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('empty-hands-endgame', () => {
    const state = parseOk(EMPTY_HANDS_ENDGAME);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[0][3]).toEqual([
      { type: 'A', owner: 'black' },
      { type: 'C', owner: 'black' },
      { type: 'E', owner: 'black' },
    ]);
    expect(state.position[0][2]).toEqual([
      { type: 'F', owner: 'black' },
      { type: 'F', owner: 'black' },
      { type: 'J', owner: 'black' },
    ]);
    expect(state.position[0][1]).toEqual([
      { type: 'J', owner: 'black' },
      { type: 'L', owner: 'black' },
      { type: 'N', owner: 'black' },
    ]);
    expect(state.position[0][0]).toEqual([
      { type: 'N', owner: 'black' },
      { type: 'P', owner: 'black' },
      { type: 'U', owner: 'black' },
    ]);
    expect(state.position[1][4]).toEqual([
      { type: 'G', owner: 'black' },
      { type: 'S', owner: 'black' },
      { type: 'T', owner: 'black' },
    ]);
    expect(state.position[2][4]).toEqual([
      { type: 'Y', owner: 'black' },
      { type: 'Y', owner: 'black' },
    ]);
    expect(state.position[7][4]).toEqual([
      { type: 'G', owner: 'white' },
      { type: 'S', owner: 'white' },
      { type: 'T', owner: 'white' },
    ]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.position[8][3]).toEqual([
      { type: 'A', owner: 'white' },
      { type: 'C', owner: 'white' },
      { type: 'E', owner: 'white' },
    ]);
    expect(state.position[8][2]).toEqual([
      { type: 'E', owner: 'white' },
      { type: 'F', owner: 'white' },
      { type: 'J', owner: 'white' },
    ]);
    expect(state.position[8][1]).toEqual([
      { type: 'L', owner: 'white' },
      { type: 'N', owner: 'white' },
      { type: 'P', owner: 'white' },
    ]);
    expect(state.position[8][0]).toEqual([
      { type: 'P', owner: 'white' },
      { type: 'U', owner: 'white' },
      { type: 'Y', owner: 'white' },
    ]);
    expect(state.hands.white).toEqual(EMPTY_HAND);
    expect(state.hands.black).toEqual(EMPTY_HAND);
    expect(state.turn).toMatchObject({
      phase: 'battle',
      activePlayer: 'white',
      counter: 60,
      done: null,
    });
    expect(validateState(state).ok).toBe(true);
  });

  it('white-done-multi-count-hand', () => {
    const state = parseOk(WHITE_DONE_MULTI_COUNT_HAND);
    expect(state.position[0][4]).toEqual([{ type: 'M', owner: 'black' }]);
    expect(state.position[0][3]).toEqual([{ type: 'G', owner: 'black' }]);
    expect(state.position[0][2]).toEqual([{ type: 'E', owner: 'black' }]);
    expect(state.position[1][4]).toEqual([{ type: 'S', owner: 'black' }]);
    expect(state.position[1][3]).toEqual([{ type: 'T', owner: 'black' }]);
    expect(state.position[2][4]).toEqual([{ type: 'A', owner: 'black' }]);
    expect(state.position[2][3]).toEqual([{ type: 'C', owner: 'black' }]);
    expect(state.position[6][4]).toEqual([{ type: 'A', owner: 'white' }]);
    expect(state.position[7][4]).toEqual([{ type: 'S', owner: 'white' }]);
    expect(state.position[7][3]).toEqual([{ type: 'T', owner: 'white' }]);
    expect(state.position[8][4]).toEqual([{ type: 'M', owner: 'white' }]);
    expect(state.position[8][3]).toEqual([{ type: 'G', owner: 'white' }]);
    expect(state.hands.white).toEqual(H({ A: 1, G: 0, M: 0, S: 1, T: 0 }));
    expect(state.hands.black).toEqual(H({ A: 1, C: 0, E: 2, G: 0, M: 0, S: 1, T: 0 }));
    expect(state.turn).toMatchObject({
      phase: 'deploy',
      activePlayer: 'black',
      counter: 13,
      done: 'white',
    });
    expect(validateState(state).ok).toBe(true);
  });
});
