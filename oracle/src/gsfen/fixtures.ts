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

const _ALL_ON_BOARD                   = readValid('all-on-board');
const _ARATA_ZONE_TEST                = readValid('arata-zone-test');
const _BATTLE_MID_VARIANT             = readValid('battle-mid-variant');
const _BATTLE_MIDGAME                 = readValid('battle-midgame');
const _BATTLE_MINIMAL                 = readValid('battle-minimal');
const _BATTLE_START                   = readValid('battle-start');
const _BLACK_DONE_DECLARED            = readValid('black-done-declared');
const _BLACK_TURN_MARSHAL_ONLY        = readValid('black-turn-marshal-only');
const _BOTH_MARSHALS_BATTLE_NOHANDS   = readValid('both-marshals-battle-nohands');
const _BOTH_MARSHALS_DEPLOY_CTR2      = readValid('both-marshals-deploy-ctr2');
const _BOTH_MARSHALS_PLACED           = readValid('both-marshals-placed');
const _CAPTURE_AFTERMATH              = readValid('capture-aftermath');
const _CHOICE_POS                     = readValid('choice-pos');
const _DEEP_CAPTURE_EXCHANGE          = readValid('deep-capture-exchange');
const _DENSE_ENGAGEMENT               = readValid('dense-engagement');
const _DEPLOY_BLACK_CTR2              = readValid('deploy-black-ctr2');
const _DEPLOY_BLACK_MARSHAL_PLACED    = readValid('deploy-black-marshal-placed');
const _DEPLOY_BOTH_MARSHALS_PAWN      = readValid('deploy-both-marshals-pawn');
const _DEPLOY_FULL_STACK_PAWNS        = readValid('deploy-full-stack-pawns');
const _DEPLOY_MARSHAL_COL1            = readValid('deploy-marshal-col1');
const _DEPLOY_MARSHAL_COL9            = readValid('deploy-marshal-col9');
const _DEPLOY_MARSHAL_ON_TOP          = readValid('deploy-marshal-on-top');
const _DEPLOY_NEAR_END                = readValid('deploy-near-end');
const _DEPLOY_PHASE_CTR1              = readValid('deploy-phase-ctr1');
const _DEPLOY_PHASE_CTR3              = readValid('deploy-phase-ctr3');
const _DEPLOY_STACKS_IN_ZONES         = readValid('deploy-stacks-in-zones');
const _EMPTY_HANDS_ENDGAME            = readValid('empty-hands-endgame');
const _ENEMY_MARSHAL_STACK_TEST       = readValid('enemy-marshal-stack-test');
const _EXAMPLE4_MIXED_STACK           = readValid('example4-mixed-stack');
const _FORCED_CAPTURE                 = readValid('forced-capture');
const _FRIENDLY_STACK_TEST            = readValid('friendly-stack-test');
const _FRIENDLY_STACK_WITH_HANDS      = readValid('friendly-stack-with-hands');
const _MARSHAL_ALONE_BATTLE           = readValid('marshal-alone-battle');
const _MP_STACK_DEPLOY_CTR3           = readValid('mp-stack-deploy-ctr3');
const _ONE_SIDE_FULLY_DEPLOYED        = readValid('one-side-fully-deployed');
const _ROW_WITH_P_AND_T               = readValid('row-with-P-and-T');
const _SELF_CHECK_POS                 = readValid('self-check-pos');
const _SIZE_MISMATCH_AFG              = readValid('size-mismatch-afg');
const _SOME_CAPTURED                  = readValid('some-captured');
const _SPARSE_BOARD                   = readValid('sparse-board');
const _STARTPOS                       = readValid('startpos');
const _STARTPOS_EXPANDED              = readValid('startpos-expanded');
const _THREE_DEEP_STACKS              = readValid('three-deep-stacks');
const _TRIPLE_STACK_BATTLEFIELD       = readValid('triple-stack-battlefield');
const _WHITE_DONE_DECLARED            = readValid('white-done-declared');
const _WHITE_DONE_MULTI_COUNT_HAND    = readValid('white-done-multi-count-hand');
const _WHITE_MARSHAL_AT_5_9           = readValid('white-marshal-at-5-9');

export const ALL_ON_BOARD                   = _ALL_ON_BOARD;
export const ARATA_ZONE_TEST                = _ARATA_ZONE_TEST;
export const BATTLE_MID_VARIANT             = _BATTLE_MID_VARIANT;
export const BATTLE_MIDGAME                 = _BATTLE_MIDGAME;
export const BATTLE_MINIMAL                 = _BATTLE_MINIMAL;
export const BATTLE_START                   = _BATTLE_START;
export const BLACK_DONE_DECLARED            = _BLACK_DONE_DECLARED;
export const BLACK_TURN_MARSHAL_ONLY        = _BLACK_TURN_MARSHAL_ONLY;
export const BOTH_MARSHALS_BATTLE_NOHANDS   = _BOTH_MARSHALS_BATTLE_NOHANDS;
export const BOTH_MARSHALS_DEPLOY_CTR2      = _BOTH_MARSHALS_DEPLOY_CTR2;
export const BOTH_MARSHALS_PLACED           = _BOTH_MARSHALS_PLACED;
export const CAPTURE_AFTERMATH              = _CAPTURE_AFTERMATH;
export const CHOICE_POS                     = _CHOICE_POS;
export const DEEP_CAPTURE_EXCHANGE          = _DEEP_CAPTURE_EXCHANGE;
export const DENSE_ENGAGEMENT               = _DENSE_ENGAGEMENT;
export const DEPLOY_BLACK_CTR2              = _DEPLOY_BLACK_CTR2;
export const DEPLOY_BLACK_MARSHAL_PLACED    = _DEPLOY_BLACK_MARSHAL_PLACED;
export const DEPLOY_BOTH_MARSHALS_PAWN      = _DEPLOY_BOTH_MARSHALS_PAWN;
export const DEPLOY_FULL_STACK_PAWNS        = _DEPLOY_FULL_STACK_PAWNS;
export const DEPLOY_MARSHAL_COL1            = _DEPLOY_MARSHAL_COL1;
export const DEPLOY_MARSHAL_COL9            = _DEPLOY_MARSHAL_COL9;
export const DEPLOY_MARSHAL_ON_TOP          = _DEPLOY_MARSHAL_ON_TOP;
export const DEPLOY_NEAR_END                = _DEPLOY_NEAR_END;
export const DEPLOY_PHASE_CTR1              = _DEPLOY_PHASE_CTR1;
export const DEPLOY_PHASE_CTR3              = _DEPLOY_PHASE_CTR3;
export const DEPLOY_STACKS_IN_ZONES         = _DEPLOY_STACKS_IN_ZONES;
export const EMPTY_HANDS_ENDGAME            = _EMPTY_HANDS_ENDGAME;
export const ENEMY_MARSHAL_STACK_TEST       = _ENEMY_MARSHAL_STACK_TEST;
export const EXAMPLE4_MIXED_STACK           = _EXAMPLE4_MIXED_STACK;
export const FORCED_CAPTURE                 = _FORCED_CAPTURE;
export const FRIENDLY_STACK_TEST            = _FRIENDLY_STACK_TEST;
export const FRIENDLY_STACK_WITH_HANDS      = _FRIENDLY_STACK_WITH_HANDS;
export const MARSHAL_ALONE_BATTLE           = _MARSHAL_ALONE_BATTLE;
export const MP_STACK_DEPLOY_CTR3           = _MP_STACK_DEPLOY_CTR3;
export const ONE_SIDE_FULLY_DEPLOYED        = _ONE_SIDE_FULLY_DEPLOYED;
export const ROW_WITH_P_AND_T               = _ROW_WITH_P_AND_T;
export const SELF_CHECK_POS                 = _SELF_CHECK_POS;
export const SIZE_MISMATCH_AFG              = _SIZE_MISMATCH_AFG;
export const SOME_CAPTURED                  = _SOME_CAPTURED;
export const SPARSE_BOARD                   = _SPARSE_BOARD;
export const STARTPOS                       = _STARTPOS;
export const STARTPOS_EXPANDED              = _STARTPOS_EXPANDED;
export const THREE_DEEP_STACKS              = _THREE_DEEP_STACKS;
export const TRIPLE_STACK_BATTLEFIELD       = _TRIPLE_STACK_BATTLEFIELD;
export const WHITE_DONE_DECLARED            = _WHITE_DONE_DECLARED;
export const WHITE_DONE_MULTI_COUNT_HAND    = _WHITE_DONE_MULTI_COUNT_HAND;
export const WHITE_MARSHAL_AT_5_9           = _WHITE_MARSHAL_AT_5_9;

// ---------------------------------------------------------------------------
// Parse-invalid fixtures — fail parse-level validation (BR-GSFEN-CANON-* errors)
// ---------------------------------------------------------------------------

export const C2_UNKNOWN_PIECE           = readInvalidParse('c2-unknown-piece');
export const C3_ADJACENT_EMPTY_RUNS     = readInvalidParse('c3-adjacent-empty-runs');
export const C5_DUPLICATE_LETTER        = readInvalidParse('c5-duplicate-letter');
export const C5_NON_ALPHABETICAL        = readInvalidParse('c5-non-alphabetical');
export const C6_LEADING_ZERO_COUNTER    = readInvalidParse('c6-leading-zero-counter');
export const C6_LEADING_ZERO_COUNTER_FULL = readInvalidParse('c6-leading-zero-counter-full');
export const ROW_NOT_9                  = readInvalidParse('row-not-9');
export const STACK_OF_FOUR              = readInvalidParse('stack-of-four');

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
  'deploy-black-ctr2': DEPLOY_BLACK_CTR2,
  'deploy-black-marshal-placed': DEPLOY_BLACK_MARSHAL_PLACED,
  'deploy-both-marshals-pawn': DEPLOY_BOTH_MARSHALS_PAWN,
  'deploy-full-stack-pawns': DEPLOY_FULL_STACK_PAWNS,
  'deploy-marshal-col1': DEPLOY_MARSHAL_COL1,
  'deploy-marshal-col9': DEPLOY_MARSHAL_COL9,
  'deploy-marshal-on-top': DEPLOY_MARSHAL_ON_TOP,
  'deploy-near-end': DEPLOY_NEAR_END,
  'deploy-phase-ctr1': DEPLOY_PHASE_CTR1,
  'deploy-phase-ctr3': DEPLOY_PHASE_CTR3,
  'deploy-stacks-in-zones': DEPLOY_STACKS_IN_ZONES,
  'empty-hands-endgame': EMPTY_HANDS_ENDGAME,
  'enemy-marshal-stack-test': ENEMY_MARSHAL_STACK_TEST,
  'example4-mixed-stack': EXAMPLE4_MIXED_STACK,
  'forced-capture': FORCED_CAPTURE,
  'friendly-stack-test': FRIENDLY_STACK_TEST,
  'friendly-stack-with-hands': FRIENDLY_STACK_WITH_HANDS,
  'marshal-alone-battle': MARSHAL_ALONE_BATTLE,
  'mp-stack-deploy-ctr3': MP_STACK_DEPLOY_CTR3,
  'one-side-fully-deployed': ONE_SIDE_FULLY_DEPLOYED,
  'row-with-P-and-T': ROW_WITH_P_AND_T,
  'self-check-pos': SELF_CHECK_POS,
  'size-mismatch-afg': SIZE_MISMATCH_AFG,
  'some-captured': SOME_CAPTURED,
  'sparse-board': SPARSE_BOARD,
  'startpos': STARTPOS,
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
