# Gungi Testing Strategy

> Testing plan for the Gungi game logic core library and its supporting
> infrastructure. This document covers the complete testing ecosystem —
> from pre-implementation tooling through fuzz-based differential
> testing — and describes how each layer verifies correctness.

---

## 1. Testing Architecture Overview

**Differential testing model.** Two independent implementations of the
same rule set (BUSINESS_RULES.md) are built and tested against each other:

- **Oracle** — TypeScript. Naive, explicit, verbose, deliberately
  unoptimized. Authoritative reference for what constitutes a legal
  Action.
- **Core** — System-level language (C or Rust, TBD). Efficient,
  production target.

The two implementations communicate via the GSFEN/GAN boundary: a GSFEN
string represents a Game State, a GAN string represents an Action applied
to it. Both implementations must parse the same text formats and produce
identical results.

```
BUSINESS_RULES.md
    ├──→ Oracle (TypeScript, heavily tested)
    │         └──→ Visualizer tooling embeds Oracle directly
    └──→ Core (C/Rust, efficient)
              └──→ Differential testing against Oracle
```

---

## 2. Pre-Implementation Tooling

These tools are built before or alongside the Oracle. They require zero
game-logic code beyond GSFEN parsing.

### 2.1 GSFEN Visualizer — ✅ Implemented

A **static HTML page** that renders a Gungi board from a GSFEN string.

- **Input:** GSFEN string or `startpos` passed via URL query parameter
  (e.g., `?gsfen=startpos`).
- **Output:** A visual 9×9 board with:
  - Stack letters displayed bottom→top (case encodes ownership).
  - Hands contents for both players.
  - Turn token, phase indicator, and turn counter.
  - Mixed-ownership stacks clearly separated by level.
- **Use case:** Manual inspection of positions during test creation and
  debugging.
- **Delivery:** Standalone static HTML file (no server required).

### 2.2 Action Visualizer

A **server-side tool** that embeds the Oracle (TypeScript) and produces
an **interactive HTML page** showing all legal Actions from a given GSFEN
position.

- **Input:** GSFEN string via CLI argument.
- **Output:** Interactive HTML showing the board where:
  - Clicking a piece highlights all its legal destinations.
  - Each highlighted square is annotated with the reason it is reachable
    (e.g., "Range movement at size 2," "Jump blocked — target stack size
    too large").
  - Color coding distinguishes move types (step, limited range, range,
    jump) and special outcomes (Capture, Stack, Turncoat eligible).
- **Dependency:** Imports the Oracle's legal-action computation.
- **Use case:** Visual verification of Oracle correctness for specific
  positions; human-in-the-loop validation of edge cases.

---

## 3. Oracle Verification (Four-Legged Trust Strategy)

The Oracle must be trustworthy enough to act as reference for the Core.
Trust is established through four independent verification legs:

### Leg 1 — White-box testing
- Line and branch coverage targets (≥ 90% for movement rules, ≥ 80%
  overall).
- Every piece type × every direction × every stack size combination
  exercised.
- Every BR-xref has at least one matching test identifier in the code.
- GSFEN parser/serializer tested with hand-crafted edge cases.

### Leg 2 — Example-based testing (Gherkin + unit tests)
- Every business rule variant expressed as a Gherkin scenario or a
  table-driven unit test.
- Hand-crafted GSFEN+GAN sequences trace each BR from BUSINESS_RULES.md
  through the Oracle.
- Examples from GSFEN.md and GAN.md are valid test inputs and produce
  the documented outputs.

### Leg 3 — Visual confirmation
- Key positions (startpos, mid-deploy, mixed-ownership stacks, Exposure
  boundaries) rendered through the GSFEN Visualizer and Action Visualizer
  for human review.
- A reviewer signs off that the visual output matches the rules.

### Leg 4 — Mutual sanity (cross-implementation)
- Once the Core exists, a representative set of ~100 hand-picked
  GSFEN+GAN cases is run through both implementations.
- Any disagreement triggers investigation: either the Oracle or the
  Core has a bug.

---

## 4. Gherkin Test Suites

Gherkin (`.feature`) files serve as **living documentation** and an
**executable cross-language test harness**. Step definitions bind first
to the TypeScript Oracle; when the Core arrives, a second binding is
added, making the same scenarios drive both implementations.

Scenarios are organized by phase and rule group:

### 4.1 Deploy Phase (`deploy_phase.feature`)
- BR-DEPLOY-001 through BR-DEPLOY-012
- One scenario per BR variant. Examples:
  - "White places first" / "Black places after White"
  - "Marshal must be first placement"
  - "Placement outside deploy zone is illegal"
  - "Placement on top of friendly stack (size ≤ 3)"
  - "Placement on top of enemy stack is illegal"
  - "Placement on top of Marshal is illegal"
  - "Done declaration after placement"
  - "Opponent continues after Done"
  - "Both Done ends Deploy Phase"
  - "Exposure evaluation at boundary — White loses"
  - "Exposure evaluation at boundary — Black loses"
  - "Exposure evaluation at boundary — draw"
  - "Exposure evaluation at boundary — neither exposed"

### 4.2 Battle Phase: Movement (`battle_move.feature`)
- BR-MOVE-001 through BR-MOVE-005
- BR-MOVEMENT-001 through BR-MOVEMENT-005
- BR-PATH-001 through BR-PATH-002
- One scenario per BR variant. Examples:
  - "Move only the top piece of a stack"
  - "Origin must contain own piece"
  - "Stack size landing restriction — source < target → illegal"
  - "Stack size landing restriction — source ≥ target → legal"
  - "Step movement to an allowed direction"
  - "Step movement to a disallowed direction"
  - "Limited range movement within range"
  - "Limited range movement beyond range"
  - "Limited range movement blocked by obstruction"
  - "Range movement along a line"
  - "Range movement blocked by friendly piece (ends at blocker)"
  - "Range movement blocked by enemy piece (ends at blocker)"
  - "Jump movement over empty squares"
  - "Jump movement blocked by large stack on jumped-over square"
  - "Stack scaling: size 2 adds +1 to range"
  - "Stack scaling: size 3 adds +2 to range"

### 4.3 Battle Phase: Stacking and Capture (`battle_stack_capture.feature`)
- BR-STACK-001 through BR-STACK-005
- BR-CAPTURE-001 through BR-CAPTURE-004
- One scenario per BR variant. Examples:
  - "Stacking on enemy square (all conditions met)"
  - "Stacking on enemy square — target size 3 → Capture forced"
  - "Stacking on enemy square — Marshal on top → Capture forced"
  - "Stacking on friendly square (automatic)"
  - "Stacking on full friendly stack (size 3) → illegal"
  - "Capture removes all enemy pieces from target stack"
  - "Capture leaves friendly pieces below intact"
  - "Captured pieces never enter Hand"

### 4.4 Turncoat (`turncoat.feature`)
- BR-STACK-006
- **First-class test suite** covering all activation paths and edge cases:
  - "Move onto enemy stack with Stack chosen, swap Level 1"
  - "Move onto enemy stack with Stack chosen, swap Level 2"
  - "Move onto enemy stack with Stack chosen, swap Levels 1 and 2"
  - "Move onto friendly stack with enemy pieces below, swap via Stack"
  - "Arata onto friendly stack with enemy pieces below, swap"
  - "Stack chosen but Turncoat declined entirely"
  - "Capture chosen instead of Stack → Turncoat does not trigger"
  - "Swap requires matching piece type in Hand"
  - "Two swaps at different levels require two Hand copies of same type"
  - "Partial swap: swap Level 1 only, decline Level 2"
  - "Self-Check evaluated post-swap state (not pre-swap)"

### 4.5 Battle Phase: Arata (`battle_arata.feature`)
- BR-ARATA-001 through BR-ARATA-007
- One scenario per BR variant. Examples:
  - "Arata replaces a move (one per turn)"
  - "Arata with piece from Hand"
  - "Arata with piece not in Hand → illegal"
  - "Arata placement zone — within zone"
  - "Arata placement zone — beyond most advanced piece"
  - "Arata on empty square"
  - "Arata stacking on friendly piece"
  - "Arata on enemy stack → illegal"
  - "Arata on Marshal → illegal"

### 4.6 Battle Phase: Terminal Conditions (`battle_terminal.feature`)
- BR-TERMINATION-001 through BR-TERMINATION-002
- BR-REPETITION-001
- BR-ACTION-002 (Self Check)
- One scenario per BR variant. Examples:
  - "Checkmate — in Check with no legal moves"
  - "Stalemate — not in Check with no legal moves"
  - "Play that leaves own Marshal in Check → illegal (Self Check)"
  - "Play that removes own Marshal from Check → legal"
  - "Repetition draw on fourth occurrence"
  - "Deploy Phase states do not count toward Repetition"
  - "Initial Battle Phase state counts as first occurrence"

### 4.7 GAN Grammar (`gan_grammar.feature`)
- GAN ABNF rules + canonicalization rules (A1–A6)
- Examples:
  - "Parse a Placement: M5-9"
  - "Parse a Placement with Done: P3-8!"
  - "Parse a Move: 2-7>2-6"
  - "Parse a Move with outcome: 5-6>5-5="
  - "Parse a Move with outcome and Turncoat: 5-6>5-5=+2"
  - "Parse an Arata: T*5-6"
  - "Round-trip: serialize then parse yields original GAN"
  - "Canonicity violation A1 — redundant outcome token → rejected"
  - "Canonicity violation A3 — levels not ascending → rejected"

---

## 5. Unit Tests (Oracle)

Unit tests are written in TypeScript alongside the Oracle code, using a
standard test framework (Jest or Vitest).

### 5.1 Single-Piece Movement Table

Parametric (table-driven) tests covering every piece type at every stack
size, for every direction and obstruction pattern.

```
Test template:  for movementClass in [Step, LimitedRange, Range, Jump]:
                  for piece in [all 14 types]:
                    for size in [1, 2, 3]:
                      for direction in piece.allowedDirections[size]:
                        for obstruction in [clear, friendly, enemy]:
                          test(piece, size, direction, obstruction)
```

Key coverage dimensions:
- Each piece type exercises its movement rules at all three stack sizes
  (size 1 = base, size 2 = +1 bonus, size 3 = +2 bonus).
- Step → LimitedRange transition at sizes 2–3 is verified.
- LimitedRange extension (1–2 → 1–3 → 1–4) is verified.
- Range movement is verified to extend to board edge or first obstruction.
- Jump movement is verified against:
  - Blocked: jumped-over stack size > source stack size.
  - Unblocked: jumped-over stack size ≤ source stack size.
  - All jumped-over squares empty (ideal path).
- Obstruction rules per BR-PATH-001/BR-PATH-002.

### 5.2 GSFEN Parser/Serializer Round-Trip

```typescript
test("parse(serialize(state)) == state for all canonical fields")
for each field (position, turn, hands, counter)
  test("field round-trips without data loss")
test("non-canonical input is rejected per C1–C7")
test("startpos keyword expands correctly")
```

---

## 6. Invariant-Based Property Tests

Property tests are derived from `INVARIANTS.md` (a separate document
covering Layer 1: domain invariants and Layer 2: state-transition
invariants). These tests run against the Oracle and, once available, the
Core.

### Example invariants (representative, not exhaustive):
- **Stack size invariant:** After any legal Action, every occupied square
  has stack size ∈ {1, 2, 3}.
- **Marshal top invariant:** If a Marshal is on the board, it is always
  the last letter in its stack group.
- **Inventory invariant:** For each player and piece type,
  count_on_board + count_in_hand ≤ initial_count.
- **Self-Check invariant:** After a legal Play, the Active Player's
  Marshal is never under Attack.
- **Turn alternation invariant:** After any Play, Active Player changes.
- **Illegal action invariant:** An illegal Action returns the same Game
  State unchanged.
- **Hand depletion invariant:** Arata removes exactly one piece from Hand.
- **Capture removal invariant:** After a Capture, captured pieces are
  absent from both the board and both Hands.

Property tests use fast-check (or similar) to generate random valid Game
States and validate the invariants hold.

---

## 7. Differential Testing (Core vs. Oracle)

Once the Core exists, every test case that applies to both
implementations is run against both. The comparison happens at the
GSFEN/GAN text boundary.

### 7.1 Input generation
- **Seeded GAN sequences:** 1 to 150 actions, starting from `startpos`,
  generated with biasing toward plausible moves (correct origin squares,
  piece types that exist, etc.).
- **Hand-crafted suites:** All Gherkin scenarios, all unit test cases,
  all regression entries — executed against both implementations.

### 7.2 Comparison protocol
1. Take GSFEN `S` and GAN action `A`.
2. Apply `A` to Oracle → produces `S₁` or `Illegal`.
3. Apply `A` to Core → produces `S₂` or `Illegal`.
4. Assert: `(result₁ == result₂)`, with equality defined as string
   equality of the output GSFEN (or both returning Illegal).

### 7.3 Fuzz testing
- **Target:** Sequences of 1–150 GAN actions from `startpos`.
- **Generator:** Biases toward legal-adjacent actions (pieces that exist,
  squares within board, plausible stack sizes) to produce a higher
  proportion of game-logic-exercising inputs than pure randomness.
- **Oracle:** The TypeScript Oracle's result for each action.
- **Duration:** Configurable (minutes, hours, or number of sequences).
- **Regression extraction:** Any divergent pair (Core ≠ Oracle) is
  reduced to a minimal reproduction case and added to the regression
  suite (see §8).

---

## 8. Regression Suite

The regression suite is a **curated set of GSFEN+GAN sequences** that
document every known bug or ambiguity.

### Growth triggers
- **Trigger A — Bug fix:** Every bug found in either implementation must
  be preceded by adding its minimal reproduction case to the regression
  suite.
- **Trigger B — Fuzz discovery:** When the fuzzer finds a divergence
  between Core and Oracle, the minimal reproduction case is extracted and
  added.
- **Trigger C — BR increment (implicit):** When BUSINESS_RULES.md is
  updated to clarify a rule, new test scenarios are added by definition
  as part of the update.

### Regression layout

```
regression/
├── README.md              # How to add and run regression cases
├── cases/
│   ├── BR-DEPLOY-003--marshal-not-first.json
│   ├── BR-MOVE-005--stack-size-landing-restriction.json
│   ├── BR-STACK-006--turncoat-both-levels.json
│   ├── fuzz-2026-07-26--deep-repetition-edge.json
│   └── ...
```

Each case is a JSON file with:
```json
{
  "id": "unique-name",
  "source": "fuzz | bug-fix | br-increment",
  "gsfen": "<starting state>",
  "actions": ["<GAN1>", "<GAN2>", ...],
  "expected": "<final GSFEN or 'Illegal'>",
  "description": "What this case exercises and why it matters"
}
```

---

## 9. Testing Flow Summary

```
                    ┌──────────────────────┐
                    │  BUSINESS_RULES.md    │
                    └──────┬───────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐  ┌──────────┐  ┌──────────┐
     │ Gherkin    │  │ Oracle   │  │ INVARIANTS│
     │ (.feature) │  │ Unit     │  │ .md       │
     │ Step defs  │  │ Tests    │  │           │
     └──────┬─────┘  └────┬─────┘  └─────┬────┘
            │              │              │
            ▼              ▼              ▼
     ┌─────────────────────────────────────────┐
     │         TypeScript Oracle (TS)          │
     │   Verified via 4 legs + property tests  │
     └───────────────────┬─────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
     ┌────────────────┐   ┌────────────────┐
     │ Action         │   │ Core (C/Rust)  │
     │ Visualizer     │   │ Efficient impl │
     └────────────────┘   └───────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Differential   │
                         │  Fuzz Testing   │
                         │  (1–150 actions)│
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌────────────────┐
                         │   Regression   │
                         │     Suite      │
                         └────────────────┘
```

---

## Appendix: File Map

| File | Purpose |
|------|---------|
| `TEST.md` | This document |
| `INVARIANTS.md` | Domain invariants (Layer 1) and state-transition invariants (Layer 2) |
| `BUSINESS_RULES.md` | Source of truth for all rules |
| `GAN.md` | GAN grammar specification |
| `GSFEN.md` | GSFEN format specification |
| `oracle/src/` | TypeScript Oracle implementation |
| `oracle/tests/` | Unit tests, property tests, Gherkin step definitions |
| `core/` | C/Rust Core implementation |
| `visualizers/gsfen.html` | Static GSFEN visualizer ✅ |
| `visualizers/action/` | Action visualizer (server-side tool, generates HTML) |
| `features/` | Gherkin `.feature` files |
| `regression/cases/` | JSON regression test cases |
