# GSFEN Rule Reorganisation — Migration Guide

**Date:** 2026-07-28  
**Purpose:** Document the reorganisation of GSFEN.md canonical-form and
semantic-validity rules, mapping old codes to new codes.

---

## What changed

### Design goals

The canonicity goal was sharpened to disambiguate the `startpos` keyword:

> **Before:** "Exactly one valid spelling exists per state."
> **After:** "Exactly one expanded spelling exists per state (the `startpos`
> keyword is an input-only shorthand)."

The `startpos` section now explicitly states: *"The serializer never emits
the keyword; the expanded form is the canonical spelling."*

### Canonical-form rules (BR-GSFEN-CANON-*)

**Old scheme:** Seven flat codes `BR-GSFEN-CANON-001` through `-007` with
overloaded scope (CANON-001 caught 5 distinct error kinds; CANON-002 caught
5 more).

**New scheme:** Rules are organised by the field they constrain, with
sub-codes for specific error kinds.

| Old code | New code | Notes |
|---|---|---|
| CANON-001 (field count) | `BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT` | — |
| CANON-001 (whitespace) | `BR-GSFEN-CANON-SEPARATOR-WHITESPACE` | — |
| CANON-002 (row count) | `BR-GSFEN-CANON-POSITION-ROW-COUNT` | — |
| CANON-002 (9 squares) | `BR-GSFEN-CANON-POSITION-SQUARE-COUNT` | — |
| CANON-003 | `BR-GSFEN-CANON-POSITION-COMPRESSION` | — |
| CANON-004 | `BR-GSFEN-CANON-POSITION-STACK-SPELLING` | Also now mentions the 1–3 depth check (defence-in-depth) |
| CANON-002 (empty item) | `BR-GSFEN-CANON-POSITION-EMPTY-ITEM` | — |
| CANON-002 (unknown piece) | `BR-GSFEN-CANON-POSITION-STACK-SPELLING` | Subsumed under stack spelling |
| — (invalid turn) | `BR-GSFEN-CANON-TURN-TOKEN` | Previously assigned CANON-001 |
| CANON-005 (empty marker) | `BR-GSFEN-CANON-HANDS-EMPTY-MARKER` | — |
| CANON-005 (section order) | `BR-GSFEN-CANON-HANDS-SECTION-ORDER` | — |
| CANON-005 (alphabetical) | `BR-GSFEN-CANON-HANDS-ALPHABETICAL` | — |
| CANON-005 (duplicate) | `BR-GSFEN-CANON-HANDS-DUPLICATE` | — |
| CANON-005 (count format) | `BR-GSFEN-CANON-HANDS-COUNT-FORMAT` | — |
| CANON-005 (unexpected char) | `BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR` | — |
| CANON-006 (leading zero) | `BR-GSFEN-CANON-COUNTER-LEADING-ZERO` | — |
| CANON-006 (positive) | `BR-GSFEN-CANON-COUNTER-POSITIVE` | — |
| CANON-007 | `BR-GSFEN-CANON-KEYWORD-CASE` | — |

### Semantic-validity rules (BR-GSFEN-VALID-*)

| Old code | New code | Status |
|---|---|---|
| VALID-001 (grammar/canon metarule) | *deleted* | Became a prose preface: "All rules assume canonical form." |
| VALID-002 (stack size) | *deleted* | Check moved to parser (defence-in-depth under CANON-POSITION-STACK-SPELLING). |
| VALID-003 (Marshal integrity) | `BR-GSFEN-VALID-001` | Renumbered and split into 5 sub-codes (see below). |
| VALID-004 (inventory) | `BR-GSFEN-VALID-002` | Renumbered. Added deploy-phase strict equality (`=`, not `≤`). |
| VALID-005 (Done flags) | `BR-GSFEN-VALID-003` | Renumbered. |
| VALID-006 (deploy constraints) | `BR-GSFEN-VALID-004` | Renumbered. |
| VALID-007 (counter bounds) | `BR-GSFEN-VALID-005` | Renumbered. Removed `≥ 1` sub-check (parser guarantees it). Now only enforces deploy ≤ 50. |
| VALID-008 (empty hands) | *deleted* | Fully enforced by parser (CANON-HANDS-EMPTY-MARKER). |

### Marshal integrity sub-codes

The former VALID-003 is now `BR-GSFEN-VALID-001` with five sub-codes so
consumers can branch on the specific violation:

| Sub-code | Meaning |
|---|---|
| `BR-GSFEN-VALID-001-TOP` | Marshal not at top (last) of its stack group (BR-STACK-004) |
| `BR-GSFEN-VALID-001-COUNT` | Battle phase: Marshal appears ≠ 1 time on board (BR-DEPLOY-003) |
| `BR-GSFEN-VALID-001-HAND` | Battle phase: Marshal in Hand (BR-DEPLOY-011) |
| `BR-GSFEN-VALID-001-BOTH` | Deploy phase: Marshal simultaneously on board and in Hand (BR-DEPLOY-003) |
| `BR-GSFEN-VALID-001-FIRST` | Deploy phase: Marshal in Hand but player has pieces on board (BR-DEPLOY-003) |

### Inventory conservation change

`BR-GSFEN-VALID-002` now has two sub-conditions:

| Context | Condition |
|---|---|
| Any phase | `board[type] + hand[type] ≤ initial[type]` |
| Deploy phase only | `board[type] + hand[type] = initial[type]` |

The "strictly smaller" note is kept as prose — a consequence of captures,
not an independently enforceable constraint in battle phase.

---

## Impact on code

### Parsers and validators

The parser (`oracle/src/gsfen/parse.ts`) should be updated to use the new
`BR-GSFEN-CANON-*` error codes. Specifically:

- CANON-001 errors → split into `-SEPARATOR-FIELD-COUNT` and
  `-SEPARATOR-WHITESPACE`
- CANON-002 errors → split into `-POSITION-ROW-COUNT`,
  `-POSITION-SQUARE-COUNT`, `-POSITION-EMPTY-ITEM`,
  `-POSITION-STACK-SPELLING`
- CANON-003 → `-POSITION-COMPRESSION`
- CANON-005 errors → split into the `-HANDS-*` sub-codes
- CANON-006 errors → split into `-COUNTER-LEADING-ZERO` and
  `-COUNTER-POSITIVE`
- CANON-007 → `-KEYWORD-CASE`
- Invalid turn token → `-TURN-TOKEN` (was CANON-001)

The semantic validator (`oracle/src/gsfen/validate.ts`) should be updated:

- Remove VALID-002 check entirely
- Remove VALID-008 (empty hands) — nothing to validate
- Remove `counter >= 1` from the VALID-007 (now VALID-005) check
- Split VALID-003 into the five `-001-*` sub-codes, each returning its own
  `GameError.rule`
- Add deploy-phase strict equality to inventory conservation
- Renumber all VALID codes

### The `GameRule` union

`oracle/src/errors.ts` (if the B2 refactoring has been applied) must add
the new codes and remove the deleted ones.

### Tests

Every test that asserts `error.rule === 'BR-GSFEN-CANON-003'` (or any old
code) must be updated to assert the corresponding new code. See the tables
above for the mapping.

---

## Summary of deleted rules

| Code | Reason |
|---|---|
| `BR-GSFEN-VALID-001` | Metarule — replaced by prose preface |
| `BR-GSFEN-VALID-002` | Parser guarantee — not a semantic concern |
| `BR-GSFEN-VALID-008` | Parser guarantee — not a semantic concern |
