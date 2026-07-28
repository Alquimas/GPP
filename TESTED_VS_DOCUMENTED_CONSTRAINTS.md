# Tested vs Documented Constraints Report

**Generated:** 2026-07-28  
**Purpose:** Inventory of all validation constraints tested in code vs documented in GSFEN.md and GAN.md, to guide documentation alignment and identify gaps.

---

## Source Files Analyzed

| Domain | Test Files | Source Files |
|--------|-----------|--------------|
| GAN parse | `oracle/tests/gan/parse.test.ts` (452 lines) | `oracle/src/gan/parse.ts` |
| GAN validate | `oracle/tests/gan/validate.test.ts` (225 lines) | `oracle/src/gan/validate.ts` |
| GAN serialize | `oracle/tests/gan/serialize.test.ts` (1026 lines) | `oracle/src/gan/serialize.ts` |
| Game deploy | `oracle/tests/game/deploy.test.ts` (171 lines) | `oracle/src/game/deploy.ts` |
| Game battle | `oracle/tests/game/battle.test.ts` (402 lines) | `oracle/src/game/battle.ts` |
| Constants | `oracle/tests/constants.test.ts` (81 lines) | `oracle/src/constants.ts` |
| Types | `oracle/tests/types.test.ts` (353 lines) | `oracle/src/types.ts` |

**Documents:** `GSFEN.md` (299 lines), `GAN.md` (438 lines), `BUSINESS_RULES.md` (980 lines)

---

## Naming Convention

All constraint codes follow the `BR-<CATEGORY>-<NNN>` pattern established in BUSINESS_RULES.md:

| Prefix | Domain | Meaning |
|--------|--------|---------|
| BR-GAN-CANON-xxx | GAN | Canonical form rules (replaces A1-A6) |
| BR-GAN-VALID-xxx | GAN | Semantic validity rules (replaces S1-S6) |
| BR-DEPLOY-xxx | Game | Deploy phase rules |
| BR-MOVE-xxx | Game | Move rules |
| BR-STACK-xxx | Game | Stack rules |
| BR-CAPTURE-xxx | Game | Capture rules |
| BR-ARATA-xxx | Game | Arata rules |
| BR-ACTION-xxx | Game | Action validation rules |
| BR-PLAY-xxx | Game | Play rules |

---

## PART 2 — GAN Constraints

### BR-GAN-CANON-001 (was A1) — No optional token without optionality / Grammar

**Note:** In code, CANON-001 is used as a catch-all for *any* grammar-level parse error, not just the documented optional-token rule.

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| `outcome` present only when both Stack and Capture legal | ✅ GAN.md A1 | ✅ `3-3>3-2x` parses (semantic check), `5-6>5-5` parses (semantic check) | ✅ semantics in S3/VALID-003 |
| Empty string | ❌ not documented | ✅ → CANON-001 | Document |
| Lowercase piece letter in placement/arata | ❌ not documented | ✅ `'m5-9'` → CANON-001 | Document |
| Unknown piece letter | ❌ not documented | ✅ `'X5-9'` → CANON-001 | Document |
| Invalid square (col=0, row=0, col=10, malformed `5-`, `-9`, `5`) | ❌ not documented | ✅ all → CANON-001 | Document |
| Missing `>` in move | ❌ not documented | ✅ `'2-72-6'` → CANON-001 | Document |
| Multiple `>` in move | ❌ not documented | ✅ `'5-6>5-5>5-4'` → CANON-001 | Document |
| `5-8-5-7` (uses `-` instead of `>`) | ✅ GAN.md example | ✅ → CANON-001 | — |
| Invalid starting character | ❌ not documented | ✅ `'?5-9'` → CANON-001 | Document |

### BR-GAN-CANON-002 (was A2) — Turncoat lists only real, elected swaps

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| No level unless eligible and elected; absence = decline | ✅ GAN.md A2 | ✅ property test: `+` present ⇔ `turncoat.length > 0` | — |
| Full eligibility check (enemy present, hand has match) | ✅ GAN.md A2 | ❌ not yet implemented (TODO in VALID-005) | Known gap |

### BR-GAN-CANON-003 (was A3) — Levels ascending, no duplicates

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| Only `1`, `2`, or `12` | ✅ GAN.md grammar | ✅ `parseTurncoat` only accepts `+1`, `+2`, `+12` | — |
| `+21` rejected (not ascending) | ✅ GAN.md A3 | ✅ → error | — |
| `+3` rejected (invalid level) | ✅ GAN.md A3 (example) | ✅ → error | — |
| `+` alone rejected (empty) | ❌ not documented | ✅ → error | Document |
| `1` without `+` prefix rejected | ❌ not documented | ✅ `parseTurncoat('1')` → error | Document |
| Serialized output never `+21`, `+11`, `+22` | ❌ not documented | ✅ property test | Document |

### BR-GAN-CANON-004 (was A4) — Done only as a Placement suffix

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| `!` never standalone, never on Move/Arata | ✅ GAN.md A4 | ✅ `M5-9!!` → CANON-004; `M!5-9` → CANON-004 | — |
| Property: `!` appears ⇔ placement with `done=true` | ❌ not documented | ✅ property test | Document |

### BR-GAN-CANON-005 (was A5) — No whitespace

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| One space separates actions in list; no whitespace inside single action | ✅ GAN.md A5 | ✅ leading/trailing/internal whitespace → CANON-005 | — |

### BR-GAN-CANON-006 (was A6) — No annotation tokens

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| No characters beyond grammar | ✅ GAN.md A6 | ✅ `T*5-6x` → CANON-006; `5-6>5-5$` → CANON-006 | — |
| Trailing characters after full parse | ❌ not documented | ✅ → CANON-006 | Document |
| Property: no `#`, `[`, `]`, `{`, `}` | ❌ not documented | ✅ property test | Document |

---

### BR-GAN-VALID-001 (was S1) — Phase match

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| Placement only in Deploy Phase | ✅ GAN.md S1 | ✅ placement in battle → VALID-001 | — |
| Move/Arata only in Battle Phase | ✅ GAN.md S1 | ✅ move/arata in deploy → VALID-001 | — |
| All 6 combinations covered | ❌ not documented | ✅ 6 explicit tests | Document |

### BR-GAN-VALID-002 (was S2) — Placement legality

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| Piece in hand | ✅ GAN.md S2 | ✅ piece not in hand → VALID-002 | — |
| Marshal must be first placement | ✅ GAN.md S2 | ✅ non-Marshal when Marshal in hand → VALID-002 | — |
| Square within deploy zone | ✅ GAN.md S2 | ✅ outside zone → VALID-002 | — |
| Square empty or friendly-topped under size 3 | ✅ GAN.md S2 | ❌ only tested at game level (BR-DEPLOY-005) | Implement in GAN validate |

### BR-GAN-VALID-003 (was S3) — Move legality

**Status in GAN validate.ts:** Stub — always returns `{ ok: true }`.  
**Implemented in:** `game/battle.ts` `validateMove()` with BR-xxx codes.

| Aspect | Documented | Tested in GAN validate | Tested in game/battle |
|--------|-----------|----------------------|----------------------|
| Phase check | ✅ GAN.md S3 | ❌ | ✅ BR-PLAY-002 |
| Origin contains own piece | ✅ GAN.md S3 | ❌ | ✅ BR-MOVE-002 |
| Destination reachable | ✅ GAN.md S3 | ❌ | ✅ BR-MOVE-003 |
| Stack-size landing restriction | ✅ GAN.md S3 | ❌ | ✅ BR-MOVE-003 |
| Outcome token correctness | ✅ GAN.md S3/A1 | ❌ | ✅ BR-MOVE-004, BR-CAPTURE-002, BR-STACK-002 |
| No stacking on Marshal | ✅ GAN.md S3 (via STACK-004) | ❌ | ✅ BR-STACK-004 |
| Self Check | ✅ GAN.md S3 | ❌ | ✅ BR-ACTION-002 |
| Friendly stacking automatic | ❌ not in GAN.md | ❌ | ✅ BR-STACK-003 |
| Turncoat rejection | ❌ not in GAN.md | ❌ | ✅ BR-STACK-006 (stub) |

### BR-GAN-VALID-004 (was S4) — Arata legality

**Status in GAN validate.ts:** Stub — always returns `{ ok: true }`.  
**Implemented in:** `game/battle.ts` `validateArata()` with BR-xxx codes.

| Aspect | Documented | Tested in GAN validate | Tested in game/battle |
|--------|-----------|----------------------|----------------------|
| Phase check | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-001 |
| Piece in hand, not Marshal | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-002/007 |
| Destination in Arata zone | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-003 |
| Dest empty or friendly under size 3 | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-005 |
| Not on enemy stack | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-006 |
| Not on Marshal | ✅ GAN.md S4 | ❌ | ✅ BR-ARATA-007 |
| Self Check | ✅ GAN.md S4 | ❌ | ✅ BR-ACTION-002 |
| Turncoat rejection | ❌ not in GAN.md | ❌ | ✅ BR-STACK-006 (stub) |

### BR-GAN-VALID-005 (was S5) — Turncoat legality

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| Piece is Captain and outcome is Stacking | ✅ GAN.md S5 | ✅ non-Captain arata → VALID-005; capture-outcome move → VALID-005 | — |
| Each level had opposing piece; Hand has replacement | ✅ GAN.md S5 | ❌ marked as TODO in code | Implement |
| Turncoat accepted on Captain+stack move | ❌ not in test docs | ✅ | Document |
| Turncoat accepted on Captain arata | ❌ not in test docs | ✅ | Document |

### BR-GAN-VALID-006 (was S6) — Done legality

| Aspect | Documented | Tested | Gap |
|--------|-----------|--------|-----|
| `!` only after Placement | ✅ GAN.md S6 | ✅ placement with `done=true` accepted; `done=false` accepted | — |
| Grammar enforced by CANON-004 | ✅ GAN.md S6 | ✅ | — |

### Tested but Not Documented — GAN

| Aspect | Where tested |
|--------|-------------|
| **Turncoat `+12` (both levels)** — parsing and serialization | `parse.test.ts:86-88`, `serialize.test.ts:80-82` |
| **Turncoat on move with forced outcome + turncoat** (`5-6>5-5+2`) | `serialize.test.ts:215-224` |
| **Turncoat on capture outcome** (`5-6>5-5x+1`) — semantically invalid but parseable | `parse.test.ts:326-332`, `serialize.test.ts:476-485` |
| **All 14 piece types in placements and aratas** — 28 tests | `parse.test.ts:278-303` |
| **Square boundary values** (1-1 and 9-9) | `parse.test.ts:306-314`, `serialize.test.ts:544-563` |
| **Property-based grammar compliance** — 4 properties × 100 random actions | `serialize.test.ts:748-848` |
| **Property-based inverse property** (parse∘serialize = id) | `serialize.test.ts:965-1025` |
| **ValidateArata includes `afterState`** with piece placement and hand subtraction | `battle.test.ts:338-351` |
| **ValidatePlay dispatch** to validateMove/validateArata/validatePlacement | `battle.test.ts:358-401` |
| **ValidateMove: outcome null on empty square; outcome required when choice exists; forced capture** | `battle.test.ts:119-158` |
| **ValidateMove: friendly stacking automatic; no outcome token on friendly** | `battle.test.ts:176-192` |
| **ValidateMove: no stacking on Marshal (friendly/enemy)** | `battle.test.ts:195-216` |
| **ValidateMove: Self Check** | `battle.test.ts:219-234` |
| **ValidateArata: most-advanced-piece zone boundary** | `battle.test.ts:281-292` |

---

## PART 3 — Structural Issues Found

### 1. GAN `validate.ts` has stubs for S3/VALID-003 and S4/VALID-004

The GAN semantic validator `src/gan/validate.ts` has `checkMoveLegality` and `checkArataLegality` both stubbed to `return { ok: true }`. The actual validation lives in `src/game/battle.ts`. Calling `validateAction` with a move action will pass S3 even if the move is illegal. The documentation needs to clarify this split, or the code needs integration.

### 2. `BR-GAN-CANON-001` (A1) is overloaded

In GSFEN, each CANON-xxx code is well-scoped. In GAN, CANON-001 is used for:
- The documented "optional token when not optional" rule
- Every grammar-level parse failure (empty input, invalid piece letter, invalid square, missing separator, wrong starting character, etc.)
- This means callers cannot distinguish "grammar malformed" from "optional token misused" without parsing the error message string.

---

## PART 4 — Recommendations

### Priority additions to GAN.md

1. **Define CANON-001 scope precisely** — Either expand its documented scope to cover all grammar errors, or introduce a separate code (e.g. BR-GAN-GRAM-001) for malformed grammar.
2. **Document S3/S4 implementation split** — The GAN spec says these belong to validation, but they're only in game/battle.ts. Document the relationship.
3. **Document S5 sub-check status** — Note that full eligibility verification (enemy present, hand has match) is not yet implemented.
4. **Add boundary values section** — Square notation `1-1` through `9-9` with explicit boundary behavior.
