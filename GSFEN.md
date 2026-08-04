# GSFEN --- Gungi Stacking Forsyth-Edwards Notation

GSFEN is the canonical text serialization of a Gungi
[Game State](RULES.md#game-state), modeled on SFEN (Shogi
Forsyth-Edwards Notation). A single string covers both mid-
[Deploy Phase](RULES.md#deploy-phase) states and
[Battle Phase](RULES.md#battle-phase)
Game States. This document is the normative specification of the
notation; rule references (BR-xxx) point to `RULES.md`.

## Design goals

- **SFEN-shaped.** Four space-separated fields --- Position, Turn, Hands,
  counter --- so the format is immediately familiar and tooling concepts
  carry over.
- **Stack-native.** The Position field encodes
  [Stacks](RULES.md#stack) of 1–3
  [Pieces](RULES.md#piece) per
  [Square](RULES.md#square), preserving internal order
  ([Levels](RULES.md#level)) and mixed ownership.
- **Canonical.** Exactly one expanded spelling exists per state (the
  `startpos` keyword is an input-only shorthand). Parsers MUST reject
  non-canonical input (see [Canonicalization](#canonicalization)).
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

## Field 1 --- Position

The Position field transcribes the
[Standard Diagram](RULES.md#standard-diagram) exactly: 9
[Rows](RULES.md#row), separated by `/`, written Row 1 first
(topmost) through Row 9 (bottommost). Within each row, items are
separated by `,` and cover [Columns](RULES.md#column) 9 -> 1
(left to right in the diagram).

An item is one of:

- **Empty run** --- a single digit `1`–`9`: that many consecutive empty
  Squares.
- **Stack** --- 1 to 3 piece letters for one occupied Square, written
  **bottom ([Level](RULES.md#level) 1) first, top last**. A
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

## Field 2 --- Turn

A single token encoding the phase and who acts next:

| Token | Meaning |
|-------|---------|
| `w`   | Regular [Turn](RULES.md#turn); White is the [Active Player](RULES.md#active-player). |
| `b`   | Regular Turn; Black is the Active Player. |
| `dw`  | Deploy Phase; White places next. |
| `db`  | Deploy Phase; Black places next. |
| `dwB` | Deploy Phase; White places next; **Black has declared Done** (BR-DEPLOY-007). |
| `dbW` | Deploy Phase; Black places next; **White has declared Done**. |

Tokens with both players Done, or with the placing player Done, cannot
occur: the Deploy Phase ends at that boundary (BR-DEPLOY-009) and the
resulting state is a [Battle Phase](RULES.md#battle-phase)
Game State. A Done flag is set by a standalone Done Action (BR-DEPLOY-007)
that places no Piece. A player who has placed all 25
Pieces needs no flag --- that condition is derivable from an empty Hand.
The canonical form therefore omits the flag whenever the done player's
Hand is empty (the auto-Done condition after the last Placement): a state
with an empty done-player Hand MUST be written as `dw`/`db`, never
`dwB`/`dbW`. A `dwB`/`dbW` token implies a genuine Done declaration, i.e.
the flagged player still holds pieces in Hand. For compatibility, parsers
SHOULD still accept a redundant `dwB`/`dbW` token on an empty Hand (the
engine derives the Done condition from the Hand, so behavior is
identical either way).

## Field 3 --- Hands

The contents of both [Hands](RULES.md#hand): White's pieces
first (uppercase), then Black's (lowercase). Within each section,
letters appear in alphabetical order, each at most once, prefixed by a
count which is **omitted when 1**. `-` when both Hands are empty.

Example: `2PNe` --- White holds two Pawns and one Knight; Black holds one
Spear.

During the Deploy Phase, undeployed pieces (including a not-yet-deployed
Marshal) are listed in the Hands field.

## Field 4 --- Turn counter

A positive integer: the turn number **within the current phase**,
starting at 1. [Placements](RULES.md#placement) count 1, 2, 3, …
from White's first [Placement](RULES.md#placement); the counter
resets to 1 on White's first [Battle Phase](RULES.md#battle-phase)
turn. A standalone Done Action does not advance the counter --- it counts
[Placements](RULES.md#placement) only (BR-DEPLOY-007).

## startpos

The reserved keyword `startpos` (lowercase, exact) is an input-only
shorthand for the fixed game-start state --- empty board, full 25-piece
Hands, White's first [Placement](RULES.md#placement):

```
startpos
```

The serializer never emits the keyword; the expanded form is the
canonical spelling:

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

Rules are organised by the field they constrain. Each group has a
catch-all code for errors that fit the group but not a specific sub-code.

### Separator rules (BR-GSFEN-CANON-SEPARATOR)

- **BR-GSFEN-CANON-SEPARATOR-FIELD-COUNT** --- Fields are separated by
  exactly one space (U+0020). Exactly four fields.
- **BR-GSFEN-CANON-SEPARATOR-WHITESPACE** --- No other whitespace appears
  anywhere in the string. No leading or trailing whitespace.

### Position rules (BR-GSFEN-CANON-POSITION)

- **BR-GSFEN-CANON-POSITION-ROW-COUNT** --- Exactly 9 rows, separated by `/`.
- **BR-GSFEN-CANON-POSITION-SQUARE-COUNT** --- In every row, the sum of
  its digits (empty runs) plus the number of its stack items equals 9.
- **BR-GSFEN-CANON-POSITION-COMPRESSION** --- Two empty-run items are never
  adjacent within a row (they MUST be merged into a single digit).
- **BR-GSFEN-CANON-POSITION-STACK-SPELLING** --- Stack letters are in
  bottom->top (Level ascending) order. A lone Piece is a single bare
  letter --- no padding or markers.  Each stack contains 1–3 pieces
  (a parser MAY reject stacks with >3 pieces at parse time as a
  defence-in-depth measure).  Every character in a stack group is a
  recognised piece letter.
- **BR-GSFEN-CANON-POSITION-EMPTY-ITEM** --- An item in a row is never
  empty (no bare commas or empty segments).

### Turn rules (BR-GSFEN-CANON-TURN)

- **BR-GSFEN-CANON-TURN-TOKEN** --- The Turn token is exactly one of `w`,
  `b`, `dw`, `db`, `dwB`, `dbW`.

### Hand rules (BR-GSFEN-CANON-HANDS)

- **BR-GSFEN-CANON-HANDS-EMPTY-MARKER** --- `-` when both Hands are empty.
  An empty string is not accepted.
- **BR-GSFEN-CANON-HANDS-SECTION-ORDER** --- White's section (uppercase
  letters) precedes Black's (lowercase).
- **BR-GSFEN-CANON-HANDS-ALPHABETICAL** --- Letters appear in alphabetical
  order within each section.
- **BR-GSFEN-CANON-HANDS-DUPLICATE** --- Each letter appears at most once
  per section.
- **BR-GSFEN-CANON-HANDS-COUNT-FORMAT** --- Counts are digits 2–4, omitted
  when 1. A count at end of string without a following piece letter is
  invalid.
- **BR-GSFEN-CANON-HANDS-UNEXPECTED-CHAR** --- No characters other than
  uppercase piece letters, lowercase piece letters, and count digits.

### Counter rules (BR-GSFEN-CANON-COUNTER)

- **BR-GSFEN-CANON-COUNTER-LEADING-ZERO** --- No leading zeros.
- **BR-GSFEN-CANON-COUNTER-POSITIVE** --- Must be a positive integer (≥ 1).

### Keyword rules (BR-GSFEN-CANON-KEYWORD)

- **BR-GSFEN-CANON-KEYWORD-CASE** --- `startpos` is lowercase and exact.

## Semantic Validity

A well-formed, canonical string denotes a **valid** state only if all of
the following hold. This checklist is normative; it concerns the
legality of the *arrangement*, not game progression (a string may
denote a terminal Game State --- e.g. [Checkmate](RULES.md#checkmate)
--- and still be valid).

All rules in this section assume the string has already satisfied the
grammar and canonical-form rules above. The parser enforces canonical
form; the semantic validator enforces only what the parser cannot
guarantee.

- **BR-GSFEN-VALID-001 --- Marshal integrity** (BR-STACK-004, BR-DEPLOY-003, BR-DEPLOY-011)
  - **BR-GSFEN-VALID-001-TOP** --- A Marshal on the board is always the
    last (top) letter of its stack group (BR-STACK-004).
  - **BR-GSFEN-VALID-001-COUNT** --- In [Battle Phase](RULES.md#battle-phase)
    states (`w`/`b`), each player's Marshal appears exactly once on the
    board (BR-DEPLOY-003).
  - **BR-GSFEN-VALID-001-HAND** --- In Battle Phase, no player's Marshal
    ever appears in the Hand (BR-DEPLOY-011).
  - **BR-GSFEN-VALID-001-BOTH** --- In [Deploy Phase](RULES.md#deploy-phase),
    a player's Marshal is not simultaneously on the board and in the Hand
    (BR-DEPLOY-003).
  - **BR-GSFEN-VALID-001-FIRST** --- In Deploy Phase, if a player's
    Marshal is in the Hand, that player has no pieces on the board at all
    (Marshal must be deployed first, BR-DEPLOY-003).

- **BR-GSFEN-VALID-002 --- Inventory conservation** (BR-CAPTURE-004)
  For each player and each Piece Type:
  - (occurrences on the board) + (occurrences in the Hand) ≤ that type's
    initial count.
  - In Deploy Phase, (occurrences on the board) + (occurrences in the
    Hand) = that type's initial count --- pieces only move from Hand to
    board during deploy; no captures have occurred yet.
  - Captured pieces make the sum strictly smaller than the initial count;
    pieces never enter or leave the game otherwise.

- **BR-GSFEN-VALID-003 --- Done flags** (BR-DEPLOY-007)
  - At most one player has a Done flag, and the placing player never
    carries it.
  - A Done player has at least their Marshal on the board (Done is a
    standalone Action that cannot be declared before the Marshal is
    deployed, BR-DEPLOY-003).

- **BR-GSFEN-VALID-004 --- Deploy-phase constraints** (BR-DEPLOY-004, BR-DEPLOY-005)
  In deploy states (`dw`/`db`/`dwB`/`dbW`):
  - White's pieces appear only on Rows 7–9 and Black's only on Rows 1–3
    (BR-DEPLOY-004).
  - Every stack is single-owner (BR-DEPLOY-005).

- **BR-GSFEN-VALID-005 --- Counter bounds** (BR-DEPLOY-002)
  - In Deploy Phase, the counter must not exceed 50 (at most 25
    placements per player, BR-DEPLOY-002). In Battle Phase there is no
    upper bound.

### Repetition and string equality

[Repetition](RULES.md#repetition) (BR-REPETITION-001) compares
Game States --- Active Player, Position, and Hands. Because GSFEN is
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

Row 9 reads (Column 9 -> 1): four empty Squares, White Marshal at
Column 5, four empty Squares. White's Hand lists the remaining 24
pieces (no `M`).

### 3. Mid-deploy; Black has declared Done; White to place

```
4,g,4/4,m,4/9/9/9/9/9/4,G,4/4,M,4 dwB 2AC3E2F2JL2N4P2STU2Y2ac3e2f2jl2n4p2stu2y 5
```

Black's Marshal at 5-2 and General at 5-1; White's General at 5-8 and
Marshal at 5-9. Four [Placements](RULES.md#placement) have been
made, so White's Placement is Placement 5.

### 4. Regular play with a mixed-ownership stack; White to move, turn 12

```
4,m,4/9/9/9/4,PyT,4/9/9/9/4,M,4 w 2AC3E2FG2JL2N3P2SU2Y2ac3e2fg2jl2n4p2stuy 12
```

The stack at 5-5 reads bottom->top: White Pawn, Black Spy (left behind
by a [Capture](RULES.md#capture) sequence, BR-CAPTURE-004),
White Captain on top.

### Invalid spellings (all rejected by a conforming parser)

```
9/9/9/9/9/9/9/9/4,1,M,3 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2   ; BR-GSFEN-CANON-POSITION-COMPRESSION: empty runs not merged (4,1 -> 5)
9/9/9/9/9/9/9/9/M,8 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 02     ; BR-GSFEN-CANON-COUNTER-LEADING-ZERO: leading zero
9/9/9/9/9/9/9/9/4,m,4 db 2AC3E2FG2JL2N4P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2    ; case is ownership: reads as Black's Marshal on Row 9 -> BR-GSFEN-VALID-004 (deploy zone) and White's Marshal missing -> BR-GSFEN-VALID-001-COUNT
9/9/9/9/9/9/9/9/4,MP,4 dw 2AC3E2FG2JL2N3P2STU2Y2ac3e2fg2jlm2n4p2stu2y 2   ; BR-GSFEN-VALID-001-TOP: Marshal not at top of its stack
```

## Design notes

- **Stack syntax lineage.** Comma-separated squares with bottom->top
  letter groups follow TPS (Tak Positional Notation), the established
  stacking-game precedent; digit runs for empty Squares keep the SFEN
  feel for sparse boards.
- **Six-token Turn field.** Mid-deploy state needs exactly three bits
  of information --- phase, who places next, and at most one Done flag ---
  and both-done / self-done combinations are unreachable by rule
  (BR-DEPLOY-009), so a single six-token slot suffices with no extra
  fields.
- **Canonical-only.** Chosen so that Repetition detection reduces to
  field-string equality and every state has a single authoritative
  spelling for tests, fixtures, and fuzzing.
- **Name.** Gungi Stacking Forsyth-Edwards Notation: the FEN/SFEN
  lineage, named for the one mechanic that forced a departure from it.
