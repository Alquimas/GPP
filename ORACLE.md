# Oracle — TypeScript Reference Implementation Plan

> A step-by-step build plan for the TypeScript Oracle, the authoritative
> reference implementation of the Gungi rules. Each step produces a
> testable increment. Checkpoints are the gates that must pass before
> moving to the next step.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Layout](#2-module-layout)
3. [Step 0 — Docker Toolchain Setup](#step-0--docker-toolchain-setup) ✅
4. [Step 1 — Project Scaffold + Domain Types](#step-1--project-scaffold--domain-types)
5. [Step 2 — GSFEN Parser](#step-2--gsfen-parser) ✅
6. [Step 3 — GSFEN Serializer](#step-3--gsfen-serializer)
7. [Step 4 — GAN Parser](#step-4--gan-parser)
8. [Step 5 — GAN Serializer](#step-5--gan-serializer)
9. [Step 6 — Movement Rules Engine](#step-6--movement-rules-engine)
10. [Step 7 — Attack & Check Detection](#step-7--attack--check-detection)
11. [Step 8 — Action Validation (Move, Arata)](#step-8--action-validation-move-arata)
12. [Step 9 — Deploy Phase Logic](#step-9--deploy-phase-logic)
13. [Step 10 — Game Engine + Battle Phase](#step-10--game-engine--battle-phase)
14. [Step 11 — Terminal Conditions & Repetition](#step-11--terminal-conditions--repetition)
15. [Step 12 — Public API](#step-12--public-api)
16. [Step 13 — Property Tests & Gherkin Step Defs](#step-13--property-tests--gherkin-step-defs)
17. [Step 14 — Action Visualizer](#step-14--action-visualizer)
18. [Verification Strategy Map](#verification-strategy-map)

---

## 1. Architecture Overview

The Oracle is a **pure domain logic library** with zero I/O and zero UI. It
receives a Game State and an Action, validates the Action against the rules,
and returns the next Game State (or rejects the Action and returns the
unchanged state along with a typed error).

### Design principles

- **Naive and explicit.** The Oracle is deliberately unoptimized. Every rule
  is spelled out in code that maps one-to-one to a BR-xxx rule reference.
- **Functional core.** Game State is immutable. Applying an Action produces a
  new state; the previous state is preserved.
- **Error domain.** Validation failures return typed error objects, not
  exceptions. Every error carries the BR-xxx rule reference it violated.
- **Parser/serializer symmetry.** GSFEN and GAN each have a parse →
  validate → internal-model → serialize → validate round-trip that is tested
  exhaustively.

### Dependency graph

```
types.ts  ←  constants.ts
    ↓
gsfen/parse.ts ──→ gsfen/serialize.ts
gan/parse.ts  ──→ gan/serialize.ts
    ↓
board/board.ts  ──→ board/movement.ts  ──→ board/attack.ts
    ↓
game/deploy.ts  ──→ game/apply.ts  ──→ game/battle.ts
    ↓
game/terminal.ts  ──→ game/game.ts  ←── public API
```

### Test architecture per step

Each step uses the **narrowest feasible verification** for its deliverable:

| Phase | Primary technique | When to escalate |
|-------|-------------------|-----------------|
| Steps 1–5 | Compile + unit tests | Hand-crafted edge case fails |
| Steps 6–7 | Parametric (table-driven) tests | Missing coverage dimension |
| Steps 8–11 | Gherkin scenarios + unit tests | Behaviour vs spec mismatch |
| Steps 12–13 | Property-based (fast-check) + integration | Invariant violation |
| Step 14 | Manual visual review | Requires human pattern recognition |

---

## 2. Module Layout

```
oracle/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public barrel export
│   ├── types.ts                    # Core domain types
│   ├── constants.ts                # Piece data, initial counts
│   ├── errors.ts                   # Typed error hierarchy
│   ├── gsfen/
│   │   ├── parse.ts                # GSFEN string → GameState
│   │   ├── serialize.ts            # GameState → canonical GSFEN string
│   │   └── validate.ts             # Semantic validity (V1–V8)
│   ├── gan/
│   │   ├── parse.ts                # GAN string → ParsedAction
│   │   ├── serialize.ts            # Action → canonical GAN string
│   │   └── validate.ts             # Semantic validity (S1–S6)
│   ├── board/
│   │   ├── board.ts                # Board query/mutate helpers
│   │   ├── movement.ts             # Movement computation per piece type
│   │   └── attack.ts               # Attack detection for Check
│   └── game/
│       ├── game.ts                 # Game class (public API)
│       ├── deploy.ts               # Deploy phase logic
│       ├── battle.ts               # Battle phase logic
│       ├── apply.ts                # Apply validated action to state
│       └── terminal.ts             # Terminal condition evaluation
├── tests/
│   ├── gsfen/
│   │   ├── parse.test.ts
│   │   ├── serialize.test.ts
│   │   └── validate.test.ts
│   ├── gan/
│   │   ├── parse.test.ts
│   │   └── validate.test.ts
│   ├── movement/
│   │   └── movement.test.ts        # Parametric tests, all pieces
│   ├── attack/
│   │   └── attack.test.ts
│   ├── game/
│   │   ├── deploy.test.ts
│   │   ├── battle.test.ts
│   │   ├── arata.test.ts
│   │   ├── terminal.test.ts
│   │   └── repetition.test.ts
│   ├── invariants.test.ts          # Property-based tests
│   └── integration.test.ts         # Full game sequences
└── features/                       # Gherkin .feature files (Step 13)
    ├── deploy_phase.feature
    ├── battle_move.feature
    ├── battle_stack_capture.feature
    ├── turncoat.feature
    ├── battle_arata.feature
    ├── battle_terminal.feature
    └── gan_grammar.feature
```

All rules reference the BR-xxx identifiers from `BUSINESS_RULES.md`. Every
function that enforces a rule documents its BR-xxx citation in a JSDoc
`@throws` or `@returns` note.

---

## 3. Step Details

---

### Step 0 — Docker Toolchain Setup ✅

**Goal:** Ensure every Oracle build, type-check, and test command runs
deterministically on any machine without a host Node.js installation.

**What to build in `oracle/`:**

**`Dockerfile`** — multi-stage Node.js image:
```dockerfile
# Stage 1: install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: dev workspace (source mounted at runtime)
FROM deps AS dev
WORKDIR /app
COPY tsconfig.json vitest.config.ts ./
ENTRYPOINT ["npx"]
CMD ["vitest", "run"]
```

- `node:22-alpine` — current LTS; ~120 MB; musl libc is sufficient for pure
  TypeScript (no native addons needed).
- `npm ci` over `npm install` — deterministic install from lockfile.
- `CMD ["vitest", "run"]` — default `docker compose run` entry point; override
  with `--check` for type-checking.

**`docker-compose.yml`** — five service aliases:
```yaml
services:
  test:
    build: .
    command: ["vitest", "run"]
    volumes:
      - .:/app
      - /app/node_modules    # anonymous volume: prevents host node_modules shadowing

  check:
    build: .
    command: ["tsc", "--noEmit"]
    volumes:
      - .:/app
      - /app/node_modules

  lint:
    build: .
    command: ["eslint", "src", "tests"]
    volumes:
      - .:/app
      - /app/node_modules

  format:
    build: .
    command: ["prettier", "--write", "src/**/*.ts", "tests/**/*.ts", "*.{js,json,ts}"]
    volumes:
      - .:/app
      - /app/node_modules

  format-check:
    build: .
    command: ["prettier", "--check", "src/**/*.ts", "tests/**/*.ts", "*.{js,json,ts}"]
    volumes:
      - .:/app
      - /app/node_modules
```

Why five services instead of one with a script: `tsc --noEmit`, `vitest run`,
`eslint`, and `prettier` each have different CLI interfaces, and separate named
services make the intention self-documenting.

**`.dockerignore`** — keeps build context lean:
```
node_modules
.git
*.md
```

**`eslint.config.js`** — ESLint flat config (ESM):
```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/'],
  },
);
```

- Recommended rules with TypeScript type-checked linting.
- `import.meta.dirname` is available in Node.js 22+ (the Docker image).

**`.prettierrc`** — formatting defaults:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

**`.gitignore`**:
```
node_modules/
dist/
```

**How to use (all subsequent steps):**
```bash
# Type-check (every step)
docker compose run --rm check

# Run tests (every step)
docker compose run --rm test

# Lint (every step)
docker compose run --rm lint

# Format code
docker compose run --rm format

# Check formatting (CI)
docker compose run --rm format-check

# Drop into a shell for ad-hoc commands
docker compose run --rm test sh
```

**Verification affordance lifecycle:**
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`,
  `eslint.config.js`, `.prettierrc` — **durable.**
  Used by all 14 steps, CI, and developer onboarding.

**Checkpoint:**
```bash
docker compose build --quiet
docker compose run --rm check       # exit 0, no output (clean compile)
docker compose run --rm test        # exit 0, "Tests N passed"
docker compose run --rm lint        # exit 0, no warnings
docker compose run --rm format-check  # exit 0, all files formatted
```

**Verification:**
- Build completes without warnings on a clean checkout
- All four commands produce identical exit codes regardless of host OS or tooling
- Docker cache does not mask stale `node_modules` — confirm with a `--no-cache-filter=deps` build if suspected
- Lint catches rule violations before they reach CI

---

### Step 1 — Project Scaffold + Domain Types ✅

**What to build:**
- Initialize the project: `package.json` with vitest + typescript, `tsconfig.json`
  (strict mode, ES2022 target, `src/` root), `vitest.config.ts`.
- `src/types.ts` — all domain types as TypeScript types/interfaces:
  - `Player = 'white' | 'black'`
  - `PieceType` — union of 14 letter literals (`'A' | 'C' | 'E' | …`)
  - `Piece` — `{ type: PieceType; owner: Player }`
  - `Square` — `{ col: number; row: number }` (both 1–9)
  - `Stack` — `Piece[]` (ordered bottom→top, length 1–3)
  - `Position` — `(Stack | null)[][]`, 9×9 grid, **row-major**: `position[row][col]`
    where row 0 = Standard Diagram Row 1 (top), row 8 = Row 9 (bottom).
  - `Phase = 'deploy' | 'battle'`
  - `DoneFlag = Player | null`
  - `TurnState = { phase: Phase; activePlayer: Player; done: DoneFlag; counter: number }`
  - `Hand` — `Record<PieceType, number>` (all 14 keys always present; count 0
    means empty — a single canonical form, so Game States compare cleanly for
    Repetition)
  - `GameState` — `{ position: Position; turn: TurnState; hands: { white: Hand; black: Hand } }`
    (snapshot only — Repetition compares these directly, per CONTEXT.md)
  - `GlobalState` — `{ current: GameState; history: GameState[]; result: GameResult }`
    (runtime container; history lives here, never inside a snapshot)
  - `Action` — discriminated union:
    - `{ kind: 'placement'; piece: PieceType; dest: Square; done: boolean }`
    - `{ kind: 'move'; origin: Square; dest: Square; outcome: 'stack' | 'capture' | null; turncoat: number[] }`
    - `{ kind: 'arata'; piece: PieceType; dest: Square; turncoat: number[] }`
  - `GameResult` — discriminated union: `{ kind: 'ongoing' }` |
    `{ kind: 'checkmate' | 'stalemate' | 'exposure'; loser: Player }` |
    `{ kind: 'exposure-draw' }` | `{ kind: 'repetition' }`
    (BR-TERMINATION-001/002: checkmate and stalemate are losses of the Active
    Player; BR-DEPLOY-012: exposure is a loss for one player or a draw for both)
  - `MoveClass = 'step' | 'limited-range' | 'range' | 'jump'`
  - `Direction` — string literal union: `'F' | 'B' | 'L' | 'R' | 'FL' | 'FR' | 'BL' | 'BR'`
    (not an enum — zero runtime cost, erased at compile time)
- `src/constants.ts`:
  - `PIECE_NAMES: Record<PieceType, string>` — letter → full name map
  - `INITIAL_COUNTS: Record<PieceType, number>` — letter → initial count per player
  - `PIECE_MOVEMENT` — per piece type: `{ step: Direction[]; limitedRange: Direction[]; range: Direction[]; jumps: JumpPattern[] }`
    (empty arrays for movement classes the piece does not have)
  - `START_GSFEN: string` — the known startpos GSFEN string
- `src/errors.ts`:
  - `GameError` — base class carrying `rule: string` (the BR-xxx reference).
    Uses `extends Error` so `instanceof` works in test assertions.
  - `IllegalActionError` extending `GameError` with `action: Action`
  - Error subclasses per rule group: `DeployError`, `MoveError`, `ArataError`,
    `SelfCheckError`, `TerminalError`
- `tests/types.test.ts` — one trivial test per type confirming the compiler
  accepts valid shapes.

**Key design decisions:**

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Module system | ESM (`"type": "module"`) | Vitest and TS 5.7 handle ESM natively; all future tooling assumes it |
| TypeScript target | `ES2022` | Structured result types, `?.`/`??` native; no downlevel pitfalls |
| Module resolution | `Node16` | Correct ESM resolution; required for `"type": "module"` |
| Strictness | `strict: true` + `noUnusedLocals` + `noUnusedParameters` + `exactOptionalPropertyTypes` | Catches unused code and `undefined` vs absent distinction across the model |
| Direction representation | String literal union (not enum) | Erased at compile time — no runtime code emitted |
| Hand representation | `Record<PieceType, number>` | All keys always present — one canonical form so deep equality works for Repetition state comparison |
| Position indexing | `position[row][col]`, row-major | Matches GSFEN row-first serialization; parsers handle coordinate translation |
| Error classes | `class extends Error` | `instanceof` works in test assertions and consumer error-handling code |
| Runtime dependencies | **Zero** | The Oracle is pure TypeScript types + logic; everything compiles away |

**Checkpoint:**
```bash
docker compose run --rm check    # npx tsc --noEmit passes with strict mode
docker compose run --rm test     # npx vitest run — scaffold smoke tests pass
```
- `tests/types.test.ts` instantiates each type and confirms the compiler
  accepts valid shapes and rejects invalid ones.

**Verification:**
- Compilation with all strict flags enabled.
- One trivial test per type confirming construction (type-level checks at
  test time catch interface drift).
- A `Square` coordinate sanity assertion: `{ col: 1, row: 1 }` is documented
  in a code comment as **top-right corner** (Standard Diagram). This is the
  single point of truth for the coordinate system — if this assumption is wrong,
  all parser, board, and movement logic fails downstream. The smoke test
  should include a comment-assertion pairing for this.

**Risk (coordinate system):** The `Position` indexing convention is the most
dangerous undetected error in Step 1. It compiles correctly even if wrong
(the type system cannot encode "row 0 = top"). If implemented incorrectly,
the bug is invisible until Step 2 (GSFEN parse) or Step 6 (movement) produces
wrong results. **Mitigation:** The `Square` type carries a JSDoc comment
explicitly stating the origin. The smoke test asserts a known coordinate
round-trip.

---

### Step 2 — GSFEN Parser ✅

**What to build:**
- `src/gsfen/parse.ts` — port the GSFEN parser from `visualizers/gsfen.html`
  (the visualizer's `parseGSFEN` function) into TypeScript with:
  - Strongly typed return: `ParseResult = { ok: true; state: GameState } | { ok: false; error: GameError }`
  - All error paths documented with BR-xxx / C-xxx / V-xxx references
  - `startpos` keyword expansion (already exists in the JS code)
- `src/gsfen/validate.ts` — semantic validity checks V1–V8 from GSFEN.md:
  - V2: Stack size 1–3
  - V3: Marshal integrity (top of its stack; counts per phase; never in Hand during battle)
  - V4: Inventory conservation (board + hand ≤ initial count)
  - V5: Done flags consistency
  - V6: Deploy-phase placement zone & single-owner stacks
  - V7: Counter bounds (deploy ≤ 50, battle unbounded)
  - V8: Empty hands marker `-` consistency

**Checkpoint:**
- All 15 sample GSFEN files in `gsfen/` parse successfully and produce
  correct `GameState` objects
- `startpos` expands to the full initial state
- All worked examples from GSFEN.md parse to expected values
- Invalid spellings (C1–C7 violations + V1–V8 violations) are all rejected
  with descriptive errors carrying the correct rule reference
- Passing tests: `tests/gsfen/parse.test.ts`, `tests/gsfen/validate.test.ts`

**Verification:**
- **Narrow:** Parse each known-good `.gsfen` file, snapshot the structured
  state key fields.
- **Boundary:** Run the invalid-spelling examples from GSFEN.md (the 4 listed
  + your own variants: wrong case, `startpos` with extra whitespace, bogus
  piece letter, wrong row count).
- **Proportionate:** Don't hand-write 50 error tests for C1–C7. One test per
  rule family plus the GSFEN.md invalid examples covers the meaningful
  failure space. Add only if a real parse failure reveals a gap.

---

### Step 3 — GSFEN Serializer

**What to build:**
- `src/gsfen/serialize.ts` — `GameState → string`
  - Position: encode each row's 9 squares as comma-separated items (empty
    runs merged, stacks bottom→top)
  - Turn: map phase+activePlayer+done to the correct 6-value token
  - Hands: alphabetical order, counts ≥2 prefixed, `-` when both empty
  - Counter: plain decimal, no leading zeros
  - Enforce canonical output: C2–C6 are *guarantees* of the serializer, not
    post-hoc checks
- `src/index.ts` — add `export * from './gsfen/serialize.js'` to the barrel

**Checkpoint:**
- `parse(serialize(state))` round-trips for all `.gsfen` fixture files
  (glob: `gsfen/*.gsfen`) + all worked examples from GSFEN.md
- `serialize(parse(gsfenStr))` returns exactly the original string for every
  canonical input (proving canonicalization is preserved)
- **`startpos` keyword handled correctly:** `serialize(parse('startpos'))`
  produces the expanded canonical string (`START_GSFEN`), not the keyword
  `"startpos"` — `startpos` is a parse-only convenience alias, not a valid
  serialization output
- Passing test: `tests/gsfen/serialize.test.ts`

**Verification:**
- **Primary (parametric round-trip):** Glob all `.gsfen` fixture files, parse
  each, serialize back, then assert:
  1. `serialize(parse(x)) === x.trim()` — exact text round-trip for canonical
     inputs (catches ordering, run-merging, counter-formatting bugs)
  2. `parse(serialize(state))` produces a `GameState` deeply equal to the
     original — structural round-trip for any reachable state
  This is the decisive evidence path: the two identities prove the serializer
  inverts the parser and preserves canonical form. **Write this as a single
  parametric test** (`test.each` over fixture list), not per-file hand-coded
  assertions — the existing `verify.test.ts` already does detailed structural
  spot-checks.
- **Edge-case tests (handful):**
  - Empty hands marker: `{ white: EMPTY_HAND, black: EMPTY_HAND }` → `"-"`
  - Single-piece hand: `{ white: { ...EMPTY_HAND, M: 1 }, black: EMPTY_HAND }`
    → `"M"` (count 1 omitted)
  - Multi-count hand: a hand with counts ≥2 for several types
  - Full compaction: a row with pieces at columns 1 and 9 produces the
    minimal digit-run encoding
- **Coverage target:** Every row encoding pattern (empty, mixed empty/piece,
  stacks at various positions) appears in at least one fixture.

---

### Step 4 — GAN Parser

**What to build:**
- `src/gan/parse.ts` — port the GAN grammar into TypeScript:
  - Parse a GAN string into the `Action` discriminated union
  - Three shapes: `placement`, `move`, `arata` — distinguished by the
    shape of the first token (letter → piece vs digit → square)
  - Parse square notation: `{col}-{row}` → `{ col: number; row: number }`
  - Parse optional tokens: `!` (done), `/=/x` (outcome), `+` (turncoat levels)
- `src/gan/validate.ts` — semantic validity checks S1–S6 from GAN.md:
  - S1: Phase match (placement → deploy; move/arata → battle)
  - S2: Placement legality (piece in hand, marshal first, deploy zone, target empty/friendly)
  - S3: Move legality — calls movement/attack modules (produced in Step 6–7)
  - S4: Arata legality — calls board helpers
  - S5: Turncoat legality — calls hand/stack helpers
  - S6: Done legality — only on placements

**Checkpoint:**
- All worked examples from GAN.md parse to expected `Action` objects
- All invalid GAN strings from GAN.md are rejected with correct error types
- GAN ABNF grammar examples from TEST.md §4.7 all parse correctly
- Passing tests: `tests/gan/parse.test.ts`, `tests/gan/validate.test.ts`

**Note:** The semantic validation in S3–S4 depends on movement rules and
board helpers from later steps. For Step 4, the validate function should
accept the GameState reference and call into modules that will be built in
Steps 6–8. Stub these until they exist, or write the validate function
incrementally.

---

### Step 5 — GAN Serializer

**What to build:**
- `src/gan/serialize.ts` — `Action → string`
  - Placement: `{piece}{col}-{row}[!]`
  - Move: `{originCol}-{originRow}>{destCol}-{destRow}[= | x][+{levels}]`
  - Arata: `{piece}*{destCol}-{destRow}[+{levels}]`
  - Enforce canonicity A1–A6: omit outcome when forced, omit turncoat when
    declined, levels ascending, no annotation tokens

**Checkpoint:**
- `parse(serialize(action))` round-trips for all worked examples from GAN.md
- `serialize(parse(ganStr))` returns exactly the original string for every
  canonical input
- Passing test: `tests/gan/serialize.test.ts`

---

### Step 6 — Movement Rules Engine

**What to build in `src/board/`:**

#### `board.ts` — Board primitives
- `getStack(position, square): Stack | null`
- `setStack(position, square, stack): Position` (returns new position, immutable)
- `squareInBounds(square): boolean`
- `applyDirection(col, row, direction, player): { col: number; row: number } | null`
  — returns adjacent square in a given direction, or null if off-board
- `isOccupiedBy(position, square, player): boolean`
- `topPiece(stack): Piece`
- `stackSize(stack): number`
- Directions are **player-relative**: for White, F = row-1, B = row+1,
  L = col+1, R = col-1; for Black, the mapping is reversed.

#### `movement.ts` — Movement computation
- `getLegalDestinations(position, square, player): LegalMove[]`
  — single entry point that dispatches to movement class handlers
  
  For each piece type at its stack size:
  
  1. **Step movement** (BR-MOVEMENT-001):
     - For each allowed direction at size 1, produce the adjacent square
     - Check BR-MOVE-005 (stack size landing restriction)
  
  2. **Limited range movement** (BR-MOVEMENT-002):
     - For each allowed direction, trace 1–2 squares (size 1), 1–3 (size 2),
       1–4 (size 3) per BR-MOVEMENT-005
     - Check BR-PATH-001: stop at obstruction (destination is valid if it's
       the obstruction itself; path cannot extend beyond)
  
  3. **Range movement** (BR-MOVEMENT-003):
     - For each allowed direction, trace until board edge or obstruction
     - BR-PATH-001 applies: destination is valid if it's the obstruction
       itself; cannot move through

  4. **Jump movement** (BR-MOVEMENT-004):
     - For each jump pattern defined at size 1, compute scaled patterns
       at sizes 2 and 3 per BR-MOVEMENT-005 scaling rule
     - BR-PATH-002: check each jumped-over square; block if any has
       stack size > source stack size

  Return type: `LegalMove { dest: Square; moveClass: MoveClass; outcome: MoveOutcome | null }`
  where `MoveOutcome = 'stack' | 'capture'` captures the forced/optional
  distinction.

- `getLegalMoves(position, player): LegalMove[]` — all legal destinations
  for all of a player's pieces (used for checkmate/stalemate, action visualizer)

**Checkpoint:**
- Parametric (table-driven) tests covering:
  - Every piece type × every allowed direction × size 1/2/3 × obstruction
    pattern (clear, friendly, enemy) for step/limited-range/range/jump
  - Stack scaling: step→limited-range transition at sizes 2–3
  - Limited range extension: 1–2 → 1–3 → 1–4
  - Range movement to board edge
  - Jump blocked by large stack on jumped-over square
  - Jump unblocked through empty squares
  - Mixed-ownership stack handling
- All movement examples from BUSINESS_RULES.md piece type reference produce
  correct destinations
- Passing test: `tests/movement/movement.test.ts`

**Verification:**
- **Primary:** Parametric test matrix — use `describe.each` / `test.each` to
  iterate piece types, sizes, directions, obstruction patterns. Each test
  validates a specific BR rule.
- **Coverage target:** Every movement class × piece type × size combination
  present (≥1 legal move test + ≥1 illegal move test per combination).
- **Proportionate:** Don't test every possible board position; test the
  class of pattern (step, range, etc.) and the boundary cases (edge,
  obstruction at each step). 150–250 parametric cases covers the depth.

---

### Step 7 — Attack & Check Detection

**What to build in `src/board/attack.ts`:**
- `isSquareUnderAttack(position, targetSquare, byPlayer, sourceStackSize): boolean`
  — returns true if any piece belonging to `byPlayer` can reach
  `targetSquare` considering only movement rules and board boundaries
  (per BR-Attack definition: disregards occupation for Marshal threat,
  still applies stack-size landing restriction)
- `isInCheck(position, player): boolean`
  — true if the player's Marshal square is under attack by the opponent
- `isExposed(position): { white: boolean; black: boolean }`
  — Exposure evaluation (BR-DEPLOY-012): checks if each Marshal is under
  attack. Returns a pair of booleans.

**Key subtlety** (from BR-Attack): Attack disregards the "no landing on
Marshal" restriction for threat evaluation. The stack size landing
restriction (BR-MOVE-005) still applies: a piece cannot attack a square
whose stack size exceeds its own source stack size.

**Checkpoint:**
- Attack detection works for every piece type at every size against targets
  within and beyond range
- Marshal threat: test that a piece that can *reach* the Marshal's square
  (but couldn't land on it due to BR-STACK-004) still makes the Marshal
  "under attack"
- Exposition detection: confirm correct exposure state for all 15 sample GSFENs
- Passing test: `tests/attack/attack.test.ts`

---

### Step 8 — Action Validation (Move, Arata)

**What to build in `src/game/`:**

#### `battle.ts` — Battle phase action validation

- `validateMove(state, action): ValidationResult` — validates a Move action:
  1. BR-MOVE-002: origin contains player's own piece
  2. BR-MOVE-001: piece is the top of its stack
  3. BR-MOVE-003 + BR-MOVEMENT: dest is reachable (calls movement.ts)
  4. BR-MOVE-005: stack size landing restriction
  5. BR-STACK-002/003/004 + BR-CAPTURE-001/002/003: outcome validation
     (is `outcome` present correctly per canonicity rules? is the actual
     outcome forced or a choice?)
  6. BR-ACTION-002 (Self Check): after applying the move, own Marshal not
     under attack

- `validateArata(state, action): ValidationResult` — validates an Arata action:
  1. BR-ARATA-001: is a Play (phase check)
  2. BR-ARATA-002: piece is in hand
  3. BR-ARATA-003: dest within Arata placement zone
  4. BR-ARATA-004/005: target is empty or friendly-topped stack under size 3
  5. BR-ARATA-006: not on enemy stack
  6. BR-ARATA-007: not on Marshal
  7. BR-ACTION-002: Self Check after placement
  8. BR-STACK-006: Turncoat validation (if applicable)

- `validatePlay(state, action): PlayValidation` — dispatches to
  validateMove or validateArata based on action kind

#### `deploy.ts` — Deploy phase action validation

- `validatePlacement(state, action): ValidationResult`:
  1. BR-DEPLOY-001/002: phase check + turn check
  2. BR-DEPLOY-003: Marshal must be first placement per player
  3. BR-DEPLOY-004: dest within deploy zone
  4. BR-DEPLOY-005/006: target is empty or friendly-topped stack under size 3
  5. Marshal check: not stacking on Marshal (BR-DEPLOY-005)
  6. Done check: `!` is valid iff player wants to declare Done
     (BR-DEPLOY-007)

**Validation result types:**
```typescript
type ValidationResult = { ok: true } | { ok: false; error: GameError }
type PlayValidation = ValidationResult & { afterState?: GameState } // pre-computed post-move state for Self Check
```

For Self Check (BR-ACTION-002), the validation must *temporarily apply* the
action to compute the post-move state and check the Marshal's safety. This
means `validatePlay` calls into `apply.ts` (Step 10) speculatively.

**Checkpoint:**
- Every validation rule is tested with at least one legal and one illegal
  example
- Stack/Capture choice scenarios (BR-STACK-002): test both branches of the
  choice
- Self Check: test that a move leaving own Marshal in Check is rejected
- Arata: test placement zone boundaries, stacking on friendly/enemy,
  Turncoat scenarios
- Passing tests: `tests/game/battle.test.ts`, `tests/game/arata.test.ts`,
  `tests/game/deploy.test.ts`

**Verification:**
- Scenario-based: each BR rule gets a named test.
- Use `gsfen/` sample positions for setup; craft specific GAN strings for
  the action under test.
- For Self Check, design positions where only one of several candidate moves
  is legal (the one that doesn't leave the Marshal exposed).

---

### Step 9 — Deploy Phase Logic

**What to build — `src/game/apply.ts` (deploy portion):**

- `applyPlacement(state, action): ApplyResult`:
  1. Deduct piece from hand
  2. Place piece on board (append to stack or create new stack)
  3. Advance turn counter
  4. Handle Done declaration (BR-DEPLOY-007/008):
     - If current player declares Done, set their Done flag
     - If both players Done → end Deploy Phase → evaluate Exposure
       (BR-DEPLOY-012) → transition to Battle Phase
     - Otherwise, swap active player (BR-DEPLOY-002)
  5. Marshal first enforcement — handled by validatePlacement in Step 8

**Deploy → Battle transition** in `src/game/terminal.ts`:
- `evaluateExposure(state): GameResult`
  - Per BR-DEPLOY-012: if exactly one Marshal under attack → that player
    loses; if both → draw; otherwise → `{ kind: 'ongoing' }` (continue)

**Checkpoint:**
- A full deploy sequence: 25 placements for White + 25 for Black (or mixed
  with Done declarations) reaches Battle Phase
- Exposure evaluation fires correctly at the boundary
- Marshal first enforced: a placement that doesn't deploy the Marshal first
  fails
- Passing test: `tests/game/deploy.test.ts`

---

### Step 10 — Game Engine + Battle Phase

**What to build — `src/game/apply.ts` (battle portion):**

- `applyMove(state, action): ApplyResult`:
  1. Detach top piece from origin stack
  2. Resolve outcome (BR-STACK/CAPTURE):
     - **Capture** (BR-CAPTURE-004): remove all enemy pieces from target
       stack; moving piece sits alone (or on top of remaining friendly pieces)
     - **Stack** (BR-STACK-005): moving piece becomes new top of target stack
  3. Resolve Turncoat swaps (BR-STACK-006): per elected level, remove enemy
     piece, place matching type from hand
  4. Flip active player (BR-TURN-002)
  5. Increment turn counter
  6. Record new GameState in history

- `applyArata(state, action): ApplyResult`:
  1. Remove piece from hand
  2. Place on dest (empty or stacking)
  3. Resolve Turncoat swaps
  4. Flip active player
  5. Increment counter

**State transition guarantees:**
- Every `apply*` receives a pre-validated action (validation already passed)
- Returns `ApplyResult = { state: GameState; result: GameResult }` —
  `result.kind` is `'ongoing'` if the game continues, terminal if the
  action ended the game

**Checkpoint:**
- A full deploy → battle sequence: execute 50 placements (or fewer with
  Done) then a series of moves
- Capture removes enemy pieces and leaves friendly ones
- Stack on enemy: mixed-ownership stacks form correctly
- Turncoat: swaps consume hand pieces and replace enemy pieces
- Counter increments correctly in both phases; resets on battle start
- Passing test: `tests/game/battle.test.ts`

---

### Step 11 — Terminal Conditions & Repetition

**What to build in `src/game/terminal.ts`:**

- `checkTerminal(state, history): GameResult` — evaluated before each Battle
  Phase Turn (BR-GAME-004):
  1. Checkmate (BR-TERMINATION-001): active player in Check AND no legal
     play exists → active player loses
  2. Stalemate (BR-TERMINATION-002): active player NOT in Check AND no
     legal play exists → active player loses
  3. Repetition (BR-REPETITION-001): current GameState (active player +
     position + hands) appears 4th time in Battle Phase history → draw
  
- `hasLegalPlays(state): boolean` — computes whether active player has any
  legal plays (calls movement.ts for all their pieces + validatePlay for each)

**Key subtleties:**
- Repetition compares Game States by (active player, position string, hands
  string) — per GSFEN.md repetition section, counter is excluded
- Only Battle Phase states count (BR-REPETITION-001)
- The initial Battle Phase state counts as the first occurrence
- Checkmate and Stalemate use the same `hasLegalPlays` check but differ on
  whether the player is in Check

**Checkpoint:**
- Checkmate: construct a position where Marshal is under attack and no legal
  move can save it → game ends with attacker winning
- Stalemate: construct a position where Marshal is not under attack but no
  legal play exists → active player loses
- Repetition: cycle through 3 identical states, then the 4th occurrence
  triggers draw
- Deploy Phase states are excluded from repetition count
- Passing test: `tests/game/terminal.test.ts`, `tests/game/repetition.test.ts`

---

### Step 12 — Public API

**What to build — `src/game/game.ts` — the single entry point consumed by
all external code (and the Action Visualizer in Step 14):**

```typescript
class Game {
  constructor(gsfen?: string)  // defaults to startpos
  static fromState(state: GameState): Game

  // Read-only queries
  get state(): GameState
  get result(): GameResult       // ongoing if the game continues
  get legalActions(): Action[]   // all legal actions for the current player

  // Action execution
  applyAction(action: Action): ApplyResult
  //   On success: returns the new GameState + terminal result (or ongoing)
  //   On failure: returns unchanged state + typed error with BR-xxx reference

  // Serialization
  toGsfen(): string              // current state as GSFEN
  toGan(action: Action): string  // serialize an Action to GAN

  // History
  get history(): GameState[]     // all prior states for repetition check
}
```

**Error contract (BR-ACTION-003):** If an Action is illegal, the Game State
remains unchanged. The `applyAction` method must *never* mutate internal
state when returning an error.

**Checkpoint:**
- Full integration test: seed from `startpos`, play a complete game through
  deploy and into battle, verify state transitions
- `applyAction` returns correct errors for all violation types
- `legalActions` returns correct set matching manual enumeration
- `toGsfen` round-trips
- Passing test: `tests/game/integration.test.ts`

---

### Step 13 — Property Tests & Gherkin Step Defs

**What to build:**

#### `tests/invariants.test.ts` — Property-based tests (fast-check)
- **Stack size invariant:** After any legal Action, no square has stack
  size ∉ {1,2,3}
- **Marshal top invariant:** If Marshal is on board, it's always the top
  of its stack group
- **Inventory invariant:** For each player and piece type,
  count_on_board + count_in_hand ≤ initial_count
- **Turn alternation invariant:** After any Play, active player flips
- **Illegal action invariant:** An illegal Action returns the same GameState
  (structural equality, not reference)
- **Self-Check invariant:** After a legal Play, the Active Player's Marshal
  is never under Attack
- **Capture removal invariant:** After Capture, captured pieces are absent
  from board and both hands
- **Hand depletion invariant:** Arata removes exactly one piece from Hand
- **GSFEN round-trip invariant:** parse(serialize(state)) is isomorphic for
  all reachable states

#### `features/*.feature` — Gherkin feature files
- Create the seven `.feature` files as specified in TEST.md §4
- Write step definitions that bind to the Oracle's public API:
  - `Given` steps: parse GSFEN to create Game state
  - `When` steps: call `applyAction` with parsed GAN action
  - `Then` steps: assert resulting state (GSFEN equality, error type,
    terminal condition)

**Checkpoint:**
- All invariants property tests pass with ≥100 random valid states each
- All Gherkin scenarios pass (every feature file scenario executes end-to-end)
- Every BR-xxx has at least one matching test identifier

---

### Step 14 — Action Visualizer

**What to build — `visualizers/action/`:**
- A CLI tool (Node.js script) that:
  1. Accepts a GSFEN string via command-line argument (or STDIN, or `startpos`)
  2. Imports the Oracle
  3. Computes all legal actions via `game.legalActions`
  4. Generates a self-contained HTML page (like the GSFEN visualizer) that
     renders the board with clickable pieces and highlighted legal destinations

- The output HTML should:
  - Show the board (reuse the GSFEN visualizer's rendering approach)
  - When a piece is clicked, highlight all its legal destinations with
    annotations ("Step", "Limited range", "Jump", "Range")
  - Color-code move types and special outcomes (Stacking eligibility,
    Capture forced, Turncoat eligible)
  - Show a text list of all legal GAN strings

**Dependency:** Requires the fully built Oracle (Steps 1–12) with all
movement, validation, and game logic complete.

**Checkpoint:**
- For `startpos` (deploy phase): renders board + lists all legal placements
- For any battle-phase GSFEN: clicking each piece highlights correct legal
  destinations
- No server required: the HTML is self-contained (the computation happens
  in Node.js at generation time, not in the browser)

---

## Verification Strategy Map

| Step | Deliverable | Verification | Failure mode | Escalation |
|------|-------------|-------------|--------------|------------|
| 0 | Docker toolchain | `docker compose run --rm check` + `test` exit 0 | Host Docker version mismatch | Pin `node:22-alpine` digest; document minimum Docker Engine version |
| 1 | Types + scaffold | Compile + smoke test | Wrong coordinate system | Review BUSINESS_RULES.md glossary |
| 2 | GSFEN parser | Parse 15 samples + reject invalid | Parsing edge case (malformed but accepted) | Add to invalid set |
| 3 | GSFEN serializer | Round-trip 15 samples + exact text match | Canonicalization bug (wrong letter order) | Compare vs GSFEN.md canonical rules |
| 4 | GAN parser | Parse all GAN.md examples | Ambiguous parse | Review ABNF grammar |
| 5–6 | Movement engine | Parametric matrix (all piece×size×dir×obs) | Wrong direction mapping (player-relative) | Verify against BR glossary direction table |
| 7 | Attack/Check | Marshal threat scenarios | Ignoring BR-MOVE-005 for attack | Review Attack definition in BR |
| 8 | Action validation | Each BR-xxx gets ≥1 legal + ≥1 illegal | Self Check not evaluating post-move state | Trace BR-ACTION-002 logic |
| 9 | Deploy logic | Full deploy sequence + exposure | Marshal-first enforcement misses a case | Review BR-DEPLOY-003 |
| 10 | Battle engine | Capture, stack, turncoat sequences | Stack composition after mixed-ownership turncoat | Manual GSFEN inspection via visualizer |
| 11 | Terminal conditions | Checkmate/stalemate/repetition scenarios | Repetition includes deploy-phase states | Review BR-REPETITION-001 |
| 12 | Public API | Integration: full game start→end | Error mutation (state changes on illegal) | Review BR-ACTION-003 |
| 13 | Property + Gherkin | Invariants + all feature scenarios | Invariant false positive | Narrow to failing case |
| 14 | Action visualizer | Manual visual review | Missing legal actions | Compare against manual enumeration |

---

## Build Order Dependencies

```
Step 0 (Docker toolchain)
   └─→ Step 1 (types)
          └─→ Step 2 (GSFEN parse) ──→ Step 3 (GSFEN serialize)
          └─→ Step 4 (GAN parse) ──→ Step 5 (GAN serialize)
          └─→ Step 6 (movement)
                 └─→ Step 7 (attack)
                        └─→ Step 8 (action validation)
                               └─→ Step 9 (deploy) ──→ Step 10 (battle)
                                      └─→ Step 11 (terminal)
                                             └─→ Step 12 (public API)
                                                    ├─→ Step 13 (property + Gherkin)
                                                    └─→ Step 14 (action visualizer)
```

Step 0 is a prerequisite for all other steps — every `check` and `test`
command in subsequent steps runs through Docker. Steps 2–5 can be built
independently (parallel-friendly) once Step 1 is done, since they depend
only on types + constants.

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Player-relative direction mapping wrong | All movement wrong | First test after Step 1: write a direction smoke test for both players |
| Attack ignoring BR-MOVE-005 restriction | False positives in Check detection | Test: piece with size 1 trying to attack a size-3 stack |
| Turncoat from Arata onto friendly stack with enemy below | Complex state mutation | Test this specific scenario early (Step 10) |
| Repetition counting deploy-phase states | False draw | Filter history by phase before counting |
| Self Check evaluating pre-move state | Illegal self-checks pass | Verify: construct a position where current state is safe but post-move is not |
