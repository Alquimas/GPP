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

### T1 — GSFEN fixture catalog (Phase 0)

Replace all inline GSFEN strings across the codebase with named constants
from a central barrel, validated at module-init time.

**Structure:**

```
oracle/fixtures/
├── valid/              # Canonical, passes validateState (populated during curation)
│   ├── startpos.gsfen
│   ├── battle-start.gsfen
│   └── ...
├── invalid/            # Intentionally invalid (for negative tests)
│   ├── marshal-below-pawn.gsfen
│   └── ...
├── *.gsfen             # Current fixture files (moved from gsfen/; to be sorted)
```

**Barrel:** `oracle/src/gsfen/fixtures.ts` exports every fixture as a named
constant. On module load, every fixture in `valid/` is run through
`validateState()` and throws if any fails.

**Policy:** No inline GSFEN strings anywhere in `src/` or `tests/` — every
string lives in a `.gsfen` file. Enforced by CONTEXT.md and a CI check
(see T3).

**Deferred:** Unresolved at curation time — how to handle "valid but
transitional" states that test incomplete features. Decide when curation
reveals the actual shape.

### T2 — Rule browser (Phase 3)

A script that, given a BR-xxx code, returns:

- The rule text from BUSINESS_RULES.md
- Files that enforce it (source)
- Tests that exercise it
- ORACLE.md step reference
- Related rules

**Usage:**
```bash
oracle/script/browse-rule.sh BR-MOVE-005
```

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
  ├──▶ Phase 3: Rule browser (browse-rule.sh)
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
