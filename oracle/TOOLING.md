# Oracle Agent Tooling Plan

> Tools and structural work to make the codebase more navigable and less
> error-prone for AI agents. Derived from a grilling session focused on
> "what tools help agents investigate the codebase and write better code."

## Design principles

- **Make the code honest first**, build tools second. A misleading module
  boundary is worse than no tool at all.
- **Thin over thick** — the thinnest script that catches the mistake is
  better than an interactive tool that nobody runs.
- **Single source of truth** per concern. Duplicated validation logic
  produces silent drift; duplicated fixture strings produce silent format
  errors.
- **Import from a constant, never type a GSFEN string.** The project
  enforces this in CONTEXT.md.

## Tool suite

### T1 — GSFEN fixture catalog (Phase 0) (complete)

Replace all inline GSFEN strings across the codebase with named constants
from a central barrel, validated at module-init time.

**Current state (curation complete):**

```
oracle/fixtures/
├── valid/                         # 48 .gsfen — all pass validateState
│   ├── all-on-board.gsfen
│   ├── battle-start.gsfen
│   ├── ...
│   └── white-marshal-at-5-9.gsfen
├── invalid/
│   └── parse/                     # 8 .gsfen — format errors (C-code failures)
│       ├── c2-unknown-piece.gsfen
│       ├── c3-adjacent-empty-runs.gsfen
│       ├── c5-duplicate-letter.gsfen
│       ├── c5-non-alphabetical.gsfen
│       ├── c6-leading-zero-counter.gsfen
│       ├── c6-leading-zero-counter-full.gsfen
│       ├── row-not-9.gsfen
│       └── stack-of-four.gsfen
└── gsfen-fixture-report.html      # validation report (generated, not tracked)
```

**Curation notes:**

- All 56 `.gsfen` files have been sorted into `valid/` or `invalid/parse/`.
  No root-level `.gsfen` files remain.
- 4 fixtures originally in `invalid/` passed validation — they were moved
  to `valid/` after confirmation:
  `deploy-enemy-top`, `gan-battle-state`, `mp-stack-deploy-ctr2`,
  `v3-black-marshal-wrong-zone`.
- The `invalid/` directory now contains only format-error fixtures in its
  `parse/` subdirectory. All intentionally fail at the parse stage (C-rule).

**Barrel:** `oracle/src/gsfen/fixtures.ts` exports all 56 fixtures as
named constants (SCREAMING_SNAKE_CASE) and provides a `FIXTURES` lookup
record. Module-init `validateState()` is not done in the barrel due to a
circular dependency (parse → constants → fixtures); valid fixtures are
confirmed at curation time via the GSFEN CLI and fixture report.

**Policy:** No inline GSFEN strings anywhere in `src/` or `tests/` — every
string lives in a `.gsfen` file. Enforced by CONTEXT.md and a CI check
(see T3).

**Deferred:** How to handle "valid but transitional" states that test
incomplete features. Decide when the healing pass (Phase 1) reveals the
actual shape.

### T2 — Rule browser (Phase 3) ✅

A script that, given a BR-xxx code, returns:

- The rule text from BUSINESS_RULES.md
- Files that enforce it (source)
- Tests that exercise it
- ORACLE.md step reference
- REFINING.md references
- Related rules
- Other document references (GAN.md, TEST.md)

**Usage:**
```bash
oracle/script/browse-rule.sh BR-MOVE-005   # show one rule
oracle/script/browse-rule.sh --all          # list all known BR-xxx codes
oracle/script/browse-rule.sh --help         # full help
```

See the script at `oracle/script/browse-rule.sh`. Uses ripgrep if available,
falls back to grep with ERE.

### T3 — GSFEN string scan (existing)

`gsfen-find.sh` already scans for inline GSFEN strings. After Phase 0, it
doubles as a CI enforcement tool — any inline GSFEN string that survives is
a policy violation.

### T4 — GSFEN CLI (existing)

`gsfen.ts` — validate and visualize GSFEN strings. `gsfen check` / `gsfen show`.
Stays as-is; may absorb the `apply` subcommand when the GAN visualizer is built.

### T5 — GAN visualizer, thin (Phase 4)

A `gsfen apply <gsfen> <gan>` command that applies a GAN action to a GSFEN
state and renders the resulting board through the existing `show` visualizer.

**Dependency:** Requires stable `applyMove`/`applyArata` (post-healing-pass).

## Structural work

### S1 — Healing pass (Phase 1)

Execute all 22 fixes from `REFINING.md` in dependency order (Phase 0→14).
Each fix ends with a "similar-problem scan" that hunts the same defect class
across the rest of the codebase.

### S2 — Step-awareness redesign (Phase 2)

After the healing pass, retrofit explicit honesty markers:

- `throwIfNotImplemented(step, feature)` at entry points of incomplete paths
- `@step N` JSDoc tags on modules/functions documenting their build-status
- Incomplete features use `it.fails` in tests so the suite documents gaps
- No export of "scaffolding" functions from the public barrel

## Phasing & dependencies

```
Phase 0: GSFEN extraction & curation
  │  replaces all inline GSFEN with fixture references
  │
  ▼
Phase 1: Healing pass (REFINING.md)
  │  fixes invented rules, duplicated logic, dead types,
  │  mislabeled tests — all on clean fixture base
  │
  ▼
Phase 2: Step-awareness redesign
  │  throwIfNotImplemented, @step tags, test markers
  │
  ▼
Phase 3: Rule browser (browse-rule.sh) ✅
  │  T2 complete — see oracle/script/browse-rule.sh
  │
  └──▶ Phase 4: GAN visualizer (thin)
         requires stable applyMove/applyArata from Phase 1-2
```

## Open questions (deferred)

1. **Transitional fixtures** — how to handle test states that are valid GSFEN
   but not canonical (e.g., weird turn counter). Decide after curation reveals
   the shape of existing edge cases.

2. **Tool consolidation** — whether `gsfen-find.sh` and `gsfen.ts` and the
   new `browse-rule.sh` should be a single CLI with subcommands, or stay as
   independent scripts. Defer until the suite has three or more tools.

3. **Integration with existing tools** — the `visualizers/` directory has a
   GSFEN visualizer HTML file. The GAN visualizer (Step 14 in ORACLE.md)
   targets a full interactive HTML tool. The thin CLI version in Phase 4 may
   replace the need for the interactive version, or may feed into it.
