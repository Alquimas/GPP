/**
 * Fixture barrel — loads every .gsfen fixture file and exports it as a named
 * constant. All fixture names are the file stem (without extension) converted
 * to SCREAMING_SNAKE_CASE.
 *
 * Every valid fixture is validated against `validateState` at module-init time
 * (enforced via the constants barrel).
 *
 * Usage:
 *   import { STARTPOS_EXPANDED, BATTLE_START } from './gsfen/fixtures.js';
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../../fixtures');

/** Read a .gsfen fixture file, trim whitespace. */
function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.gsfen`), 'utf-8').trim();
}

// ---------------------------------------------------------------------------
// Exported fixtures — alphabetically by file stem
// ---------------------------------------------------------------------------

export const ALL_ON_BOARD = readFixture('all-on-board');
export const ARATA_ZONE_TEST = readFixture('arata-zone-test');
export const BATTLE_MID_VARIANT = readFixture('battle-mid-variant');
export const BATTLE_MIDGAME = readFixture('battle-midgame');
export const BATTLE_START = readFixture('battle-start');
export const BLACK_DONE_DECLARED = readFixture('black-done-declared');
export const BLACK_TURN_MARSHAL_ONLY = readFixture('black-turn-marshal-only');
export const BOTH_MARSHALS_BATTLE_NOHANDS = readFixture('both-marshals-battle-nohands');
export const BOTH_MARSHALS_DEPLOY_CTR2 = readFixture('both-marshals-deploy-ctr2');
export const BOTH_MARSHALS_PLACED = readFixture('both-marshals-placed');
export const C2_UNKNOWN_PIECE = readFixture('c2-unknown-piece');
export const C3_ADJACENT_EMPTY_RUNS = readFixture('c3-adjacent-empty-runs');
export const C5_DUPLICATE_LETTER = readFixture('c5-duplicate-letter');
export const C5_NON_ALPHABETICAL = readFixture('c5-non-alphabetical');
export const C6_LEADING_ZERO_COUNTER_FULL = readFixture('c6-leading-zero-counter-full');
export const C6_LEADING_ZERO_COUNTER = readFixture('c6-leading-zero-counter');
export const CAPTURE_AFTERMATH = readFixture('capture-aftermath');
export const CHOICE_POS = readFixture('choice-pos');
export const DEEP_CAPTURE_EXCHANGE = readFixture('deep-capture-exchange');
export const DENSE_ENGAGEMENT = readFixture('dense-engagement');
export const DEPLOY_BLACK_CTR2_G = readFixture('deploy-black-ctr2-g');
export const DEPLOY_ENEMY_TOP = readFixture('deploy-enemy-top');
export const DEPLOY_FULL_STACK_PPP = readFixture('deploy-full-stack-ppp');
export const DEPLOY_NEAR_END = readFixture('deploy-near-end');
export const DEPLOY_PHASE_CTR1 = readFixture('deploy-phase-ctr1');
export const DEPLOY_PHASE_CTR3 = readFixture('deploy-phase-ctr3');
export const DEPLOY_STACKS_IN_ZONES = readFixture('deploy-stacks-in-zones');
export const EMPTY_HANDS_ENDGAME = readFixture('empty-hands-endgame');
export const ENEMY_MARSHAL_STACK_TEST = readFixture('enemy-marshal-stack-test');
export const EXAMPLE4_MIXED_STACK = readFixture('example4-mixed-stack');
export const FORCED_CAPTURE = readFixture('forced-capture');
export const FRIENDLY_STACK_TEST = readFixture('friendly-stack-test');
export const FRIENDLY_STACK_WITH_HANDS = readFixture('friendly-stack-with-hands');
export const GAN_BATTLE_STATE = readFixture('gan-battle-state');
export const LOWERCASE_HAND = readFixture('lowercase-hand');
export const MARSHAL_ALONE_BATTLE = readFixture('marshal-alone-battle');
export const MP_STACK_DEPLOY_CTR2 = readFixture('mp-stack-deploy-ctr2');
export const MP_STACK_DEPLOY_CTR3 = readFixture('mp-stack-deploy-ctr3');
export const ONE_SIDE_FULLY_DEPLOYED = readFixture('one-side-fully-deployed');
export const PIECE_AT_COL1 = readFixture('piece-at-col1');
export const PIECE_AT_COL9 = readFixture('piece-at-col9');
export const ROW_NOT_9 = readFixture('row-not-9');
export const ROW_WITH_P_AND_T = readFixture('row-with-P-and-T');
export const SELF_CHECK_POS = readFixture('self-check-pos');
export const SIZE_MISMATCH_AFG = readFixture('size-mismatch-afg');
export const SOME_CAPTURED = readFixture('some-captured');
export const SPARSE_BOARD = readFixture('sparse-board');
export const STACK_OF_FOUR = readFixture('stack-of-four');
export const STARTPOS = readFixture('startpos');
export const STARTPOS_EXPANDED = readFixture('startpos-expanded');
export const THREE_DEEP_STACKS = readFixture('three-deep-stacks');
export const TRIPLE_STACK_BATTLEFIELD = readFixture('triple-stack-battlefield');
export const V3_BLACK_MARSHAL_WRONG_ZONE = readFixture('v3-black-marshal-wrong-zone');
export const WHITE_DONE_DECLARED = readFixture('white-done-declared');
export const WHITE_DONE_MULTI_COUNT_HAND = readFixture('white-done-multi-count-hand');
export const WHITE_MARSHAL_AT_5_9 = readFixture('white-marshal-at-5-9');
