# Refining Plan — Gungi Oracle

A step-by-step plan addressing all 6 priorities from the oracle review
(`assets/oracle-review.html`). Each phase produces a passing test suite
before the next begins.

## Dependency Graph

```
Phase A ──→ Phase B ──→ Phase C ──→ Phase D
Foundation   Core arch   Polish      Verify
```

| Phase | Priorities | Risk | Est. files touched |
|-------|-----------|------|-------------------|
| A | P3 (fixtures) + P4 (GAN validation) | Low | ~8 |
| B | P1 (step function) + P2 (single rules) | High | ~6 |
| C | P5 (test cleanup) | Medium | ~10 |
| D | P6 (public API + docs) | Low | ~4 |

---

## Phase A — Foundation (safe, isolated)

### A1 — Move fixtures out of production code (P3)

**Problem:** `constants.ts` imports `STARTPOS_EXPANDED` from
`gsfen/fixtures.ts`, which uses `readFileSync` at module-load time — hidden
I/O that couples the engine to the filesystem and blocks browser use.

**Concrete steps:**

1. **Create `oracle/src/initialState.ts`** — a pure function that returns the
   initial `GameState` programmatically:
   ```typescript
   export function initialState(): GameState { … }
   ```
   - Builds the initial position (empty board, White turn, deploy phase,
     counter 1, full hands) using domain types only — zero I/O, zero imports
     from fixtures.
   - The review suggests `START_GSFEN` could derive from this, but we should
     keep `START_GSFEN` in `constants.ts` as a string constant (it's used
     by the CLI and as the default constructor arg).

2. **Replace `STARTPOS_EXPANDED` usage in `constants.ts`**:
   - `START_GSFEN` is already defined in `constants.ts` (as the `startpos`
     keyword). Verify the import of `STARTPOS_EXPANDED` is only for the
     `START_GSFEN` value. If so, just inline or derive the expanded form.
   - File: `oracle/src/constants.ts` — remove the `import { STARTPOS_EXPANDED }`.

3. **Move `gsfen/fixtures.ts` to `tests/support/fixtures.ts`**:
   - Move the file preserving its exports.
   - All test files that currently `import { … } from '../src/gsfen/fixtures.js'`
     need updating to the new path.
   - Create `tests/support/` directory if it doesn't exist.
   - The `FIXTURES` lookup record stays with the tests — it's test support.

4. **Update all test imports**:
   - Glob: `oracle/tests/**/*.ts` — replace fixture import paths.

5. **Verify**: `docker compose run --rm check && docker compose run --rm test`

**Files touched:** `oracle/src/constants.ts`, `oracle/src/initialState.ts`
(new), `oracle/src/gsfen/fixtures.ts` (moved), `oracle/tests/support/fixtures.ts`
(moved to), ~8 test files (import paths).

---

### A2 — Clean up GAN semantic validation (P4)

**Problem:** `gan/validate.ts` receives an unused `_gan` parameter, delegates
to game validators but adds no value, has dead code (checkDoneLegality always
returns ok), and has "stub" / "Step 4" comments.

**Concrete steps:**

1. **Remove `_gan` parameter** from `validateAction(…): ValidationResult`.
   - The GAN string is not needed — the parsed `Action` and `GameState`
     are sufficient.
   - File: `oracle/src/gan/validate.ts`

2. **Remove `checkDoneLegality`** — it always returns `{ ok: true }` and
   the comment admits it's enforced at parse time.

3. **Remove `checkTurncoatLegality`** — Turncoat validation lives fully in
   `battle.ts` (validateMove/validateArata). The GAN semantic validator
   should not duplicate it. If `BR-GAN-VALID-005` codes must be preserved,
   add a thin adapter in a separate file that calls game validators and
   maps error rules.

4. **Remove `checkPlacementLegality`, `checkMoveLegality`,
   `checkArataLegality`** — these are pure delegation to game validators
   with trivial wrapping. The GAN validator should only check parse-level
   concerns:
   - Phase match (VALID-001) — the one check that belongs at the GAN level
     (is a placement allowed in battle? is a move allowed in deploy?)

5. **Result:** `validateAction` becomes a thin function that checks phase
   match and delegates the rest. If BR-GAN-VALID-xxx codes are mandatory,
   create a single `mapGameErrorToGanCode(error): string` adapter.

6. **Verify**: `docker compose run --rm test` — GAN validate tests will
   need updating (remove tests for removed functions).

**Files touched:** `oracle/src/gan/validate.ts`, `oracle/src/index.ts` (if
exports change), `oracle/tests/gan/validate.test.ts`.

---

## Phase B — Core Architecture (high impact)

### B1 — Break circular dependency for rule deduplication (P2 prerequisite)

**Problem:** `terminal.ts` duplicates `getArataZone()`, inline move
simulation, and inline capture simulation — all because importing
`battle.ts` or `apply.ts` would create a cycle.

Current dependency cycle: `terminal.ts → (attack, movement, board, constants)`.
`battle.ts → apply.ts`. `apply.ts → terminal.ts` (via `evaluateExposure`).

Breaking the `apply.ts → terminal.ts` edge removes the cycle.

**Concrete steps:**

1. **Remove `evaluateExposure` call from `applyPlacement()`**:
   - File: `oracle/src/game/apply.ts` — remove `import { evaluateExposure }`
     and the exposure evaluation block (lines 156–165).
   - `applyPlacement` returns `{ state, result: 'ongoing' }` unconditionally
     for the deployment-complete transition. The deploy→battle transition
     still happens (turn state changes to battle); exposure evaluation moves
     to `step()` (B2).

2. **Move `getArataZone` to a shared module** (e.g., `game/arata.ts` or
   `board/board.ts`):
   - The function is identical in `terminal.ts` and `battle.ts` (except
     `battle.ts` returns `BoardCoord` typed range, `terminal.ts` uses
     plain `number`). Unify them.
   - Both modules import it from the shared location.

**Result:** `apply.ts` no longer imports `terminal.ts`. The cycle is broken:
  `terminal.ts → battle.ts → apply.ts` ✅ (no cycle back to terminal).

Now `terminal.ts` can import `battle.ts` (to use `validatePlay` instead
of duplicating simulation) without creating a cycle.

---

### B2 — Create pure `step()` function (P1)

**Problem:** `Game.applyAction()` returns `{ state, result }` on both
success and failure, requiring identity comparison to distinguish them.
No pure `state → action → result` entry point exists.

**Concrete steps:**

1. **Create `oracle/src/game/step.ts`**:

   ```typescript
   export type StepResult =
     | { ok: true; state: GameState; result: GameResult }
     | { ok: false; error: GameError };

   export function step(state: GameState, action: Action): StepResult;
   ```

   Logic:
   - If `result.kind !== 'ongoing'` → error: game already over.
   - If deploy phase → validate placement → apply → evaluate exposure on
     deploy→battle transition → check terminal → return.
   - If battle phase → validate play → apply (via speculative state) →
     check terminal → return.

2. **Refactor `Game.applyAction()` to delegate to `step()`**:
   - File: `oracle/src/game/game.ts`
   - `applyAction` calls `step(this.#state, action)`.
   - On `ok`: update `this.#state`, `this.#result`, append to history,
     return `{ state, result }`.
   - On `!ok`: return `{ state: this.#state, result: this.#result }`
     (unchanged, preserving the BR-ACTION-003 contract).
   - `#applyDeployAction` and `#applyBattleAction` become trivial or
     are inlined.

3. **Reconcile `evaluateExposure`** — now called from `step()` instead of
   `applyPlacement()`, at the deploy→battle transition point.

4. **Expose `step` in the public API**: add to `oracle/src/index.ts`.

5. **Verify**: `docker compose run --rm test` — all existing integration
   and unit tests pass unchanged (behavior is identical, just routed
   through `step()`).

**Files touched:** `oracle/src/game/step.ts` (new), `oracle/src/game/game.ts`,
`oracle/src/game/apply.ts`, `oracle/src/index.ts`.

---

### B3 — Deduplicate rule logic in `terminal.ts` (P2)

**Problem:** `hasLegalPlays()` in `terminal.ts` simulates moves and aratas
inline (isMoveSafe, isCaptureSafe, getArataZone, hand/zone iteration)
instead of using the same validators used by the public API.

**Concrete steps:**

1. **Replace inline move simulation with `validatePlay()`**:
   - File: `oracle/src/game/terminal.ts`
   - Remove `isMoveSafe()`, `isCaptureSafe()`.
   - Import `validatePlay` from `battle.ts` (no longer a cycle — B1
     broke it).
   - Replace inline move checks:
     ```typescript
     // Before:
     if (isMoveSafe(state.position, origin, move.dest, player)) return true;

     // After:
     const action: Action = { kind: 'move', origin, dest: move.dest, outcome: null, turncoat: [] };
     if (validatePlay(state, action).ok) return true;
     ```

2. **Replace inline arata simulation with `validatePlay()`**:
   - Remove inline arata zone check, destination checks, Self Check
     simulation.
   - Use `validatePlay` instead:
     ```typescript
     const action: Action = { kind: 'arata', piece: pt, dest, turncoat: [] };
     if (validatePlay(state, action).ok) return true;
     ```

3. **Remove `getArataZone` from `terminal.ts`** — it now lives in the
   shared module (B1.2), imported by both `terminal.ts` and `battle.ts`.

4. **Result:** `hasLegalPlays()` becomes ~15 lines that leverage the same
   validation pipeline as `Game.legalActions`. Four hundred lines of
   duplicated logic are removed from `terminal.ts`.

5. **Verify**: `docker compose run --rm test` — terminal tests should
   exercise the same scenarios; now they go through `validatePlay`.

**Files touched:** `oracle/src/game/terminal.ts`, `oracle/src/game/battle.ts`
(possibly), `oracle/src/game/validation.ts` (new shared arata module).

---

### B4 — Clean up `Game` class surface after refactor

**Problem:** After B2 and B3, the `Game` class may have dead private
methods (`#legalPlacements`, `#legalPlays`, `#applyDeployAction`,
`#applyBattleAction`) that were once the primary logic but now delegate
to `step()`.

**Concrete steps:**

1. **Audit `Game` private methods**:
   - `#legalPlacements()` and `#legalPlays()` — keep them; they're the
     legal-action enumeration logic that belongs on the class.
   - `#applyDeployAction` and `#applyBattleAction` — become trivially
     delegating to `step()`. Either inline them into `applyAction()` or
     keep for clarity.

2. **Clean up `DEPLOY_ZONE` helper** — keep in game.ts since it's only
   used by `#legalPlacements()`.

**Files touched:** `oracle/src/game/game.ts`.

---

## Phase C — Polish and Simplify

### C1 — Simplify and shrink tests (P5)

**Problem:** 811 tests in 9,213 lines. Some test what the compiler already
guarantees. States are often assembled via GSFEN, obscuring rule intent.

**Concrete steps:**

1. **Trim `types.test.ts`** significantly:
   - Remove tests that check TypeScript-level properties the compiler
     enforces (e.g., `Player` is `'white' | 'black'`, `BoardCoord` is
     `1..9`, `Stack` length constraints).
   - Keep at most 3–5 smoke tests that verify the runtime helpers
     (`createStack`, `trySquare`, `isBoardCoord`).

2. **Create test helpers** in `tests/support/helpers.ts`:
   - `parseOk(gsfen: string): GameState` — calls `parseGSFEN` +
     `validateState` and asserts success, returns the state.
   - `battleState(overrides?: Partial<GameState>): GameState` — creates a
     minimal battle-phase state with a given position/hands/turn.
   - `putPiece(state: GameState, col, row, piece, owner): GameState` —
     places a piece on the board for easy setup without GSFEN.

3. **Convert table-driven tests** where feasible:
   - Piece/color/size combinations that currently have individual
     assertions can use `test.each` with a data table.
   - This applies particularly to `movement.test.ts` and `attack.test.ts`.

4. **Remove tests that are redundant** after the B3 deduplication:
   - `terminal.test.ts` may have tests for the now-removed inline helpers
     (`isMoveSafe`, `isCaptureSafe`). Move any unique coverage to
     `battle.test.ts` if not already covered.

5. **Verify**: `docker compose run --rm test` — coverage should be
   preserved or improved; fewer lines, same assertions.

**Files touched:** `oracle/tests/types.test.ts`, `oracle/tests/support/helpers.ts`
(new), `oracle/tests/movement/movement.test.ts`, `oracle/tests/attack/attack.test.ts`,
`oracle/tests/game/terminal.test.ts`.

---

## Phase D — Final Cleanup

### D1 — Clean up public API and documentation (P6)

**Problem:** The barrel exports include internal parsers, validators, and
terminal operations that consumers don't need. Documentation has stale
test counts, invalid examples, and step-awareness markers.

**Concrete steps:**

1. **Slim the public barrel** (`oracle/src/index.ts`):
   - Suggested public surface:
     ```
     parseGSFEN · serializeGSFEN
     parseGAN   · serializeGAN
     initialState · step · legalActions
     Game       (class)
     GameState · Action · GameResult  (key types only)
     GameError  (error class for catch blocks)
     ```
   - Move internal exports to `@internal` JSDoc tags or remove from barrel.
   - Specifically: `validateState`, `validateAction`, `validateMove`,
     `validateArata`, `validatePlacement`, `evaluateExposure`,
     `checkTerminal`, `hasLegalPlays`, `hasInsufficientMaterial`, and
     the various type re-exports (`ValidationResult`, `PlayValidation`,
     `ApplyResult`) can be removed from the public barrel.
   - Consumers that need internals can import the source file directly.

2. **Update stale documentation**:
   - Fix the invalid `parseGAN()` example in the barrel (if any).
   - Remove "Step 8/9/12" markers from source files — describe what the
     module *does*, not what build step created it.
   - Update the test count in CONTEXT.md (790 → current, will be 811+).
   - Remove references to non-existent file if found.
   - Update ORACLE.md build status table to reflect post-refinement state.

3. **Add JSDoc `@example` for `step()`** showing the primary usage flow.

4. **Verify**: `docker compose run --rm check && docker compose run --rm test`.

**Files touched:** `oracle/src/index.ts`, `oracle/CONTEXT.md`,
`oracle/ORACLE.md`, possibly `oracle/src/game/game.ts`.

---

## Rollback Plan

If any step breaks more tests than expected:

1. **Stop.** Do not continue to the next step.
2. **Identify** whether the breakage is in the changed file's own tests
   (narrow fix needed) or in downstream tests (interface change propagated
   unexpectedly).
3. **Fix** forward — adjust the changed function or its callers. Avoid
   reverting unless the approach is fundamentally wrong.
4. **If reverting:** `git checkout -- path/to/file` and document why in
   a commit message or log entry.

---

## Verification Strategy

| Phase | Primary check | Broaden if |
|-------|---------------|------------|
| A | Unit tests for changed files pass | Integration test failure |
| B | Full test suite pass (unchanged behavior) | Compare `Game.legalActions` output before/after |
| C | Same test count (± a few removed redundancies) | Coverage report doesn't drop |
| D | Compile + test | Build passes cleanly |

All phases: `docker compose run --rm check && docker compose run --rm test
&& docker compose run --rm lint` before committing.
