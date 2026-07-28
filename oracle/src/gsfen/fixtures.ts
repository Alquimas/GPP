/**
 * Fixture barrel — loads every .gsfen fixture file and exports it as a named
 * constant. All fixture names are the file stem (without extension) converted
 * to SCREAMING_SNAKE_CASE.
 *
 * Fixtures live in two subdirectories under `oracle/fixtures/`:
 *   `valid/`   — states that pass parseGSFEN + validateState
 *   `invalid/` — states that parse correctly but fail semantic validation,
 *                or that test specific parsing error paths
 *
 * Usage:
 *   import { STARTPOS_EXPANDED, BATTLE_START } from './gsfen/fixtures.js';
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../../fixtures');

/** Read a .gsfen fixture file from the `valid/` subdirectory. */
function readValid(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, 'valid', `${name}.gsfen`), 'utf-8').trim();
}

/** Read a .gsfen fixture file from the `invalid/` subdirectory. */
function readInvalid(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, 'invalid', `${name}.gsfen`), 'utf-8').trim();
}

// ---------------------------------------------------------------------------
// Valid fixtures — pass parseGSFEN + validateState
// ---------------------------------------------------------------------------

export const ALL_ON_BOARD = readValid('all-on-board');
export const ARATA_ZONE_TEST = readValid('arata-zone-test');
export const BATTLE_MID_VARIANT = readValid('battle-mid-variant');
export const BATTLE_MIDGAME = readValid('battle-midgame');
export const BATTLE_START = readValid('battle-start');
export const BLACK_DONE_DECLARED = readValid('black-done-declared');
export const BLACK_TURN_MARSHAL_ONLY = readValid('black-turn-marshal-only');
export const BOTH_MARSHALS_BATTLE_NOHANDS = readValid('both-marshals-battle-nohands');
export const BOTH_MARSHALS_DEPLOY_CTR2 = readValid('both-marshals-deploy-ctr2');
export const BOTH_MARSHALS_PLACED = readValid('both-marshals-placed');
export const CAPTURE_AFTERMATH = readValid('capture-aftermath');
export const DEEP_CAPTURE_EXCHANGE = readValid('deep-capture-exchange');
export const DENSE_ENGAGEMENT = readValid('dense-engagement');
export const DEPLOY_BLACK_CTR2_G = readValid('deploy-black-ctr2-g');
export const DEPLOY_NEAR_END = readValid('deploy-near-end');
export const DEPLOY_PHASE_CTR1 = readValid('deploy-phase-ctr1');
export const DEPLOY_PHASE_CTR3 = readValid('deploy-phase-ctr3');
export const DEPLOY_STACKS_IN_ZONES = readValid('deploy-stacks-in-zones');
export const EMPTY_HANDS_ENDGAME = readValid('empty-hands-endgame');
export const EXAMPLE4_MIXED_STACK = readValid('example4-mixed-stack');
export const LOWERCASE_HAND = readValid('lowercase-hand');
export const ONE_SIDE_FULLY_DEPLOYED = readValid('one-side-fully-deployed');
export const PIECE_AT_COL1 = readValid('piece-at-col1');
export const PIECE_AT_COL9 = readValid('piece-at-col9');
export const SOME_CAPTURED = readValid('some-captured');
export const SPARSE_BOARD = readValid('sparse-board');
export const STARTPOS = readValid('startpos');
export const STARTPOS_EXPANDED = readValid('startpos-expanded');
export const THREE_DEEP_STACKS = readValid('three-deep-stacks');
export const TRIPLE_STACK_BATTLEFIELD = readValid('triple-stack-battlefield');
export const WHITE_DONE_DECLARED = readValid('white-done-declared');
export const WHITE_DONE_MULTI_COUNT_HAND = readValid('white-done-multi-count-hand');
export const WHITE_MARSHAL_AT_5_9 = readValid('white-marshal-at-5-9');

// ---------------------------------------------------------------------------
// Invalid fixtures — parse correctly but fail semantic validation
// ---------------------------------------------------------------------------

export const C2_UNKNOWN_PIECE = readInvalid('c2-unknown-piece');
export const C3_ADJACENT_EMPTY_RUNS = readInvalid('c3-adjacent-empty-runs');
export const C5_DUPLICATE_LETTER = readInvalid('c5-duplicate-letter');
export const C5_NON_ALPHABETICAL = readInvalid('c5-non-alphabetical');
export const C6_LEADING_ZERO_COUNTER_FULL = readInvalid('c6-leading-zero-counter-full');
export const C6_LEADING_ZERO_COUNTER = readInvalid('c6-leading-zero-counter');
export const CHOICE_POS = readInvalid('choice-pos');
export const DEPLOY_ENEMY_TOP = readInvalid('deploy-enemy-top');
export const DEPLOY_FULL_STACK_PPP = readInvalid('deploy-full-stack-ppp');
export const ENEMY_MARSHAL_STACK_TEST = readInvalid('enemy-marshal-stack-test');
export const FORCED_CAPTURE = readInvalid('forced-capture');
export const FRIENDLY_STACK_TEST = readInvalid('friendly-stack-test');
export const FRIENDLY_STACK_WITH_HANDS = readInvalid('friendly-stack-with-hands');
export const GAN_BATTLE_STATE = readInvalid('gan-battle-state');
export const MARSHAL_ALONE_BATTLE = readInvalid('marshal-alone-battle');
export const MP_STACK_DEPLOY_CTR2 = readInvalid('mp-stack-deploy-ctr2');
export const MP_STACK_DEPLOY_CTR3 = readInvalid('mp-stack-deploy-ctr3');
export const ROW_NOT_9 = readInvalid('row-not-9');
export const ROW_WITH_P_AND_T = readInvalid('row-with-P-and-T');
export const SELF_CHECK_POS = readInvalid('self-check-pos');
export const SIZE_MISMATCH_AFG = readInvalid('size-mismatch-afg');
export const STACK_OF_FOUR = readInvalid('stack-of-four');
export const V3_BLACK_MARSHAL_WRONG_ZONE = readInvalid('v3-black-marshal-wrong-zone');
