# Refining Plan — Step 8 Review Fixes

This plan addresses every finding from `step8-review.html` (commit `1dfa9bc`) in 22 individual problem-fix sections. Each section ends with a mandatory **"Similar-problem scan"** step that must be run after the fix so that the same class of defect is hunted across the rest of the codebase.

The plan is ordered by dependency, not by axis. Findings that must be decided first (spec-level) come first; type-level foundations come before code fixes; code fixes come before test fixes; cosmetic/cleanup comes last.

---

## Execution order (summary)

| Phase | Problem IDs | Rationale |
|-------|-------------|-----------|
| 0 | — | Pre-flight: confirm baseline (`docker compose run --rm test` and `tsc --noEmit` clean) |
| 1 | C1 | Spec decision — gates everything downstream |
| 2 | C2 | Unify the dual validation stacks (depends on C1) |
| 3 | C9, B1 | Remove/mark temporary public seams |
| 4 | B2, B3 | Error domain tightening (literal-union, populate/remove kind) |
| 5 | C4, A7 | Rule-citation hygiene (depends on B2) |
| 6 | C3 | Single source of outcome semantics |
| 7 | C5, C6, C7, C8 | Naivety: doc drift, helper unification, noise cleanup, documented invention |
| 8 | B4 | Migrate remaining duplicate `ValidationResult` definitions |
| 9 | B5, B6 | Validator type tightening and cast policy |
| 10 | A1 | Illegal-state fixture |
| 11 | A2 | BR-TURN-002 lock-in assertion |
| 12 | A3 | Mislabeled BR-MOVE-005 coverage |
| 13 | A4 | Check-ordering coupling |
| 14 | A5 | Behavioral coverage gaps |
| 15 | A6 | Duplicated/weak assertions |
| 16 | — | Final verification: full test + type-check + similarity-scan across every finding |

---

## Phase 0 — Pre-flight verification

**Goal:** confirm the baseline is green before any change.

1. Run `docker compose run --rm check` from repo root — expect `exit 0` and zero `tsc` errors.
2. Run `docker compose run --rm test` from repo root — expect `727/727` passing.
3. Record both outputs. If either fails, stop and fix first.

---

## Problem C1 — Invented rule: "Marshal must be placed on an empty square"

**Finding (from review):** `oracle/src/game/deploy.ts:143-149` rejects placing the Marshal onto a friendly stack. No business rule supports this. The same invented rule is duplicated in `oracle/src/gan/validate.ts:173-183`. BR-DEPLOY-005 allows placing a piece on one's own pieces subject only to the size limit and the "never on top of a Marshal" restriction; GAN.md S2 constrains the *top of the target*, not the *placed piece*. BR-STACK-004 explicitly contemplates the Marshal belonging to a stack.

### Affected files and exact lines

- `oracle/src/game/deploy.ts` lines 143-149
- `oracle/src/gan/validate.ts` lines 173-183

### Decision required (human — this is a spec question, not a code question)

The code and the spec cannot both be right. Two paths:

**Path A — Remove the check (aligns code to current spec):**
1. Open `oracle/src/game/deploy.ts`.
2. Delete lines 143-149 (the `if (piece === 'M') { ... }` block inside the `targetStack !== null` branch).
3. Open `oracle/src/gan/validate.ts`.
4. Delete lines 173-183 (the analogous `if (piece === 'M' && targetStack.length > 0)` block).
5. Update the JSDoc on `validatePlacement` (line 50: "6. Marshal stacking restriction: no stacking on Marshal") — remove the sentence that implies placing the Marshal has a special target restriction. Replace it with "6. No stacking on a Marshal-topped target (BR-STACK-004)" to reflect that the restriction is on the *target's top*, not the placed piece.
6. In `gan/validate.ts` line 91, the comment "and the top piece is not a Marshal — Marshal can never stack below" is already correct. Leave it.

**Path B — Add the rule (requires spec change — out of scope for this refinement):**
1. Document a new BR entry in `BUSINESS_RULES.md` (e.g., BR-DEPLOY-008) stating the Marshal may only be placed on an empty square.
2. Add a matching clause to GAN.md S2.
3. Update the error rule string in both validators from `'BR-DEPLOY-005'` / `'S2'` to the new rule code.
4. Add positive and negative tests for the new rule in `deploy.test.ts`.

**Default assumption unless a human decides otherwise:** **Path A** — remove the check. The review explicitly states the spec is silent, and the GAN.md S2 wording constrains the target, not the placed piece. The Step-7 saved test case uses `[A,A,m]` (which would also break if Path B were taken without updating it).

### Fix steps (assuming Path A)

1. Open `oracle/src/game/deploy.ts` in an editor.
2. Locate the block at lines 143-149:
   ```ts
   // Marshal must be placed on an empty square (cannot stack on anything)
   if (piece === 'M') {
     return {
       ok: false,
       error: new GameError('Marshal must be placed on an empty square', 'BR-DEPLOY-005'),
     };
   }
   ```
3. Delete the entire 7-line block (including the comment).
4. Edit the JSDoc on `validatePlacement` (line 50): change "6. Marshal stacking restriction: no stacking on Marshal" to "6. No stacking on a Marshal-topped target (BR-STACK-004)".
5. Open `oracle/src/gan/validate.ts`.
6. Locate the block at lines 173-183:
   ```ts
   // Marshal cannot be placed on top of any stack (BR-DEPLOY-005/006)
   // Actually, Marshal placement: special rule — it must be on an empty square
   if (piece === 'M' && targetStack.length > 0) {
     return {
       ok: false,
       error: new GameError(
         `Marshal must be placed on an empty square, not on a stack (S2)`,
         'S2',
       ),
     };
   }
   ```
7. Delete the entire 11-line block (including both comment lines).
8. Save both files.
9. Run `docker compose run --rm check`. Expect `exit 0`.
10. Run `docker compose run --rm test`. If the saved Step-7 test case for `[A,A,m]` now exercises new behavior (stacking a piece onto a Marshal-topped stack is still rejected by the *target-top* check), expect `727/727`. If a test specifically asserted "Marshal must be placed on empty square," it must also be deleted/rewritten — search for that assertion string in `tests/` and fix it.
11. Run a targeted probe: construct a state where a Marshal sits at the bottom of a friendly stack (which `validateState` would reject per V3) — confirm that `validatePlacement` now permits stacking a piece *onto* a friendly stack whose top is NOT a Marshal, but the Marshal is underneath. If the new behavior matches spec intent, proceed.

### Similar-problem scan for C1

After the fix, scan the entire codebase for other **invented rules** (logic that is not grounded in any `BR-xxx`, `V-xxx`, or `S-xxx` reference):

1. Search for every `new GameError(...)` call in `oracle/src/`.
2. For each one, read the second argument (the rule string).
3. Cross-reference that rule string against `BUSINESS_RULES.md`, `GAN.md`, and `GSFEN.md`.
4. For every rule string that does not appear in those documents (e.g., `'S2'`, `'V3'`, `'C1'` — the last of which is a known alias), determine whether it is:
   - a legitimate alias (documented in the spec under another identifier),
   - an internal/defensive check (should be renamed to make this explicit), or
   - an invented rule (must be removed or the spec must be updated).
5. Record the findings in this document under a "C1 follow-up" subsection.

---

## Problem C2 — Two public validation stacks provably diverge

**Finding (from review):** `oracle/src/gan/validate.ts` (Step 4, S1–S6) and `oracle/src/game/deploy.ts + battle.ts` (Step 8) are two parallel public validators for the same action types. They disagree: `validateAction` accepts stacking onto a friendly Marshal (missing non-Marshal-topped check); `validateAction` accepts any illegal move/arata (S3/S4 are stubs returning `ok`); rule namespaces differ (`'S2'` vs `'BR-DEPLOY-004'`).

### Affected files and exact lines

- `oracle/src/gan/validate.ts` — the entire file (353 lines)
- `oracle/src/index.ts` line 10 (`export { validateAction } from './gan/validate.js'`)

### Fix strategy

Make `gan/validate.ts` a thin delegation wrapper around the Step-8 validators, preserving the S-code vocabulary for backward compatibility. The `checkPlacementLegality` body becomes `validatePlacement(state, action)` (mapped to the right rule string); the `checkMoveLegality` stub becomes `validateMove`; the `checkArataLegality` stub becomes `validateArata`.

### Fix steps

1. Open `oracle/src/gan/validate.ts`.
2. At the top, add imports:
   ```ts
   import { validatePlacement } from '../game/deploy.js';
   import { validateMove, validateArata } from '../game/battle.js';
   ```
3. Replace the body of `checkPlacementLegality` (lines 95-187) with a single-line delegation:
   ```ts
   function checkPlacementLegality(action: Action, state: GameState): ValidationResult {
     return validatePlacement(state, action);
     // Note: error.rule values will now be BR-DEPLOY-xxx codes (not 'S2').
     // S2 remains a semantic alias — see module JSDoc for the mapping.
   }
   ```
4. Replace the body of `checkMoveLegality` (lines 201-204, currently a stub) with:
   ```ts
   function checkMoveLegality(action: Action, state: GameState): ValidationResult {
     // Returns the Step-8 validateMove result.
     // 'ok: true' here means the PlayValidation is ok; we discard the speculative afterState.
     const result = validateMove(state, action);
     return result.ok ? { ok: true } : { ok: false, error: result.error };
   }
   ```
5. Replace the body of `checkArataLegality` (lines 217-220, currently a stub) with:
   ```ts
   function checkArataLegality(action: Action, state: GameState): ValidationResult {
     const result = validateArata(state, action);
     return result.ok ? { ok: true } : { ok: false, error: result.error };
   }
   ```
6. Delete the now-unused local helpers `isInDeployZone` (lines 40-42) and `DEPLOY_ZONE_ROWS` (lines 30-33) if no other function in this file uses them (after the refactor, none does).
7. Delete the now-unused imports `getStack`, `topPiece` from `../board/board.js` (line 17).
8. Delete the `Square` type import on line 15 if it is no longer referenced (it is used by `isInDeployZone` which is being removed).
9. Update the module-level JSDoc (lines 1-13) to document that `validateAction` now delegates to the Step-8 validators, and list the rule-string mapping (S1→phase codes, S2→BR-DEPLOY-xxx, S3→BR-MOVE-xxx, S4→BR-ARATA-xxx, S5→S5, S6→(no-op)).
10. Save the file.
11. Open `oracle/src/index.ts`. Decide whether to continue exporting `validateAction`:
    - If the public API still needs a GAN-string-aware validator, keep the export but update the JSDoc to document the delegation.
    - If `validateAction` is now redundant with the Step-8 validators, consider un-exporting it (see C9) and directing consumers to `validatePlacement`/`validateMove`/`validateArata`/`validatePlay`.
12. Run `docker compose run --rm check`. Expect `exit 0`.
13. Run `docker compose run --rm test`. Expect the existing GAN validator tests in `tests/gan/` to still pass — they may now return different `error.rule` values. Audit every `error.rule === 'S2'` assertion in `tests/gan/` and update to the new `BR-DEPLOY-xxx` codes, or (preferred) assert on the semantic meaning (e.g., "placement rejected for any reason") when the exact rule code is an implementation detail.
14. Add a new regression test (in `tests/gan/validate.test.ts` or similar) that asserts parity: for the same action+state, `validateAction(...)` and the Step-8 validator return the same `ok` outcome.

### Similar-problem scan for C2

After the fix, scan for other cases of **duplicated validation logic** across the codebase:

1. List every file that implements a validation concern (placement/move/arata legality, state validity, action legality).
2. For each pair of validators that touch the same action+state, confirm that one delegates to the other (not re-implementing).
3. Search for the pattern "function check...Legality" or "function validate..." and confirm there is exactly one canonical implementation per concern.
4. In particular, audit the `gsfen/validate.ts` V-rules: does any V-rule re-implement logic that the action validators already cover (e.g., V3 marshal integrity vs. the deploy.ts Marshal-first check)? If so, consider extracting a shared helper (see also C6).
5. Record the findings in this document under a "C2 follow-up" subsection.

---

## Problem C9 — Explicitly-temporary functions exported from public API

**Finding (from review):** `applyMove` and `applyArata` are documented as Step-8-only scaffolding ("Step 10 replaces them") yet are exported from the public barrel (`oracle/src/index.ts:24`).

### Affected files and exact lines

- `oracle/src/index.ts` line 24
- `oracle/src/game/apply.ts` lines 8-12 (JSDoc already notes "Step 10 replaces them")

### Fix steps

1. Open `oracle/src/index.ts`.
2. Remove line 24: `export { applyMove, applyArata } from './game/apply.js';`.
3. Open `oracle/src/game/apply.ts`.
4. Add `@internal` JSDoc tags to both `applyMove` (line 84) and `applyArata` (line 131) so that any future re-export is discouraged:
   ```ts
   /**
    * @internal Step-8 scaffolding. Step 10 replaces this with full turn management.
    */
   ```
5. If any internal consumer outside `oracle/src/game/` imports `applyMove`/`applyArata`, update that import to use a relative path (e.g., `'../game/apply.js'`).
6. Run `docker compose run --rm check`. Expect `exit 0`. If any test file imports these from the public barrel, update the import path.
7. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for C9

After the fix, scan for other **temporarily-scoped exports** in `oracle/src/index.ts`:

1. Read `index.ts` in full.
2. For each export, read the originating module's JSDoc and confirm the symbol is not documented as "temporary", "scaffolding", "Step-X only", or "will be replaced".
3. For any such symbol found: either add `@internal` and un-export it, or remove the "temporary" language from the JSDoc if the symbol is intended to be durable.
4. Record the findings in a "C9 follow-up" subsection.

---

## Problem B1 — `PlayValidation.afterState` is typed as a real next state but isn't one

**Finding (from review):** `validatePlay`'s `afterState: GameState` is indistinguishable at the type level from a committed next state. Step-8 `applyMove` does not flip the active player, increment the counter, or record history.

### Affected files and exact lines

- `oracle/src/game/validation.ts` lines 37-39
- `oracle/src/game/apply.ts` lines 69-79 (JSDoc on `applyMove`)
- `oracle/src/game/battle.ts` lines 374-379 (JSDoc on `validatePlay`)

### Fix steps

1. Open `oracle/src/game/validation.ts`.
2. Replace the `PlayValidation` type definition with a branded form:
   ```ts
   /**
    * Play validation result — includes a SPECULATIVE afterState on success.
    *
    * WARNING: `speculativeState` is NOT a committed next GameState.
    * It lacks: turn transition (active player flip), turn counter increment,
    * turncoat application, history recording, and terminal-condition evaluation.
    * Step 10 will replace it with a real committed state.
    *
    * Consumers MUST NOT treat `speculativeState` as the "next game state" for
    * any purpose other than Self-Check (BR-ACTION-002) evaluation.
    */
   export type PlayValidation =
     | { ok: true; speculativeState: GameState }
     | { ok: false; error: GameError };
   ```
   (Renaming the field from `afterState` to `speculativeState` is a deliberate break — it forces every consumer to notice the change and reconsider whether they were treating it as a committed state.)
3. Save the file.
4. Open `oracle/src/game/battle.ts`.
5. Replace every occurrence of `afterState` in this file with `speculativeState`:
   - Line 233: `const afterState = applyMove(state, action);` → `const speculativeState = applyMove(state, action);`
   - Line 243: `return { ok: true, afterState };` → `return { ok: true, speculativeState };`
   - Line 354: `const afterState = applyArata(state, action);` → `const speculativeState = applyArata(state, action);`
   - Line 364: `return { ok: true, afterState };` → `return { ok: true, speculativeState };`
6. Update the JSDoc on `validatePlay` (lines 374-379) to reflect the new field name and add the same WARNING as in the type definition.
7. Update the JSDoc on `applyMove` (lines 69-79) to restate: "Returns a GameState that is SPECULATIVE — it is missing turn transition, turncoat, terminal conditions, and history. See `PlayValidation.speculativeState`."
8. Search for `afterState` across the entire `oracle/src/` and `oracle/tests/` directories. Update every occurrence. (Test files that pattern-match on `{ ok: true, afterState }` must change to `{ ok: true, speculativeState }`.)
9. Run `docker compose run --rm check`. Expect `exit 0`.
10. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B1

After the fix, scan for other **misleading type surfaces** in the domain model:

1. Search for every exported type and interface in `oracle/src/`.
2. For each one, read its JSDoc and ask: "Does the type's name and shape imply behavior/state that the value does not actually carry?"
3. In particular, look for:
   - Any `State`-suffixed type whose value is missing turn management fields.
   - Any field named "result", "outcome", or "next" whose semantics are narrower than the name implies.
4. For each misleading surface: either rename it, add a `@deprecated`/`@internal`/WARNING JSDoc, or restructure it.
5. Record findings under "B1 follow-up".

---

## Problem B2 — `GameError.rule` is `string`

**Finding (from review):** The error domain is the oracle's contract, but any string compiles. A closed literal union would make the vocabulary explicit, typo-proof, and let tests assert against a typed set.

### Affected files and exact lines

- `oracle/src/errors.ts` lines 11, 16

### Fix steps

1. Open `oracle/src/errors.ts`.
2. Before the `GameError` class, define the closed rule vocabulary as a literal union type. Collect every rule string currently in use across the codebase:
   ```ts
   /**
    * The closed vocabulary of rule identifiers that a GameError can cite.
    *
    * Includes:
    * - BR-xxx codes from BUSINESS_RULES.md
    * - S-codes from GAN.md
    * - V-codes from GSFEN.md
    * - Any internal/defensive codes (e.g., the turncoat 'unimplemented' marker)
    *
    * Adding a new rule identifier requires updating this union —
    * the compiler will catch every miss.
    */
   export type GameRule =
     // Business rules (deploy)
     | 'BR-DEPLOY-001' | 'BR-DEPLOY-002' | 'BR-DEPLOY-003' | 'BR-DEPLOY-004'
     | 'BR-DEPLOY-005' | 'BR-DEPLOY-006' | 'BR-DEPLOY-007' | 'BR-DEPLOY-011'
     // Business rules (move)
     | 'BR-MOVE-001' | 'BR-MOVE-002' | 'BR-MOVE-003' | 'BR-MOVE-004' | 'BR-MOVE-005'
     // Business rules (capture)
     | 'BR-CAPTURE-001' | 'BR-CAPTURE-002' | 'BR-CAPTURE-003'
     // Business rules (stack)
     | 'BR-STACK-001' | 'BR-STACK-002' | 'BR-STACK-003' | 'BR-STACK-004'
     | 'BR-STACK-005' | 'BR-STACK-006'
     // Business rules (arata)
     | 'BR-ARATA-001' | 'BR-ARATA-002' | 'BR-ARATA-003' | 'BR-ARATA-004'
     | 'BR-ARATA-005' | 'BR-ARATA-006' | 'BR-ARATA-007'
     // Business rules (action / play / game / turn)
     | 'BR-ACTION-001' | 'BR-ACTION-002'
     | 'BR-PLAY-002'
     | 'BR-GAME-004'
     // GAN S-codes
     | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'
     // GSFEN V-codes
     | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7'
     // Internal / defensive (document as such)
     | 'INTERNAL-DEFENSIVE';
   ```
   (Adjust the list by grepping every `new GameError(..., '<rule>')` call — every literal that appears must be in the union; anything not in the union must be renamed or removed before this change lands.)
3. Change `GameError` line 11 from `rule: string;` to `rule: GameRule;`.
4. Change the constructor signature (line 16) from `rule: string` to `rule: GameRule`.
5. Do the same for `IllegalActionError` constructor (line 30).
6. Run `docker compose run --rm check`. The compiler will now surface every place where a non-literal rule string was used (e.g., a `string` variable, a misspelled rule code, or an invented rule). Fix each one — either by using a literal, or by removing the invented rule (see C1), or by adding the missing literal to the union (if legitimate).
7. Iterate until `tsc --noEmit` is clean.
8. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B2

After the fix, scan for other **stringly-typed vocabulary** in the domain model:

1. Search for every exported `type` or `interface` in `oracle/src/` whose domain is a closed set (e.g., piece types, player names, phase names, action kinds, outcome kinds).
2. For each one, confirm it is a literal union (not `string`).
3. For any `string` or `string | ...` that should be closed, convert it to a literal union.
4. Record findings under "B2 follow-up".

---

## Problem B3 — Near-dead discriminator; fully dead error subclass

**Finding (from review):** `GameErrorKind` is only ever set to `'self-check'` (twice); everything else defaults to `'general'`. `IllegalActionError` is never thrown anywhere in Step 8.

### Affected files and exact lines

- `oracle/src/errors.ts` lines 3, 13-14, 24-42
- `oracle/src/game/battle.ts` lines 237-240 and 357-360 (the only two `kind: 'self-check'` sites)

### Fix strategy

Two options:

**Option A — Populate:** Define meaningful `GameErrorKind` values (e.g., `'phase' | 'position' | 'hand' | 'target' | 'outcome' | 'self-check' | 'turncoat' | 'terminal'`) and assign each `new GameError(...)` a specific kind. Keep `IllegalActionError` — even if it's not thrown yet, document that Step 10 will throw it for terminal-condition violations.

**Option B — Remove:** Delete the `kind` field and `GameErrorKind` type. Delete `IllegalActionError` entirely (it's dead code). Consumers distinguish errors by `error.rule` alone.

**Recommendation:** Option B, unless there is a documented future use for `kind`. The oracle's stated principle is "naive, absolutely explicit" — a field that only ever says `'self-check'` vs `'general'` is not adding information. If Step 10 needs `IllegalActionError`, reintroduce it then with a clear contract.

### Fix steps (assuming Option B)

1. Open `oracle/src/errors.ts`.
2. Delete the `GameErrorKind` type definition (line 3).
3. Remove the `kind` field from `GameError` (lines 13-14).
4. Remove the `kind` parameter from the `GameError` constructor (line 16) and the assignment in the body (line 20).
5. Delete the `IllegalActionError` class entirely (lines 24-42).
6. Open `oracle/src/game/battle.ts`.
7. At lines 237-240 and 357-360, remove the third argument `{ kind: 'self-check' }` from the two `new GameError(...)` calls. The calls now take only `(message, rule)`.
8. Search the entire `oracle/src/` and `oracle/tests/` for any remaining references to `GameErrorKind`, `IllegalActionError`, or `kind:` used with `GameError`. Remove each one.
9. Update `oracle/src/index.ts` if it re-exports `IllegalActionError` (currently it does via `export * from './errors.js'`). After deletion, the wildcard re-export is fine.
10. Run `docker compose run --rm check`. Expect `exit 0`.
11. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B3

After the fix, scan for other **dead type surface** in the domain model:

1. For every exported `class`, `type`, `interface`, or `enum` in `oracle/src/`, use `tsc --noEmit` plus a grep-for-references search to confirm each one is referenced from at least one other file.
2. For each unreferenced symbol: delete it, or document why it is exported (e.g., for a planned future step). If the latter, add a JSDoc `@planned Step N` tag.
3. Record findings under "B3 follow-up".

---

## Problem C4 — Dead check with a mis-cited rule in `validateArata`

**Finding (from review):** The `piece === 'M'` rejection at `oracle/src/game/battle.ts:293-300` is unreachable in legal play (the battle-phase Marshal is never in hand per BR-DEPLOY-011, and the hand check fires first). It cites `BR-ARATA-007`, which governs placing *onto* a Marshal, not arata-ing the Marshal piece. Correct citations are GAN S4 / BR-DEPLOY-011.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 293-300

### Fix steps

1. Open `oracle/src/game/battle.ts`.
2. Locate the block at lines 293-300:
   ```ts
   // Marshal cannot be in hand during battle phase (BR-DEPLOY-011),
   // but check explicitly per BR-ARATA-007
   if (piece === 'M') {
     return {
       ok: false,
       error: new GameError('Cannot arata a Marshal', 'BR-ARATA-007'),
     };
   }
   ```
3. Decide whether to keep or remove this defensive check:
   - **Remove it:** The prior `hand[piece] < 1` check (line 286) already catches this case — if the Marshal is not in hand, `hand['M']` is 0 and the first check fires. Remove lines 292-300 entirely.
   - **Keep it as defensive:** If the project policy is "every validator explicitly rejects every illegal piece regardless of upstream filters," keep it — but fix the rule citation.
4. If keeping, fix the citation and add a `@defensive` marker:
   ```ts
   // Defensive: Marshal is never in hand during battle phase (BR-DEPLOY-011).
   // The hand-check above catches this case; this branch is unreachable in legal play
   // but preserved so that a future state-corruption bug surfaces here, not at the
   // downstream stack-placement check.
   if (piece === 'M') {
     return {
       ok: false,
       error: new GameError('Cannot arata a Marshal', 'BR-DEPLOY-011'),
     };
   }
   ```
5. If removing, delete the entire 8-line block.
6. Update the JSDoc checklist on `validateArata` (lines 253-261) accordingly — remove or adjust step 1's parenthetical "(and not Marshal)".
7. If a test asserts this specific error message/rule, update or remove that test.
8. Run `docker compose run --rm check`. Expect `exit 0`.
9. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for C4

After the fix, scan for other **defensive checks with wrong or misleading rule citations**:

1. List every `if (...)` block in every validator that rejects a case that is provably unreachable from the preceding checks.
2. For each one, read the cited rule string and verify that the cited rule actually covers the case.
3. For each defensive check, decide: keep it with an honest citation and a `@defensive`/`defensive-only` JSDoc marker, or remove it.
4. Pay special attention to cases where a rule about *placing onto X* is cited to reject *placing X itself* (the C4 pattern).
5. Record findings under "C4 follow-up".

---

## Problem A7 — Turncoat rejection tests cite a rule the action doesn't violate

**Finding (from review):** Guard tests assert non-empty turncoat is rejected with rule `BR-STACK-006`. The action may be perfectly legal per BR-STACK-006 — it is merely *unimplemented*. Citing a rule as violated when it isn't misinforms consumers of the error domain.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 211-217 (Move turncoat rejection)
- `oracle/src/game/battle.ts` lines 345-351 (Arata turncoat rejection)
- Tests in `oracle/tests/game/battle.test.ts` that assert `error.rule === 'BR-STACK-006'` on the turncoat guard

### Fix steps

1. Open `oracle/src/game/battle.ts`.
2. At line 215, change the rule citation from `'BR-STACK-006'` to an honest marker. Two options:
   - Use a dedicated internal marker (add `'UNIMPLEMENTED-TURNCOAT'` to the `GameRule` union from B2).
   - Or use a comment and remove the citation — throw a plain `Error` instead of a `GameError` for unimplemented features.
3. Apply the same change at line 349.
4. Recommended wording for the new error message: `"Turncoat validation is not yet implemented (Step 10) — any non-empty turncoat is rejected defensively."`
5. Update any test that asserted `error.rule === 'BR-STACK-006'` on these sites to assert the new marker instead.
6. In the test descriptions, change any phrasing that says "violates BR-STACK-006" to "is unimplemented" or "defensively rejected".
7. Run `docker compose run --rm check`. Expect `exit 0`.
8. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for A7

After the fix, scan for other **rule citations that describe unimplemented features as violations**:

1. Search for every `GameError` whose message contains "not yet implemented", "Step N", or "TODO".
2. For each one, confirm the cited rule is not being misrepresented as "violated".
3. Rename or re-mark such errors so that consumers can distinguish "violated BR-xxx" from "feature not yet implemented".
4. Record findings under "A7 follow-up".

---

## Problem C3 — Outcome semantics implemented twice

**Finding (from review):** `oracle/src/board/movement.ts:68-75` (`determineOutcome`) and `oracle/src/game/battle.ts:26-73` (`validateOutcome`) compute the same outcome logic. Two sources of truth — drift would be silent. Also, the `movement.ts` doc comment has drifted from the code.

### Affected files and exact lines

- `oracle/src/board/movement.ts` lines 68-75 (`determineOutcome`) and its doc comment
- `oracle/src/game/battle.ts` lines 26-73 (`validateOutcome`)

### Fix strategy

Make `validateOutcome` consume the `LegalMove.outcome` field that the movement engine already computed, instead of re-deriving the logic.

### Fix steps

1. Open `oracle/src/board/movement.ts`.
2. Locate `determineOutcome` (around line 68-75) and confirm its return type.
3. Confirm that `getLegalDestinations` produces `LegalMove` objects with an `outcome` field (one of `'stack' | 'capture' | null`).
4. Fix the stale doc comment in `movement.ts` (the one claiming the validator rejects only "friendly Marshal" — it actually also rejects enemy-Marshal landings per battle.test.ts:250). Update the comment to accurately reflect what the validator does.
5. Open `oracle/src/game/battle.ts`.
6. In `validateMove`, after finding `matchingMove` (line 193), pass `matchingMove.outcome` directly to a new helper, or replace `validateOutcome` with a much smaller check:
   ```ts
   // Compare the action's declared outcome against the engine-computed outcome.
   if (action.outcome !== matchingMove.outcome) {
     // Determine which rule to cite based on the reason for mismatch.
     // ... (preserve existing error messages and rule citations)
   }
   ```
7. Alternatively, if the goal is to keep `validateOutcome`'s error-message granularity, rewrite it to accept a `LegalMove` and a `actionOutcome` (instead of re-reading `targetStack`).
8. Whichever path is chosen, delete the duplicated logic in `validateOutcome` that re-derives `captureForced = targetSize === 3 || targetTop.type === 'M'`.
9. Run `docker compose run --rm check`. Expect `exit 0`.
10. Run `docker compose run --rm test`. Expect `727/727`. Pay special attention to the outcome-canonicity tests — they should still pass without modification.

### Similar-problem scan for C3

After the fix, scan for other **logic duplicated between the movement/attack engine and the validators**:

1. For every function in `oracle/src/board/` that computes a semantic outcome (reachability, outcome, attack), search for the same computation in `oracle/src/game/`.
2. For each duplicate, decide: (a) the engine is the source of truth and the validator should consume its output, or (b) the validator has an independent reason to re-compute (e.g., a different rule scope) — in which case document why.
3. Record findings under "C3 follow-up".

---

## Problem C5 — `validateMove` JSDoc lists checks it does not perform

**Finding (from review):** The header lists "2. BR-MOVE-001" and "4. BR-MOVE-005" as steps, both "implied by `getLegalDestinations`". For an oracle, the doc should distinguish *enforced here* from *enforced upstream at seam X*.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 136-152 (JSDoc on `validateMove`)

### Fix steps

1. Open `oracle/src/game/battle.ts`.
2. Rewrite the JSDoc checklist to distinguish enforced-here vs enforced-upstream:
   ```ts
   /**
    * Validate a Move action against the current GameState.
    *
    * Checks performed here (in order):
    *   0. Phase must be 'battle' (BR-PLAY-002)
    *   1. BR-MOVE-002: Origin contains player's own piece
    *   2. BR-MOVE-003: Destination is reachable (calls movement.ts)
    *   3. Outcome validation (BR-STACK-002/003/004, BR-CAPTURE-001/002/003)
    *   4. BR-STACK-006: Turncoat (defensively rejected until Step 10)
    *   5. BR-STACK-004: No stacking on Marshal
    *   6. BR-ACTION-002: Self Check — own Marshal not under attack after move
    *
    * Rules enforced upstream (not checked here):
    *   - BR-MOVE-001 (piece is top of its stack): enforced by
    *     `getLegalDestinations` in `board/movement.ts`. If the piece is not
    *     the top of its stack, no legal destination is returned.
    *   - BR-MOVE-005 (stack size landing restriction): enforced by
    *     `getLegalDestinations` in `board/movement.ts`, which filters out
    *     oversized friendly targets before this validator sees them.
    *
    * @param state - Current GameState.
    * @param action - The Move action to validate.
    * @returns PlayValidation with speculativeState on success.
    */
   ```
3. Save the file.

### Similar-problem scan for C5

After the fix, scan for other **validator JSDocs that list rules as checked when they are actually enforced upstream**:

1. For every validator function JSDoc in `oracle/src/game/` and `oracle/src/gan/` and `oracle/src/gsfen/`, read the checklist.
2. For each listed rule, confirm the code actually enforces it.
3. If a rule is enforced upstream, move it to a separate "enforced upstream" section with the specific seam named.
4. Record findings under "C5 follow-up".

---

## Problem C6 — Marshal-first inferred from hand contents — two strategies for one rule

**Finding (from review):** `oracle/src/game/deploy.ts:91-99` uses `hand.M === 1` to mean "Marshal not yet placed." `oracle/src/gsfen/validate.ts` (V3) implements the same rule by scanning the board. Two inference strategies for one rule.

### Affected files and exact lines

- `oracle/src/game/deploy.ts` lines 91-99
- `oracle/src/gsfen/validate.ts` — V3 block (lines 72-138)

### Fix steps

1. Open `oracle/src/board/board.ts` (or a new helper module `oracle/src/board/marshal.ts`).
2. Add a single, well-named helper that answers the direct question:
   ```ts
   /**
    * Returns true iff the given player's Marshal has already been placed on the board.
    *
    * Canonical implementation of BR-DEPLOY-003 (Marshal-first) and BR-DEPLOY-011.
    *
    * @param position - The board position.
    * @param player - The player to check.
    */
   export function hasPlacedMarshal(position: BoardPosition, player: Player): boolean {
     return countPieceOnBoard(position, 'M', player) >= 1;
   }
   ```
   (Where `BoardPosition` is the type of `state.position` — adjust to match the existing type name.)
3. Open `oracle/src/game/deploy.ts`.
4. Replace the indirect check at lines 94-99:
   ```ts
   if (hand.M === 1) {
     return {
       ok: false,
       error: new GameError(`Must place Marshal before placing other pieces`, 'BR-DEPLOY-003'),
     };
   }
   ```
   with:
   ```ts
   if (!hasPlacedMarshal(state.position, player)) {
     return {
       ok: false,
       error: new GameError(`Must place Marshal before placing other pieces`, 'BR-DEPLOY-003'),
     };
   }
   ```
5. Add the import at the top of `deploy.ts`.
6. Open `oracle/src/gsfen/validate.ts`.
7. In the V3 block, replace the board-scan logic that answers "is the Marshal placed" with the same `hasPlacedMarshal` call.
8. Save all files.
9. Run `docker compose run --rm check`. Expect `exit 0`.
10. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for C6

After the fix, scan for other **rules inferred by two different strategies** across the codebase:

1. List every BR-xxx code that is enforced in more than one file.
2. For each, read the enforcement code in each file and ask: "Do both implementations answer the same direct question, or do they use different indirect inferences?"
3. For each divergence, extract a shared helper that answers the direct question.
4. Record findings under "C6 follow-up".

---

## Problem C7 — Noise in `apply.ts`

**Finding (from review):** `{ ...state.turn, done: state.turn.done }` re-copies a field the spread already copies; `([...cell] as const) as typeof cell` is a double cast fighting the tuple type.

### Affected files and exact lines

- `oracle/src/game/apply.ts` lines 34-45

### Fix steps

1. Open `oracle/src/game/apply.ts`.
2. At line 39, replace `{ ...state.turn, done: state.turn.done }` with `{ ...state.turn }`. The redundant `done` field re-copy does nothing.
3. At line 37, replace `([...cell] as const) as typeof cell` with a cleaner approach:
   - If `cell` is a readonly tuple and you want a mutable copy: `[...cell]` may be sufficient if the target type accepts a readonly array.
   - If you truly need to coerce the type, use a single explicit cast: `[...cell] as Piece[]` (where `Piece[]` is the tuple element type) — but first verify the target type accepts this.
   - Read `board/board.ts` to understand the `Stack` type and decide the cleanest way to clone it.
4. Save the file.
5. Run `docker compose run --rm check`. Expect `exit 0`.
6. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for C7

After the fix, scan for other **code noise** in the codebase:

1. Search for patterns: redundant spreads (`{ ...x, field: x.field }`), double casts (`as X as Y`), no-op statements, commented-out code blocks, TODO comments older than the current step.
2. For each, remove or simplify.
3. Record findings under "C7 follow-up".

---

## Problem C8 — Documented invention: Arata zone with no board pieces

**Finding (from review):** The collapse-to-own-edge behavior at `oracle/src/game/battle.ts:85-89` is invented (BR-ARATA-003 is silent) but documented and unreachable in legal play.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 85-89

### Fix steps

1. Open `oracle/src/game/battle.ts`.
2. Read the JSDoc on `getArataZone` (lines 75-89).
3. Add a one-line note that the collapse behavior is an invention, explicitly flagged:
   ```ts
   * INVENTION: BR-ARATA-003 does not specify behavior when the player has no
   * board pieces. The zone collapses to the player's own edge row only.
   * This case is unreachable in legal play (the first action must be a
   * deploy placement, which places the Marshal on the board).
   ```
4. Optionally, propose a BR clarification (out of scope for this refinement — record as a spec suggestion in a "C8 follow-up" subsection).
5. Save the file.

### Similar-problem scan for C8

After the fix, scan for other **documented inventions** in the codebase:

1. Search for comments containing "unreachable", "cannot happen", "defensive", "in practice", "should never".
2. For each, confirm the comment documents an invention (not a BR rule) and the invention is flagged as such.
3. Record findings under "C8 follow-up".

---

## Problem B4 — Three `ValidationResult` definitions coexist

**Finding (from review):** `oracle/src/game/validation.ts:23`, `oracle/src/gan/validate.ts:23`, `oracle/src/gsfen/validate.ts:22` all define the same type.

### Affected files and exact lines

- `oracle/src/gan/validate.ts` line 23
- `oracle/src/gsfen/validate.ts` line 22
- (canonical definition is already in `oracle/src/game/validation.ts` line 23)

### Fix steps

1. Open `oracle/src/gan/validate.ts`.
2. Delete line 23 (`export type ValidationResult = ...`).
3. Add an import at the top: `import type { ValidationResult } from '../game/validation.js';`.
4. Add a re-export at the same location: `export type { ValidationResult };` (so that external consumers of `gan/validate` are not broken).
5. Open `oracle/src/gsfen/validate.ts`.
6. Delete line 22 (`export type ValidationResult = ...`).
7. Add an import at the top: `import type { ValidationResult } from '../game/validation.js';`.
8. Add a re-export: `export type { ValidationResult };`.
9. Run `docker compose run --rm check`. Expect `exit 0`. If `index.ts` now has a duplicate `ValidationResult` re-export (via `export * from './gsfen/validate.js'` and `export type { ValidationResult } from './game/validation.js'`), resolve the conflict by making `index.ts` re-export `ValidationResult` exactly once — prefer the `game/validation.js` source.
10. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B4

After the fix, scan for other **duplicated type definitions** across the codebase:

1. List every `export type` and `export interface` in every module under `oracle/src/`.
2. For each, search for other files that define a type/interface with the same name and the same shape.
3. For each duplicate, migrate to the canonical definition (or create one if none exists).
4. Record findings under "B4 follow-up".

---

## Problem B5 — Validators re-check `kind` at runtime; `Extract` variants go unused

**Finding (from review):** `validatePlay` dispatches on `action.kind`, making per-validator `kind` checks redundant internally. `apply.ts` defines `MoveAction`/`ArataAction` via `Extract` — but the validators don't use them.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 153-159, 266-272 (redundant kind checks)
- `oracle/src/game/apply.ts` lines 23-27 (`Extract`-defined types, currently unused by validators)
- `oracle/src/game/deploy.ts` lines 57-63 (redundant kind check)

### Fix steps

1. Decide on a policy:
   - **Internal-flow policy:** Validators trust the dispatch from `validatePlay`/`validateAction` and do not re-check `kind`. Their signatures take `MoveAction`/`ArataAction`/`PlacementAction` directly.
   - **Public-API defense policy:** Validators accept `Action` and re-check `kind` to defend against direct callers who skip `validatePlay`.
2. Pick one and apply consistently:
   - If **internal-flow**: Change `validateMove(state, action: Action)` to `validateMove(state, action: MoveAction)` (import `MoveAction` from `apply.ts` or define it in a shared location). Delete the kind check at line 154-159. Do the same for `validateArata` and `validatePlacement`. Move `MoveAction`/`ArataAction`/`PlacementAction` to a shared types module if they need to be shared.
   - If **public-API defense**: Delete the unused `Extract` types from `apply.ts` (or move them to a types module for future use) — keeping them in `apply.ts` when no one uses them is noise.
3. Apply the chosen policy consistently across all three validators.
4. Save all files.
5. Run `docker compose run --rm check`. Expect `exit 0`.
6. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B5

After the fix, scan for other **inconsistent runtime-vs-compile-time dispatch** patterns:

1. For every discriminated union in `oracle/src/`, find every function that switches on its discriminator.
2. For each switch site, confirm the function's signature either takes the narrowed variant (compile-time) or re-checks the discriminator (runtime defense) — but not a mix.
3. Record findings under "B5 follow-up".

---

## Problem B6 — Cast-policy inconsistency in `getArataZone`

**Finding (from review):** Two inline `(r + 1) as BoardCoord` casts in `oracle/src/game/battle.ts:100, 119`. The codebase's stated policy confines `as BoardCoord` casts to audited helpers.

### Affected files and exact lines

- `oracle/src/game/battle.ts` lines 100, 119

### Fix steps

1. Open `oracle/src/board/board.ts`.
2. Locate the existing `squareFromIndex` helper (mentioned in the review as the audited cast site).
3. Add a sibling helper `boardCoordFromRowIndex(r: number): BoardCoord` (or similar) that performs the `r + 1` conversion with a single audited `as BoardCoord` cast:
   ```ts
   /**
    * Convert a 0-indexed row index to a 1-indexed BoardCoord.
    *
    * AUDITED CAST SITE: the only place where `as BoardCoord` is used for
    * this specific conversion. All other code should call this helper.
    */
   export function boardCoordFromRowIndex(r: number): BoardCoord {
     return (r + 1) as BoardCoord;
   }
   ```
4. Open `oracle/src/game/battle.ts`.
5. At line 100, replace `const row = (r + 1) as BoardCoord;` with `const row = boardCoordFromRowIndex(r);`.
6. At line 119, do the same.
7. Add the import at the top of `battle.ts`.
8. Search the entire `oracle/src/` for other `as BoardCoord` casts outside of the audited helpers. For each one, either:
   - Replace it with a call to the appropriate audited helper, or
   - Add it to the audited-helper module with a clear comment.
9. Save all files.
10. Run `docker compose run --rm check`. Expect `exit 0`.
11. Run `docker compose run --rm test`. Expect `727/727`.

### Similar-problem scan for B6

After the fix, scan for other **cast-policy violations**:

1. Search for every `as <SomeType>` cast in `oracle/src/`.
2. For each one, confirm it is either in an audited helper (with a comment explaining why the cast is safe) or replaceable with a helper call.
3. For any un-audited cast, either move it to an audited helper or eliminate it by restructuring the code.
4. Record findings under "B6 follow-up".

---

## Problem A1 — Illegal-state fixture makes an acceptance test validate the unreachable

**Finding (from review):** `oracle/tests/game/deploy.test.ts:99-106` encodes stack `4,MP,4` (Marshal at bottom, Pawn on top). GSFEN stacks read bottom→top, so this violates BR-STACK-004. `validateState` rejects it with `V3` (PROBE-1).

### Affected files and exact lines

- `oracle/tests/game/deploy.test.ts` lines 99-106
- Possibly `oracle/tests/game/deploy.test.ts` (the `gsfenState()` helper) — consider running `validateState` inside the helper.

### Fix steps

1. Open `oracle/tests/game/deploy.test.ts`.
2. Locate the test at lines 99-106:
   ```ts
   it('accepts placement on friendly stack under size 3 (BR-DEPLOY-005)', () => {
     const state = gsfenState(`
       ...
       4,MP,4
       ...
     `);
     // ...
   });
   ```
3. The test intent is to assert that a placement onto a friendly stack of size 2 is accepted. The stack must NOT contain a Marshal at the bottom (which is illegal per BR-STACK-004).
4. Replace `4,MP,4` with a legal stack that still has size 2 and is friendly. Use e.g., `SP` (Soldier bottom, Pawn on top) or any non-Marshal bottom piece. Pick two pieces that are in the player's hand and that preserve the rest of the test's intent.
5. Verify that the replacement stack is reachable (the pieces are in the player's hand initially, the position makes sense).
6. Ensure the test's expectation (acceptance) still holds with the new stack.
7. Optionally — and this is a broader improvement — modify the `gsfenState()` helper in this file (or in a shared test utility) to call `validateState()` after parsing. This way, any illegal fixture fails loudly at setup, not at the assertion.
   ```ts
   function gsfenState(gsfen: string): GameState {
     const state = parseGSFEN(gsfen);
     const validation = validateState(state);
     if (!validation.ok) {
       throw new Error(`Test fixture is an illegal game state: ${validation.error.message} (${validation.error.rule})`);
     }
     return state;
   }
   ```
8. Save the file.
9. Run `docker compose run --rm check`. Expect `exit 0`.
10. Run `docker compose run --rm test`. Expect the modified test to pass. The total may change slightly if other fixtures are also illegal (in which case, fix them too).

### Similar-problem scan for A1

After the fix, scan for other **test fixtures that encode illegal game states**:

1. Apply the `validateState()` check inside `gsfenState()` (as recommended above) across all test files.
2. Run the test suite. Every test whose fixture is illegal will now throw at setup with a clear message.
3. For each illegal fixture: either fix it to a legal state, or document why the test intentionally uses an illegal state (and move it to a separate "invalid fixture" describe block).
4. Record findings under "A1 follow-up".

---

## Problem A2 — A test locks in behavior that contradicts BR-TURN-002

**Finding (from review):** `oracle/tests/game/battle.test.ts:439-440` asserts `afterState.turn.activePlayer === 'white'` after a Play. BR-TURN-002 requires the Active Player to pass to the Opponent after a Play.

### Affected files and exact lines

- `oracle/tests/game/battle.test.ts` lines 439-440

### Fix steps

1. Open `oracle/tests/game/battle.test.ts`.
2. Locate lines 439-440:
   ```ts
   // Active player should NOT be flipped (that's Step 10)
   expect(afterState.turn.activePlayer).toBe('white');
   ```
3. The correct action depends on project policy:
   - **Option A (delete):** Remove the assertion and its comment entirely. Step 10 will add a new test for the flip.
   - **Option B (invert + mark):** Convert to a `it.todo('BR-TURN-002: active player passes to opponent after Play (Step 10)')` — this documents the gap in the suite.
   - **Option C (fails marker):** If the test framework supports `it.fails`, convert to that — the test documents the expected behavior and fails until Step 10 implements it.
4. Recommended: **Option B** (a `todo` entry with a BR citation). This is the most honest: the suite visibly documents what Step 10 will add, without cementing wrong behavior.
5. Apply the change.
6. Save the file.
7. Run `docker compose run --rm check`. Expect `exit 0`.
8. Run `docker compose run --rm test`. Expect the suite to still pass (the todo test is not counted as a failure).

### Similar-problem scan for A2

After the fix, scan for other **test assertions that lock in incomplete/deferred behavior**:

1. Search for every test comment containing "Step N", "TODO", "that's Step N", "deferred", "not yet".
2. For each, read the adjacent assertion and ask: "Does this assertion describe the final correct behavior, or the current incomplete behavior?"
3. For every assertion that locks in current-incomplete behavior: convert to `todo`, delete, or convert to `fails` with a BR citation.
4. Record findings under "A2 follow-up".

---

## Problem A3 — Mislabeled coverage: BR-MOVE-005 has no test at the validation seam

**Finding (from review):** `oracle/tests/game/battle.test.ts:206-219` describe-block is labeled "BR-MOVE-005 — stack size landing restriction" but the assertion checks `error.rule === 'BR-MOVE-003'` (reachability). The movement engine filters oversized targets before `validateMove` ever sees them.

### Affected files and exact lines

- `oracle/tests/game/battle.test.ts` lines 206-219

### Fix steps

1. Open `oracle/tests/game/battle.test.ts`.
2. Locate the describe block at lines 206-219.
3. Two options:
   - **Rename + re-document:** Change the describe title to "stack size landing restriction — enforced at movement seam, not validation seam (BR-MOVE-005)". Add a comment inside explaining that BR-MOVE-005 is enforced by `getLegalDestinations`, not by `validateMove`, and that this test proves the *reachability* consequence, not the stack-size rule itself.
   - **Move the test:** If the movement module has its own test file, move this test to that file and label it as a BR-MOVE-005 test there. In the battle test file, remove the misleading describe.
4. Recommended: **Rename + re-document** (minimal disruption, honest documentation).
5. Apply the change.
6. Save the file.
7. Run `docker compose run --rm test`. Expect `727/727` (or the new total if A1 changed it).

### Similar-problem scan for A3

After the fix, scan for other **mislabeled test coverage** in the suite:

1. For every `describe('BR-xxx')` or `it('... BR-xxx ...')` in every test file, read the assertion and confirm the asserted rule code matches the describe title.
2. For every mismatch, either rename the test or move it to the correct file.
3. Specifically look for tests whose assertion's rule code differs from the test description's rule code.
4. Record findings under "A3 follow-up".

---

## Problem A4 — Assertions coupled to check ordering, not just behavior

**Finding (from review):** `oracle/tests/game/battle.test.ts:312-319` (pattern repeats across both files) assert a specific `error.rule` when multiple rules could legitimately reject the same action. The business rules define no error precedence.

### Affected files and exact lines

- `oracle/tests/game/battle.test.ts` lines 312-319 and similar sites
- `oracle/tests/game/deploy.test.ts` (similar sites)

### Fix steps

1. Open `oracle/tests/game/battle.test.ts`.
2. Locate every assertion of the form:
   ```ts
   expect(error.rule).toBe('BR-xxx');
   ```
   where the test description says something like "(BR-xxx fires first — not in hand)" or similar precedence-coupled language.
3. For each such assertion, decide whether the rule code being asserted is the *only legitimate rejection* or just the first one the implementation happens to return:
   - If only one rule legitimately rejects the action, keep the assertion — it's testing behavior, not ordering.
   - If multiple rules could legitimately reject, change the assertion to just check `expect(result.ok).toBe(false)` and remove the `error.rule` check. Update the test description to say "rejects" without naming a specific precedence.
4. Apply changes to all affected tests.
5. Save all files.
6. Run `docker compose run --rm test`. Expect `727/727` (or the new total).

### Similar-problem scan for A4

After the fix, scan for other **precedence-coupled assertions** in the suite:

1. Search for every `error.rule ===` assertion in test files.
2. For each, ask: "If the validator reordered its checks, would this assertion still pass?"
3. If the answer is "no" and the reordering would still produce correct behavior, loosen the assertion (remove the rule-code check, or replace with a set-membership check if a set of valid rejections exists).
4. Record findings under "A4 follow-up".

---

## Problem A5 — Behavioral coverage gaps at the new seam

**Finding (from review):** Missing negative Self-Check tests for Arata and Move; missing BR-CAPTURE-003 test through `validateMove` with an enemy target; Arata zone tested only for White.

### Affected files and exact lines

- `oracle/tests/game/battle.test.ts` (add new tests)

### Fix steps

1. Open `oracle/tests/game/battle.test.ts`.
2. Add the following tests, each with a clear BR citation:
   - **Negative Self-Check for Arata (BR-ACTION-002):** Construct a battle-phase state where the active player's Marshal is already in check. Perform an Arata that does NOT resolve the check. Assert the result is rejected with `error.rule === 'BR-ACTION-002'`. (PROBE-4 confirmed the code handles this correctly; only the test is missing.)
   - **Negative Self-Check for Move (BR-ACTION-002):** Construct a battle-phase state where the active player's Marshal is in check. Perform a Move that does NOT resolve the check. Assert rejection with `BR-ACTION-002`. (PROBE-6 confirmed this path works.)
   - **BR-CAPTURE-003 via validateMove with enemy target:** Construct a state where the source stack size is less than the target enemy stack size. Assert `validateMove` rejects the move. (Currently only a friendly-target test exists, asserting BR-MOVE-003.)
   - **Black-side Arata zone:** Construct a battle-phase state with Black to move and Black pieces on the board. Assert that an Arata outside Black's zone (row > most advanced Black piece's row) is rejected with `BR-ARATA-003`, and an Arata inside the zone is accepted. (White-side zone is tested; Black is not.)
3. For each test, use a clear, legal fixture (run it through `validateState` if the helper is available).
4. Save the file.
5. Run `docker compose run --rm check`. Expect `exit 0`.
6. Run `docker compose run --rm test`. Expect the new tests to pass, bringing the total above 727.

### Similar-problem scan for A5

After the fix, scan for other **behavioral coverage gaps** in the suite:

1. For every BR-xxx code cited in the validators, search for at least one test that exercises it.
2. For every BR-xxx code with zero tests, write a test.
3. For every validator branch that is not exercised by any test, write a test.
4. Record findings under "A5 follow-up".

---

## Problem A6 — Duplicated / weak assertions

**Finding (from review):** `battle.test.ts:215` "accepts move to empty square (trivially passes)" duplicates the same fixture+action asserted twice earlier (lines 143, 151). Other "accepts" cases repeat identical inputs under different describes.

### Affected files and exact lines

- `oracle/tests/game/battle.test.ts` lines 143, 151, 215 (and similar sites)

### Fix steps

1. Open `oracle/tests/game/battle.test.ts`.
2. Locate lines 143, 151, 215 and identify the duplicated fixtures+assertions.
3. Delete the redundant duplicate(s). Keep the one that is in the most contextually appropriate describe block.
4. Search for other duplicated accepts cases across both test files.
5. For each duplicate: delete it, or (if the repetition is intentional for pedagogical reasons) add a comment saying "intentionally duplicated — see also line N".
6. Save the files.
7. Run `docker compose run --rm test`. Expect the total to decrease by the number of removed duplicates. Confirm all remaining tests pass.

### Similar-problem scan for A6

After the fix, scan for other **duplicated test content** in the suite:

1. For every test file, list the test descriptions.
2. For each description that looks similar to another, compare the fixtures and assertions.
3. For each genuine duplicate, delete or consolidate.
4. Record findings under "A6 follow-up".

---

## Phase 16 — Final verification and cross-cutting similarity scan

After every individual fix and its "similar-problem scan":

1. Run `docker compose run --rm check`. Expect `exit 0`.
2. Run `docker compose run --rm test`. Expect the full suite to pass (count may differ from 727 due to added/removed tests).
3. Open this document and confirm every "follow-up" subsection has been populated.
4. For every follow-up finding, decide: fix in this refinement, defer to a future step, or reject.
5. If any follow-up finding is fixed in this refinement, add its fix to the appropriate section above and re-run verification.
6. Commit the entire refinement as a single logical commit with a clear message: "refine: fix step 8 review findings A1-A7, B1-B6, C1-C9".
