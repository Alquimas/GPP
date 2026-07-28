/**
 * Fixture barrel — loads every .gsfen fixture file and exports it as a named
 * constant. All fixture names are the file stem (without extension) converted
 * to SCREAMING_SNAKE_CASE.
 *
 * Fixtures live in three subdirectories under `oracle/fixtures/`:
 *   `valid/`        — states that pass parseGSFEN + validateState
 *   `invalid/`      — states that parse correctly but fail semantic validation
 *   `invalid/parse/`— states that fail parse-level validation (C1-C7 errors)
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

/** Read a .gsfen fixture file from the `invalid/parse/` subdirectory. */
function readInvalidParse(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, 'invalid', 'parse', `${name}.gsfen`), 'utf-8').trim();
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

export const CHOICE_POS = readValid('choice-pos');
export const DEPLOY_ENEMY_TOP = readInvalid('deploy-enemy-top');
export const DEPLOY_FULL_STACK_PPP = readValid('deploy-full-stack-ppp');
export const ENEMY_MARSHAL_STACK_TEST = readValid('enemy-marshal-stack-test');
export const FORCED_CAPTURE = readValid('forced-capture');
export const FRIENDLY_STACK_TEST = readValid('friendly-stack-test');
export const FRIENDLY_STACK_WITH_HANDS = readValid('friendly-stack-with-hands');
export const GAN_BATTLE_STATE = readInvalid('gan-battle-state');
export const MARSHAL_ALONE_BATTLE = readValid('marshal-alone-battle');
export const MP_STACK_DEPLOY_CTR2 = readInvalid('mp-stack-deploy-ctr2');
export const MP_STACK_DEPLOY_CTR3 = readValid('mp-stack-deploy-ctr3');
export const ROW_WITH_P_AND_T = readValid('row-with-P-and-T');
export const SELF_CHECK_POS = readValid('self-check-pos');
export const SIZE_MISMATCH_AFG = readValid('size-mismatch-afg');
export const V3_BLACK_MARSHAL_WRONG_ZONE = readInvalid('v3-black-marshal-wrong-zone');

// ---------------------------------------------------------------------------
// Parse-invalid fixtures — fail parse-level validation (C1-C7 errors)
// ---------------------------------------------------------------------------

export const C2_UNKNOWN_PIECE = readInvalidParse('c2-unknown-piece');
export const C3_ADJACENT_EMPTY_RUNS = readInvalidParse('c3-adjacent-empty-runs');
export const C5_DUPLICATE_LETTER = readInvalidParse('c5-duplicate-letter');
export const C5_NON_ALPHABETICAL = readInvalidParse('c5-non-alphabetical');
export const C6_LEADING_ZERO_COUNTER_FULL = readInvalidParse('c6-leading-zero-counter-full');
export const C6_LEADING_ZERO_COUNTER = readInvalidParse('c6-leading-zero-counter');
export const ROW_NOT_9 = readInvalidParse('row-not-9');
export const STACK_OF_FOUR = readInvalidParse('stack-of-four');

// ---------------------------------------------------------------------------
// Lookup record: name → content for dynamic fixture access in tests
// ---------------------------------------------------------------------------

export const FIXTURES: Record<string, string> = {
  'all-on-board': ALL_ON_BOARD,
  'arata-zone-test': ARATA_ZONE_TEST,
  'battle-mid-variant': BATTLE_MID_VARIANT,
  'battle-midgame': BATTLE_MIDGAME,
  'battle-start': BATTLE_START,
  'black-done-declared': BLACK_DONE_DECLARED,
  'black-turn-marshal-only': BLACK_TURN_MARSHAL_ONLY,
  'both-marshals-battle-nohands': BOTH_MARSHALS_BATTLE_NOHANDS,
  'both-marshals-deploy-ctr2': BOTH_MARSHALS_DEPLOY_CTR2,
  'both-marshals-placed': BOTH_MARSHALS_PLACED,
  'capture-aftermath': CAPTURE_AFTERMATH,
  'deep-capture-exchange': DEEP_CAPTURE_EXCHANGE,
  'dense-engagement': DENSE_ENGAGEMENT,
  'deploy-black-ctr2-g': DEPLOY_BLACK_CTR2_G,
  'deploy-near-end': DEPLOY_NEAR_END,
  'deploy-phase-ctr1': DEPLOY_PHASE_CTR1,
  'deploy-phase-ctr3': DEPLOY_PHASE_CTR3,
  'deploy-stacks-in-zones': DEPLOY_STACKS_IN_ZONES,
  'empty-hands-endgame': EMPTY_HANDS_ENDGAME,
  'example4-mixed-stack': EXAMPLE4_MIXED_STACK,
  'lowercase-hand': LOWERCASE_HAND,
  'one-side-fully-deployed': ONE_SIDE_FULLY_DEPLOYED,
  'piece-at-col1': PIECE_AT_COL1,
  'piece-at-col9': PIECE_AT_COL9,
  'some-captured': SOME_CAPTURED,
  'sparse-board': SPARSE_BOARD,
  'startpos': STARTPOS,
  'startpos-expanded': STARTPOS_EXPANDED,
  'three-deep-stacks': THREE_DEEP_STACKS,
  'triple-stack-battlefield': TRIPLE_STACK_BATTLEFIELD,
  'white-done-declared': WHITE_DONE_DECLARED,
  'white-done-multi-count-hand': WHITE_DONE_MULTI_COUNT_HAND,
  'white-marshal-at-5-9': WHITE_MARSHAL_AT_5_9,
  'c2-unknown-piece': C2_UNKNOWN_PIECE,
  'c3-adjacent-empty-runs': C3_ADJACENT_EMPTY_RUNS,
  'c5-duplicate-letter': C5_DUPLICATE_LETTER,
  'c5-non-alphabetical': C5_NON_ALPHABETICAL,
  'c6-leading-zero-counter-full': C6_LEADING_ZERO_COUNTER_FULL,
  'c6-leading-zero-counter': C6_LEADING_ZERO_COUNTER,
  'choice-pos': CHOICE_POS,
  'deploy-enemy-top': DEPLOY_ENEMY_TOP,
  'deploy-full-stack-ppp': DEPLOY_FULL_STACK_PPP,
  'enemy-marshal-stack-test': ENEMY_MARSHAL_STACK_TEST,
  'forced-capture': FORCED_CAPTURE,
  'friendly-stack-test': FRIENDLY_STACK_TEST,
  'friendly-stack-with-hands': FRIENDLY_STACK_WITH_HANDS,
  'gan-battle-state': GAN_BATTLE_STATE,
  'marshal-alone-battle': MARSHAL_ALONE_BATTLE,
  'mp-stack-deploy-ctr2': MP_STACK_DEPLOY_CTR2,
  'mp-stack-deploy-ctr3': MP_STACK_DEPLOY_CTR3,
  'row-not-9': ROW_NOT_9,
  'row-with-P-and-T': ROW_WITH_P_AND_T,
  'self-check-pos': SELF_CHECK_POS,
  'size-mismatch-afg': SIZE_MISMATCH_AFG,
  'stack-of-four': STACK_OF_FOUR,
  'v3-black-marshal-wrong-zone': V3_BLACK_MARSHAL_WRONG_ZONE,
};