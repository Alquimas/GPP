# Gungi Game Core

Domain model for a Gungi board-game logic library — pure domain logic tracking a single game instance, validating actions against the rules, and returning deterministic outcomes.

## Language

**Game**:
A formal contest between two Players that progresses through two phases: Deploy and Battle.

**Deploy Phase**:
The opening phase where Players alternately place their unplaced Pieces on the board via **Placements**. Check, Self Check, and Terminal Conditions are not evaluated during this phase. The only terminal evaluation at this boundary is Exposure.

**Placement**:
A single step in the Deploy Phase: placing one unplaced Piece on a valid empty Square or onto a friendly Stack within the Player's deploy zone. Placements are not Plays.
_Avoid_: Deployment turn, deploy move

**Battle Phase**:
The main phase of the Game following the Deploy Phase. Consists of alternating **Turns**, each requiring exactly one **Play** (Move or Arata). Terminal Conditions (Checkmate, Stalemate, Repetition) are evaluated before each Turn. Exposure is evaluated exactly once, at the Deploy→Battle boundary.
_Avoid_: Regular turn, main phase

**Turn**:
A unit of the Battle Phase where the Active Player must execute exactly one Play (a Move or an Arata). Ends immediately after the Play; the Active Player passes to the Opponent.
_Avoid_: Battle turn, regular turn, deployment turn

**Play**:
An Action that a Player performs during a Turn. Either a Move or an Arata.

**Action**:
Any interaction a Player can have with the Game. Either a Placement or a Play.

**Attack**:
A Piece attacks a Square if its movement rules allow reaching it, ignoring whether the Square is currently occupied. For threat evaluation against a Marshal, the restriction on landing on the Marshal's Square is disregarded — Checkmate ends the Game before Capture resolves. The stack-size landing restriction (source Stack Size >= target Stack Size) still applies.
_Avoid_: Threat range, legal capture target

**Hand**:
A Player's inventory of pieces not currently on the board. Starts full (25 pieces). Shrinks via Placements during the Deploy Phase and via Arata during the Battle Phase. Captured pieces are removed from the game entirely and never enter a Hand.
_Avoid_: Reserve, inventory (ambiguous)

**Game State**:
A snapshot of the Game at a given instant. Consists of the Active Player, the current Position, and the contents of both Hands. Two Game States are equal only when all three match. Repetition compares full Game States.
_Avoid_: Position-only snapshot

**Repetition**:
A draw condition evaluated before each Turn in the Battle Phase. The same Game State occurring for the fourth time (counting only Battle Phase states) triggers the draw.

## Document Map

These documents, in the project root, collectively define the Gungi specification:

| Document | Purpose |
|---|---|
| `BUSINESS_RULES.md` | Normative business rules (BR-xxx), glossary, board geometry |
| `GSFEN.md` | GSFEN state serialization format — grammar, C1-C7, V1-V8 |
| `GAN.md` | GAN action notation — S1-S6 validation rules |
| `TEST.md` | Testing strategy and conventions |
| `REFINING.md` | Active refinement queue (problems found in code review) |
| `ORACLE.md` | Build plan for the TypeScript reference implementation |

## GSFEN Traps (common agent errors)

- **Columns 9→1, not 1→9.** GSFEN rows itemize columns left-to-right from column 9 to column 1. The rightmost square in a row is column 1.
- **Rows 1→9 top-to-bottom.** Row 1 is the top row (Row 1 in Standard Diagram). Row 9 is the bottom row.
- **Stack letters bottom→top.** Within a stack group, the first letter is the bottom piece (Level 1), the last is the top. To find the top piece, read the last character.
- **Case = ownership.** Uppercase = White, lowercase = Black. A lowercase `m` is Black's Marshal, uppercase `M` is White's Marshal. Never confuse them.
- **Six turn tokens.** `w`/`b` (battle), `dw`/`db` (deploy, no done), `dwB`/`dbW` (deploy, opponent done). The placing player never carries the done flag — it is always the *opponent*.
- **Count omitted when 1.** In hands, `M` means 1 Marshal. `2M` means 2. Never write `1M`. In empty runs, a bare digit like `4` means 4 empty squares, not a piece.
- **Counter resets per phase.** The turn counter starts at 1 at the first placement and again at 1 at White's first battle turn. A battle-phase counter can exceed 50.

## Workflow Rules for Agents

1. **Never hand-write a GSFEN string without validating it.** Use the CLI (`npm run gsfen -- check "<string>"`) to confirm correctness before using any GSFEN in code or tests. A string that "looks right" is very often wrong in at least one of the traps above.
2. **No inline GSFEN strings in source or test code.** Every GSFEN string must live in a `.gsfen` fixture file under `gsfen/valid/` or `gsfen/invalid/` and be imported via the constants barrel (`oracle/src/gsfen/fixtures.ts`). Exceptions require a documented rationale in the commit message. A CI check (via `gsfen-find.sh`) enforces this after Phase 0 of the tooling plan (see `oracle/TOOLING.md`).
3. **Prefer an existing fixture over writing a new GSFEN string.** The `gsfen/valid/` directory contains curated fixtures. Derive or mutate from one of them rather than authoring from scratch. If you need a different state, apply GAN actions via `applyMove`/`applyArata`/`validatePlacement` to an existing fixture state.
4. **Use existing fixtures.** The `gsfen/` directory contains curated `.gsfen` fixture files split into `valid/` and `invalid/`. The constants barrel validates every `valid/` fixture against `validateState()` at module-init time. If you need a custom state, parse a fixture and mutate it rather than authoring GSFEN from scratch. Apply GAN actions via `applyMove`/`applyArata`/`validatePlacement` to derive new states.
5. **Learn from rule codes.** A C-code (C1-C7) is a canonical-form error — fix the string format. A V-code (V2-V7) is a semantic error — fix the position/hands/turn arrangement. A BR-xxx code is a business rule violation.
6. **Honour step-awareness markers.** Code marked `@internal`, `@step N`, or guarded by `throwIfNotImplemented` is scaffolding — it works for its limited purpose but will be replaced. Do not build on top of it. Tests using `it.fails` document behaviour that is known to be incomplete.

## Fixture Library

The 21 `.gsfen` files in `gsfen/` cover the major state shapes:

| Fixture | Description |
|---|---|
| `startpos` | Game start (empty board) |
| `all-on-board` | All pieces deployed |
| `battle-start` / `battle-midgame` | Battle-phase states |
| `black-done-declared` / `white-done-declared` | Deploy with done flag |
| `deploy-near-end` / `deploy-stacks-in-zones` | Deploy-phase shapes |
| `capture-aftermath` / `deep-capture-exchange` / `some-captured` | Post-capture states |
| `dense-engagement` / `sparse-board` | Board density extremes |
| `three-deep-stacks` / `triple-stack-battlefield` | Stack size extremes |
| `empty-hands-endgame` | Battle end with empty hands |
| `both-marshals-placed` / `white-marshal-at-5-9` | Marshal position states |
| `one-side-fully-deployed` | Asymmetric deploy |
| `white-done-multi-count-hand` | Hand with count ≥ 2 |

To use a fixture: read from `gsfen/<name>.gsfen`, parse, and mutate.

## GSFEN Finder

`oracle/script/gsfen-find.sh` — find all GSFEN strings across the project using a regex.

### How it works

The regex anchors on the position field's 8 forward slashes (9 rows), which is almost unique to GSFEN strings in code. The character class is broad (`[A-Za-z0-9,]`), so false positives are possible but false negatives are minimised. The regex also matches the `startpos` keyword.

```
startpos|[A-Za-z0-9,]+(/[A-Za-z0-9,]+){8} (w|b|dw|db|dwB|dbW) (-|[A-Za-z0-9]+) [1-9][0-9]*
```

### Usage

```bash
# Search project root (skips node_modules)
./oracle/script/gsfen-find.sh

# Search a specific path
./oracle/script/gsfen-find.sh gsfen/         # fixture files
./oracle/script/gsfen-find.sh oracle/tests/   # test files

# Exclude markdown files (GSFEN.md has many example strings)
./oracle/script/gsfen-find.sh . --no-md

# Highlight matches
./oracle/script/gsfen-find.sh gsfen/ --color
```

Output format: `file:line:match` (same as `grep -rn`).

### Requirements

Uses `ripgrep` if available, otherwise falls back to `grep -E` (GNU grep or compatible).
