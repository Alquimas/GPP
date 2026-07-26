# GSFEN — Gungi Stacking Forsyth-Edwards Notation

GSFEN is the canonical text serialization of a Gungi
[Game State](BUSINESS_RULES.md#game-state), modeled on SFEN (Shogi
Forsyth-Edwards Notation). A single string covers both mid-
[Deploy Phase](BUSINESS_RULES.md#deploy-phase) states and
[Battle Phase](BUSINESS_RULES.md#battle-phase)
Game States. This document is the normative specification of the
notation; rule references (BR-xxx) point to `BUSINESS_RULES.md`.

## Design goals

- **SFEN-shaped.** Four space-separated fields — Position, Turn, Hands,
  counter — so the format is immediately familiar and tooling concepts
  carry over.
- **Stack-native.** The Position field encodes
  [Stacks](BUSINESS_RULES.md#stack) of 1–3
  [Pieces](BUSINESS_RULES.md#piece) per
  [Square](BUSINESS_RULES.md#square), preserving internal order
  ([Levels](BUSINESS_RULES.md#level)) and mixed ownership.
- **Canonical.** Exactly one valid spelling exists per state. Parsers
  MUST reject non-canonical input (see [Canonicalization](#canonicalization)).
- **Complete.** The grammar plus the
  [Semantic Validity](#semantic-validity) checklist fully determine
  whether a string denotes a state the rules allow.

## Format overview

```
<position> <turn> <hands> <counter>
```

Four fields separated by exactly one space (U+0020) each. No leading or
trailing whitespace. Alternatively, the reserved keyword `startpos`
(see [startpos](#startpos)).

## Field 1 — Position

The Position field transcribes the
[Standard Diagram](BUSINESS_RULES.md#standard-diagram) exactly: 9
[Rows](BUSINESS_RULES.md#row), separated by `/`, written Row 1 first
(topmost) through Row 9 (bottommost). Within each row, items are
separated by `,` and cover [Columns](BUSINESS_RULES.md#column) 9 → 1
(left to right in the diagram).

An item is one of:

- **Empty run** — a single digit `1`–`9`: that many consecutive empty
  Squares.
- **Stack** — 1 to 3 piece letters for one occupied Square, written
  **bottom ([Level](BUSINESS_RULES.md#level) 1) first, top last**. A
  lone Piece is a single letter.

Ownership is encoded by case: **uppercase = White, lowercase = Black**.

### Piece letters

| Letter | Piece Type | Initial count per player |
|--------|------------|--------------------------|
| `A` | Archer    | 2 |
| `C` | Cannon    | 1 |
| `E` | Spear     | 3 |
| `F` | Fortress  | 2 |
| `G` | General   | 1 |
| `J` | Major     | 2 |
| `L` | Lieutenant | 1 |
| `M` | Marshal   | 1 |
| `N` | Knight    | 2 |
| `P` | Pawn      | 4 |
| `S` | Samurai   | 2 |
| `T` | Captain   | 1 |
| `U` | Musketeer | 1 |
| `Y` | Spy       | 2 |

The alphabetical order of this table (`A C E F G J L M N P S T U Y`)
is also the canonical letter order used in the Hands field.

## Field 2 — Turn

A single token encoding the phase and who acts next:

| Token | Meaning |
|-------|---------|
| `w`   | Regular [Turn](BUSINESS_RULES.md#turn); White is the [Active Player](BUSINESS_RULES.md#active-player). |
| `b`   | Regular Turn; Black is the Active Player. |
| `dw`  | Deploy Phase; White places next. |
| `db`  | Deploy Phase; Black places next. |
| `dwB` | Deploy Phase; White places next; **Black has declared Done** (BR-DEPLOY-007). |
| `dbW` | Deploy Phase; Black places next; **White has declared Done**. |

Tokens with both players Done, or with the placing player Done, cannot
occur: the Deploy Phase ends at that boundary (BR-DEPLOY-009) and the
resulting state is a [Battle Phase](BUSINESS_RULES.md#battle-phase)
Game State. A player who has placed all 25
Pieces needs no flag — that condition is derivable from an empty Hand.

## Field 3 — Hands

The contents of both [Hands](BUSINESS_RULES.md#hand): White's pieces
first (uppercase), then Black's (lowercase). Within each section,
letters appear in alphabetical order, each at most once, prefixed by a
count which is **omitted when 1**. `-` when both Hands are empty.

Example: `2PNe` — White holds two Pawns and one Knight; Black holds one
Spear.

During the Deploy Phase, undeployed pieces (including a not-yet-deployed
Marshal) are listed in the Hands field.

## Field 4 — Turn counter

A positive integer: the turn number **within the current phase**,
starting at 1. [Placements](BUSINESS_RULES.md#placement) count 1, 2, 3, …
from White's first [Placement](BUSINESS_RULES.md#placement); the counter
resets to 1 on White's first [Battle Phase](BUSINESS_RULES.md#battle-phase)
turn.

## startpos

The reserved keyword `startpos` (lowercase, exact) is an alias for the
fixed game-start state — empty board, full 25-piece Hands, White's first
[Placement](BUSINESS_RULES.md#placement):

```
startpos
```

is equivalent to:

```
9/9/9/9/9/9/9/9/9 dw 2AC3E2FG2JLM2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1
```

## Grammar (ABNF, RFC 5234)

```abnf
gsfen       = startpos-keyword / state
startpos-keyword = %s"startpos"

state       = position SP turn SP hands SP counter

; --- Field 1: Position ---
position    = row 8("/" row)            ; exactly 9 rows
row         = item *("," item)
item        = empty-run / stack
empty-run   = %x31-39                   ; "1".."9"
stack       = 1*3 piece                 ; bottom (Level 1) first, top last
piece       = white-piece / black-piece
white-piece = "A" / "C" / "E" / "F" / "G" / "J" / "L" / "M"
            / "N" / "P" / "S" / "T" / "U" / "Y"
black-piece = "a" / "c" / "e" / "f" / "g" / "j" / "l" / "m"
            / "n" / "p" / "s" / "t" / "u" / "y"

; --- Field 2: Turn ---
turn        = "w" / "b" / "dw" / "db" / "dwB" / "dbW"

; --- Field 3: Hands ---
hands       = "-" / [white-hand] [black-hand]
white-hand  = 1*( [count] white-piece )
black-hand  = 1*( [count] black-piece )
count       = %x32-34                   ; "2".."4" (1 is always omitted)

; --- Field 4: Turn counter ---
counter     = %x31-39 *DIGIT            ; >= 1, no leading zeros
```

## Canonicalization

A conforming string MUST satisfy all of the following. Parsers MUST
reject strings that violate any rule.

- **C1 — Separators.** Fields are separated by exactly one space
  (U+0020). No other whitespace appears anywhere in the string.
- **C2 — Nine squares per row.** In every row, the sum of its digits
  plus the number of its stack items equals 9.
- **C3 — Maximal compression.** Two empty-run items are never adjacent
  within a row (they MUST be merged into a single digit).
- **C4 — Stack spelling.** Stack letters are in bottom→top (Level
  ascending) order. A lone Piece is a single bare letter — no padding
  or markers.
- **C5 — Hands spelling.** White's section precedes Black's. Letters
  are alphabetical within each section, each appearing at most once.
  Counts are omitted when 1 and are never written with leading zeros.
  `-` appears if and only if both Hands are empty.
- **C6 — Counter.** No leading zeros.
- **C7 — Keyword.** `startpos` is lowercase and exact.

## Semantic Validity

A well-formed, canonical string denotes a **valid** state only if all of
the following hold. This checklist is normative; it concerns the
legality of the *arrangement*, not game progression (a string may
denote a terminal Game State — e.g. [Checkmate](BUSINESS_RULES.md#checkmate)
— and still be valid).

- **V1 — Grammar and canonicalization.** The string satisfies the ABNF
  grammar and C1–C7.
- **V2 — Stack size.** Every stack contains 1–3 pieces (BR-STACK-001).
- **V3 — Marshal integrity.** A Marshal on the board is always the last
  (top) letter of its stack group (BR-STACK-004). In
[Battle Phase](BUSINESS_RULES.md#battle-phase) states
  (`w`/`b`), each player's Marshal appears exactly once on the board and
  never in a Hand (BR-DEPLOY-003, BR-DEPLOY-011). In deploy states, each
  player's Marshal either appears once on the board as a group-top
  letter, or appears in that player's Hand section — in which case that
  player has no pieces on the board at all (Marshal must be deployed
  first, BR-DEPLOY-003).
- **V4 — Inventory conservation.** For each player and each Piece Type,
  (occurrences on the board) + (occurrences in the Hand) ≤ that type's
  initial count (captured pieces make the sum strictly smaller; pieces
  never enter or leave the game otherwise, BR-CAPTURE-004).
- **V5 — Done flags.** At most one player has a Done flag, and the
  placing player never carries it. A Done player has at least their
  Marshal on the board (Done is declared after a placement,
  BR-DEPLOY-007).
- **V6 — Deploy-phase constraints.** In deploy states (`dw`/`db`/
  `dwB`/`dbW`): White's pieces appear only on Rows 7–9 and Black's only
  on Rows 1–3 (BR-DEPLOY-004), and every stack is single-owner
  (BR-DEPLOY-005).
- **V7 — Counter bounds.** The counter is ≥ 1, and ≤ 50 in deploy
  states (at most 25 placements per player, BR-DEPLOY-002).
- **V8 — Empty hands marker.** `-` appears if and only if both Hands
  are empty.

### Repetition and string equality

[Repetition](BUSINESS_RULES.md#repetition) (BR-REPETITION-001) compares
Game States — Active Player, Position, and Hands. Because GSFEN is
canonical, two Game States are equal **if and only if their `position`,
`turn`, and `hands` fields are identical strings**. The counter field is
metadata, not Game State, and is excluded from the comparison.

## Worked examples

### 1. Game start

```
startpos
```
≡
```
9/9/9/9/9/9/9/9/9 dw 2AC3E2FG2JLM2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 1
```

### 2. White's first Placement made (Marshal at 5-9); Black to place

```
9/9/9/9/9/9/9/9/4,M,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2
```

Row 9 reads (Column 9 → 1): four empty Squares, White Marshal at
Column 5, four empty Squares. White's Hand lists the remaining 24
pieces (no `M`).

### 3. Mid-deploy; Black has declared Done; White to place

```
4,g,4/4,m,4/9/9/9/9/9/4,G,4/4,M,4 dwB 2AC3E2F2JL2N4P2STU2Y2ac3e2f2jl2n4p2stu2y 5
```

Black's Marshal at 5-2 and General at 5-1; White's General at 5-8 and
Marshal at 5-9. Four [Placements](BUSINESS_RULES.md#placement) have been
made, so White's Placement is Placement 5.

### 4. Regular play with a mixed-ownership stack; White to move, turn 12

```
4,m,4/9/9/9/4,PyT,4/9/9/9/4,M,4 w 2AC3E2FG2JL2N3P2SU2Y2ac3e2fg2jl2n4p2stuy 12
```

The stack at 5-5 reads bottom→top: White Pawn, Black Spy (left behind
by a [Capture](BUSINESS_RULES.md#capture) sequence, BR-CAPTURE-004),
White Captain on top.

### Invalid spellings (all rejected by a conforming parser)

```
9/9/9/9/9/9/9/9/4,1,M,3 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2   ; C3: empty runs not merged (4,1 -> 5)
9/9/9/9/9/9/9/9/M,8 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 02     ; C6: leading zero
9/9/9/9/9/9/9/9/4,m,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2    ; case is ownership: reads as Black's Marshal on Row 9 -> V6 (and White's Marshal is then missing -> V3)
9/9/9/9/9/9/9/9/4,MP,4 dw 2AC3E2FG2JL2N3P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2   ; V3: Marshal not at top of its stack
```

## Design notes

- **Stack syntax lineage.** Comma-separated squares with bottom→top
  letter groups follow TPS (Tak Positional Notation), the established
  stacking-game precedent; digit runs for empty Squares keep the SFEN
  feel for sparse boards.
- **Six-token Turn field.** Mid-deploy state needs exactly three bits
  of information — phase, who places next, and at most one Done flag —
  and both-done / self-done combinations are unreachable by rule
  (BR-DEPLOY-009), so a single six-token slot suffices with no extra
  fields.
- **Canonical-only.** Chosen so that Repetition detection reduces to
  field-string equality and every state has a single authoritative
  spelling for tests, fixtures, and fuzzing.
- **Name.** Gungi Stacking Forsyth-Edwards Notation: the FEN/SFEN
  lineage, named for the one mechanic that forced a departure from it.
