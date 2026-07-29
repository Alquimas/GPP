/**
 * Fixture barrel — loads every .gsfen fixture file and exports it as a named
 * constant. All fixture names are the file stem (without extension) converted
 * to SCREAMING_SNAKE_CASE.
 *
 * Fixtures live in two subdirectories under `oracle/fixtures/`:
 *   `valid/`         — states that pass parseGSFEN + validateState
 *   `invalid/parse/` — states that fail parse-level validation (BR-GSFEN-CANON-* errors)
 *
 * (Module-init validation via validateState() is not done here due to a
 * circular dependency: parse → constants → fixtures. Valid fixtures are
 * confirmed at curation time via the GSFEN CLI and the fixture report.)
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
export const BATTLE_MINIMAL = readValid('battle-minimal');
export const BATTLE_START = readValid('battle-start');
export const BLACK_DONE_DECLARED = readValid('black-done-declared');
export const BLACK_TURN_MARSHAL_ONLY = readValid('black-turn-marshal-only');
export const BOTH_MARSHALS_BATTLE_NOHANDS = readValid('both-marshals-battle-nohands');
export const BOTH_MARSHALS_DEPLOY_CTR2 = readValid('both-marshals-deploy-ctr2');
export const BOTH_MARSHALS_PLACED = readValid('both-marshals-placed');
export const CAPTURE_AFTERMATH = readValid('capture-aftermath');
export const CHOICE_POS = readValid('choice-pos');
export const DEEP_CAPTURE_EXCHANGE = readValid('deep-capture-exchange');
export const DENSE_ENGAGEMENT = readValid('dense-engagement');
export const DEPLOY_AUTO_DONE = readValid('deploy-auto-done');
export const DEPLOY_BLACK_CTR2 = readValid('deploy-black-ctr2');
export const DEPLOY_LAST_PIECE = readValid('deploy-last-piece');
export const DEPLOY_BLACK_MARSHAL_PLACED = readValid('deploy-black-marshal-placed');
export const DEPLOY_BOTH_MARSHALS_PAWN = readValid('deploy-both-marshals-pawn');
export const DEPLOY_EXPOSURE_DRAW = readValid('deploy-exposure-draw');
export const DEPLOY_FULL_STACK_PAWNS = readValid('deploy-full-stack-pawns');
export const DEPLOY_LT_EXPOSURE_DRAW = readValid('deploy-lt-exposure-draw');
export const DEPLOY_MARSHAL_COL1 = readValid('deploy-marshal-col1');
export const DEPLOY_MARSHAL_COL9 = readValid('deploy-marshal-col9');
export const DEPLOY_MARSHAL_ON_TOP = readValid('deploy-marshal-on-top');
export const DEPLOY_NEAR_END = readValid('deploy-near-end');
export const DEPLOY_NEAR_END_BLACK = readValid('deploy-near-end-black');
export const DEPLOY_PHASE_CTR1 = readValid('deploy-phase-ctr1');
export const DEPLOY_PHASE_CTR3 = readValid('deploy-phase-ctr3');
export const DEPLOY_STACKS_IN_ZONES = readValid('deploy-stacks-in-zones');
export const EMPTY_HANDS_ENDGAME = readValid('empty-hands-endgame');
export const ENEMY_MARSHAL_STACK_TEST = readValid('enemy-marshal-stack-test');
export const EXAMPLE4_MIXED_STACK = readValid('example4-mixed-stack');
export const FORCED_CAPTURE = readValid('forced-capture');
export const FRIENDLY_STACK_TEST = readValid('friendly-stack-test');
export const FUZZER_CRASH_145 = readValid('fuzzer-crash-145');
export const FRIENDLY_STACK_WITH_HANDS = readValid('friendly-stack-with-hands');
export const MARSHAL_ALONE_BATTLE = readValid('marshal-alone-battle');
export const MARSHAL_BLOCKED_GENERAL_FREE = readValid('marshal-blocked-general-free');
export const MP_STACK_DEPLOY_CTR3 = readValid('mp-stack-deploy-ctr3');
export const ONE_SIDE_FULLY_DEPLOYED = readValid('one-side-fully-deployed');
export const ROW_WITH_P_AND_T = readValid('row-with-P-and-T');
export const SELF_CHECK_POS = readValid('self-check-pos');
export const SELF_CHECK_SIZE3_CAPTURE = readValid('self-check-size3-capture');
export const SIZE_MISMATCH_AFG = readValid('size-mismatch-afg');
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
// Parse-invalid fixtures — fail parse-level validation (BR-GSFEN-CANON-* errors)
// ---------------------------------------------------------------------------

export const C2_UNKNOWN_PIECE = readInvalidParse('c2-unknown-piece');
export const C3_ADJACENT_EMPTY_RUNS = readInvalidParse('c3-adjacent-empty-runs');
export const C5_DUPLICATE_LETTER = readInvalidParse('c5-duplicate-letter');
export const C5_NON_ALPHABETICAL = readInvalidParse('c5-non-alphabetical');
export const C6_LEADING_ZERO_COUNTER = readInvalidParse('c6-leading-zero-counter');
export const C6_LEADING_ZERO_COUNTER_FULL = readInvalidParse('c6-leading-zero-counter-full');
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
  'battle-minimal': BATTLE_MINIMAL,
  'battle-start': BATTLE_START,
  'black-done-declared': BLACK_DONE_DECLARED,
  'black-turn-marshal-only': BLACK_TURN_MARSHAL_ONLY,
  'both-marshals-battle-nohands': BOTH_MARSHALS_BATTLE_NOHANDS,
  'both-marshals-deploy-ctr2': BOTH_MARSHALS_DEPLOY_CTR2,
  'both-marshals-placed': BOTH_MARSHALS_PLACED,
  'capture-aftermath': CAPTURE_AFTERMATH,
  'choice-pos': CHOICE_POS,
  'deep-capture-exchange': DEEP_CAPTURE_EXCHANGE,
  'dense-engagement': DENSE_ENGAGEMENT,
  'deploy-auto-done': DEPLOY_AUTO_DONE,
  'deploy-black-ctr2': DEPLOY_BLACK_CTR2,
  'deploy-last-piece': DEPLOY_LAST_PIECE,
  'deploy-black-marshal-placed': DEPLOY_BLACK_MARSHAL_PLACED,
  'deploy-both-marshals-pawn': DEPLOY_BOTH_MARSHALS_PAWN,
  'deploy-exposure-draw': DEPLOY_EXPOSURE_DRAW,
  'deploy-full-stack-pawns': DEPLOY_FULL_STACK_PAWNS,
  'deploy-lt-exposure-draw': DEPLOY_LT_EXPOSURE_DRAW,
  'deploy-marshal-col1': DEPLOY_MARSHAL_COL1,
  'deploy-marshal-col9': DEPLOY_MARSHAL_COL9,
  'deploy-marshal-on-top': DEPLOY_MARSHAL_ON_TOP,
  'deploy-near-end': DEPLOY_NEAR_END,
  'deploy-near-end-black': DEPLOY_NEAR_END_BLACK,
  'deploy-phase-ctr1': DEPLOY_PHASE_CTR1,
  'deploy-phase-ctr3': DEPLOY_PHASE_CTR3,
  'deploy-stacks-in-zones': DEPLOY_STACKS_IN_ZONES,
  'empty-hands-endgame': EMPTY_HANDS_ENDGAME,
  'enemy-marshal-stack-test': ENEMY_MARSHAL_STACK_TEST,
  'example4-mixed-stack': EXAMPLE4_MIXED_STACK,
  'forced-capture': FORCED_CAPTURE,
  'friendly-stack-test': FRIENDLY_STACK_TEST,
  'fuzzer-crash-145': FUZZER_CRASH_145,
  'friendly-stack-with-hands': FRIENDLY_STACK_WITH_HANDS,
  'marshal-alone-battle': MARSHAL_ALONE_BATTLE,
  'mp-stack-deploy-ctr3': MP_STACK_DEPLOY_CTR3,
  'one-side-fully-deployed': ONE_SIDE_FULLY_DEPLOYED,
  'row-with-P-and-T': ROW_WITH_P_AND_T,
  'self-check-pos': SELF_CHECK_POS,
  'self-check-size3-capture': SELF_CHECK_SIZE3_CAPTURE,
  'size-mismatch-afg': SIZE_MISMATCH_AFG,
  'some-captured': SOME_CAPTURED,
  'sparse-board': SPARSE_BOARD,
  startpos: STARTPOS,
  'startpos-expanded': STARTPOS_EXPANDED,
  'three-deep-stacks': THREE_DEEP_STACKS,
  'triple-stack-battlefield': TRIPLE_STACK_BATTLEFIELD,
  'white-done-declared': WHITE_DONE_DECLARED,
  'white-done-multi-count-hand': WHITE_DONE_MULTI_COUNT_HAND,
  'white-marshal-at-5-9': WHITE_MARSHAL_AT_5_9,
  // Parse-invalid fixtures
  'c2-unknown-piece': C2_UNKNOWN_PIECE,
  'c3-adjacent-empty-runs': C3_ADJACENT_EMPTY_RUNS,
  'c5-duplicate-letter': C5_DUPLICATE_LETTER,
  'c5-non-alphabetical': C5_NON_ALPHABETICAL,
  'c6-leading-zero-counter': C6_LEADING_ZERO_COUNTER,
  'c6-leading-zero-counter-full': C6_LEADING_ZERO_COUNTER_FULL,
  'row-not-9': ROW_NOT_9,
  'stack-of-four': STACK_OF_FOUR,
};
