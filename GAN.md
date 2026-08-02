# GAN --- Gungi Action Notation

GAN is the canonical text serialization of a single
[Action](RULES.md#action) --- a
[Placement](RULES.md#placement), [Done](RULES.md#done)
declaration, [Move](RULES.md#move), or
[Arata](RULES.md#arata) --- taken against a known
[Game State](RULES.md#game-state). It is the sibling notation to
[GSFEN](GSFEN.md): GSFEN describes *what a state is*, GAN describes *what a
Player did to reach the next one*. This document is the normative
specification; rule references (BR-xxx) point to `RULES.md`.

A GAN string is only meaningful relative to the
[Game State](RULES.md#game-state) it is applied to --- unlike GSFEN,
it is not self-contained. Applying a GAN Action to a GSFEN string
deterministically produces the next GSFEN string (or determines the Action was
illegal, per BR-ACTION-003).

## Design goals

- **Shogi/USI-shaped.** Board moves are an origin/destination pair; drops
  from [Hand](RULES.md#hand) use a `piece*square` form, directly
  echoing USI's `7g7f` / `P*3d` style.
- **Decision-canonical.** GSFEN's canonicity means "one state, one spelling."
  GAN's canonicity means something adjacent: *one legal decision, one
  spelling* --- every distinct choice a Player could legally make has exactly
  one valid string, and no string is ambiguous between two different
  decisions.
- **Omit the forced.** A token appears **only** when the rules leave the
  Player a genuine choice. Anything derivable from the preceding Game State
  plus the rest of the Action is left out. This keeps the overwhelmingly
  common case (a plain Move or Placement) as terse as USI, while still
  making room for Gungi's three elective mechanics: choosing
  [Stack](RULES.md#stacking-verb) vs.
  [Capture](RULES.md#capture)
  ([BR-STACK-002](RULES.md#br-stack-002---stacking-on-enemy-squares)),
  [Captain Turncoat](RULES.md#br-stack-006---captain-turncoat) swaps,
  and declaring [Done](RULES.md#done) instead of placing during the
  [Deploy Phase](RULES.md#deploy-phase).
- **Grammar-distinguishable.** Placement, Done, Move, and Arata strings are
  distinguishable from their first character alone, with no lookahead needed
  --- matching GSFEN's field self-description.
- **No commentary.** GAN encodes the Action only. It deliberately has no
  check/checkmate annotation (no chess-style `+`/`#`), no move-number
  field, and no resignation/draw-offer token --- those belong to a
  transcript format built *on top of* GAN, not to GAN itself.

## Square notation

GAN reuses the [Square](RULES.md#square) notation from the
Business Rules glossary directly: `{column}-{row}`, each 1-9, per the
[Standard Diagram](RULES.md#standard-diagram). E.g. `5-9` is
Column 5, Row 9. This is **not** the same indexing GSFEN's Position field
uses internally (row-major, columns 9->1) --- GAN squares are the glossary's
native coordinate pairs, chosen because Actions are naturally read/written
per-square rather than as a serialized board.

## Piece letters

GAN uses the same 14 piece letters as
[GSFEN Field 1](GSFEN.md#field-1--position)
(`A C E F G J L M N P S T U Y`), **always uppercase**. Unlike GSFEN,
letter case does **not** encode ownership: the acting Player is always the
[Active Player](RULES.md#active-player) (for a Move/Arata) or
determined by placement order per
[BR-DEPLOY-002](RULES.md#br-deploy-002---placement-order) (for a
Placement) --- per
[BR-ACTION-004](RULES.md#br-action-004---player-identification-in-actions),
ownership is never carried in the Action itself, so encoding it in the
letter case would be redundant (and, for Placement, exactly the field
GSFEN already tracks via the Turn field).

## The four Action shapes

### 1. Placement (Deploy Phase only)

```
<piece><square>
```

Places `piece` from Hand onto `square`
([BR-DEPLOY-005](RULES.md#br-deploy-005---deploy-stacking) /
[BR-DEPLOY-006](RULES.md#br-deploy-006---deploy-on-empty-squares)).
A Placement is always a bare placement --- it never declares Done. Declaring
[Done](RULES.md#done) is a separate, standalone Action
([BR-DEPLOY-007](RULES.md#br-deploy-007---done-declaration)), and a
Player cannot both place a Piece and declare Done in the same Action.

Examples: `M5-9` (place Marshal at 5-9), `P3-8` (place a Pawn at 3-8).

### 2. Done (Deploy Phase only)

```
!
```

A lone `!` declares the Player **Done**: their deploying ends immediately, no
Piece is placed, and no further Placements are allowed that phase. Done is a
standalone Action --- the rules never allow a Done suffix on a Placement, and
a Player cannot place a Piece and declare Done in the same Action. Done is
illegal until the Player's Marshal has been deployed (the first Placement
must be the Marshal,
[BR-DEPLOY-003](RULES.md#br-deploy-003---marshal-first)).

Example: `!` (declare Done; the acting Player deploys no further Pieces).

### 3. Move (Battle Phase only)

```
<square>>[<square>][outcome][turncoat]
```

more precisely:

```
<origin>><dest>[outcome][turncoat]
```

`origin` and `dest` are both `square` tokens. The piece letter is omitted
entirely --- the top Piece of `origin`'s Stack is fully determined by the
preceding Game State
([BR-MOVE-001](RULES.md#br-move-001---moving-the-top-piece)), so
naming it would be redundant.

The `>` separator (not `-`) is deliberate: Squares already use `-`
internally, so concatenating two Squares with `-` would force three
dashes in a row with no way to tell where the origin ends
(`5-8-5-7` --- is that `(5,8)->(5,7)` or something else?). `>` removes the
ambiguity and reads naturally as "moves to."

**`outcome`** --- `=` (Stack) or `x` (Capture) --- appears **iff** `dest` is
occupied by an enemy Stack **and** both outcomes are legal, i.e. target
[Stack Size](RULES.md#stack-size) < 3 **and** its top Piece is not
a [Marshal](RULES.md#marshal)
([BR-STACK-002](RULES.md#br-stack-002---stacking-on-enemy-squares)).
If Capture is forced (target Stack Size = 3, per
[BR-CAPTURE-002](RULES.md#br-capture-002---capture-is-forced-at-max-stack-size),
or the target top is a Marshal, which forbids Stacking outright) the token
is omitted --- there is only one legal outcome, so nothing to disambiguate.
Likewise, landing on an empty Square or a friendly Stack never takes an
`outcome` token (empty: trivial; friendly: automatic Stacking per
[BR-STACK-003](RULES.md#br-stack-003---stacking-on-friendly-squares)).

**`turncoat`** --- see [Turncoat token](#turncoat-token) below.

Examples: `2-7>2-6` (plain move, dest empty), `3-3>3-2` (forced capture,
no token needed), `5-6>5-5=` (chosen Stack over an available Capture),
`5-6>5-5x` (chosen Capture over an available Stack).

### 4. Arata (Battle Phase only)

```
<piece>*<dest>[turncoat]
```

Drops `piece` from Hand onto `dest`, mirroring USI's drop notation exactly
(`P*3d` -> `P*5-6`). There is no `outcome` token: an Arata can never land
on an enemy-controlled Square
([BR-ARATA-006](RULES.md#br-arata-006---arata-cannot-stack-on-enemy-pieces)),
so Capture is never a possibility here --- the only two outcomes are "empty
Square" and "automatic friendly Stacking," neither of which is a choice.

`piece` is never `M` (Marshal) --- a Marshal is never in Hand during the
Battle Phase (BR-DEPLOY-011) --- and this is a semantic-validity check, not
something the grammar itself needs to special-case.

Example: `T*5-6` (drop Captain at 5-6).

### Turncoat token

```
turncoat = "+" levels
levels   = "1" / "2" / "12"
```

Present **iff** all of the following hold: the acted Piece is a
[Captain](RULES.md#captain); the Action's outcome is a
[Stacking](RULES.md#stacking-verb) (never a Capture); and at
least one Square-Level directly below the Captain's new position (Level 1
and/or Level 2) is occupied by an **opposing** Piece
([BR-STACK-006](RULES.md#br-stack-006---captain-turncoat)). Each
digit names a Level the Player elects to swap; the matching enemy Piece is
removed and replaced by a same-type friendly Piece from Hand. Levels are
listed ascending, each at most once (`12`, never `21`).

**Omission is the canonical way to decline.** Turncoat swaps are always
optional (BR-STACK-006: "Each swap is optional"), so leaving the token off
entirely is itself a fully legal, fully specified decision --- "swap
nothing." A level is only eligible to appear if (a) it is occupied by an
opposing Piece immediately before the swap and (b) the Player's Hand holds
a matching replacement at the time of that swap; if two swapped levels
happen to require the same Piece Type, the Hand must hold two copies.

Note the reuse of `+` here deliberately echoes USI's `+` promotion marker
--- it marks the one other point in Gungi where a Piece's board identity can
change as part of an Action.

Examples: `5-6>5-5=+2` (Stack chosen, then swap the Level-2 enemy Piece
underneath), `T*5-6+1` (Arata drop that stacks the Captain onto a
friendly-controlled Square with an enemy Piece at Level 1, and the swap is
taken).

## Grammar (ABNF, RFC 5234)

```abnf
action      = placement / done / move / arata

; --- Placement (Deploy Phase) ---
placement   = piece square

; --- Done (Deploy Phase) ---
done        = "!"

; --- Move (Battle Phase) ---
move        = square ">" square [outcome] [turncoat]
outcome     = "=" / "x"

; --- Arata (Battle Phase) ---
arata       = piece "*" square [turncoat]

; --- Shared ---
turncoat    = "+" levels
levels      = "1" / "2" / "12"
square      = col "-" row
col         = %x31-39                 ; "1".."9"
row         = %x31-39                 ; "1".."9"
piece       = "A" / "C" / "E" / "F" / "G" / "J" / "L" / "M"
            / "N" / "P" / "S" / "T" / "U" / "Y"

; --- Move list (Actions applied in order from a starting Game State) ---
actionlist  = action *(SP action)
```

Because `placement` starts `piece square`, `done` is a lone `!`, `move`
starts `square ">"`, and `arata` starts `piece "*"`, the four shapes are
distinguishable from their first character --- no external tagging is needed,
and the applicable Game Phase (Deploy vs. Battle) further disambiguates which
grammar is even legal to attempt.

## Canonicalization

A conforming string MUST pass two layers of rules applied in order:
first **Grammar** (the string must match the ABNF productions), then
**Canonical Form** (optional tokens must be present only when the rules
leave the Player a genuine choice).

### Grammar rules (BR-GAN-GRAMMAR-xxx)

These reject strings whose shape does not match the ABNF grammar.
Violations are detectable from the string alone, with no Game State needed.

- **BR-GAN-GRAMMAR-001 --- Empty input.** The string is empty or blank.
- **BR-GAN-GRAMMAR-002 --- Invalid starting character.** Must be a digit
  (Move), an uppercase piece letter (Placement/Arata), or `!` (Done).
- **BR-GAN-GRAMMAR-003 --- Invalid piece letter.** Must be one of the 14
  valid piece types (`A C E F G J L M N P S T U Y`), always uppercase.
- **BR-GAN-GRAMMAR-004 --- Malformed square notation.** Must match
  `{digit 1-9}-{digit 1-9}`; e.g. `0-0`, `5-`, `abc` all fail.
- **BR-GAN-GRAMMAR-005 --- Missing separator.** Move requires `>`
  between squares; Arata requires `*` between piece and square.
- **BR-GAN-GRAMMAR-006 --- Multiple separators.** Exactly one `>` (Move)
  or one `*` (Arata) is allowed.
- **BR-GAN-GRAMMAR-007 --- String too short.** The action type's minimum
  length is not met (Placement < 4 chars, Done not exactly one `!`, Arata < 5
  chars, Move missing destination).
- **BR-GAN-GRAMMAR-008 --- Trailing or invalid characters.** After fully
  parsing the grammar, unconsumed characters remain.
- **BR-GAN-GRAMMAR-009 --- Whitespace inside a single Action.** No space
  (U+0020) or other whitespace is allowed within a single action token.
- **BR-GAN-GRAMMAR-010 --- Invalid turncoat format.** Turncoat must start
  with `+` and list only `1`, `2`, or `12`.
- **BR-GAN-GRAMMAR-011 --- Done token error.** `!` is a standalone Action
  token: it must appear alone. Any `!` attached to a Placement, Move, or
  Arata (multiple `!`s, `!` before the square, `!` after a Move), or in any
  other position, is invalid.

### Canonical-form rules (BR-GAN-CANON-xxx)

These apply after the string passes the grammar. They require knowledge
of the preceding Game State to evaluate.

- **BR-GAN-CANON-001 --- No optional token without optionality.**
  `outcome` appears only when
  [BR-STACK-002](RULES.md#br-stack-002---stacking-on-enemy-squares)'s
  conditions make both Stack and Capture legal; otherwise it is omitted
  even though the Action still results in a capture or a stack.
- **BR-GAN-CANON-002 --- Turncoat lists only real, elected swaps.** No
  level appears unless it is eligible (opposing Piece present, Hand has a
  match) *and* the Player is choosing to swap it. Absence of the token
  means "decline all eligible swaps," which is always legal and always has
  exactly this one spelling.

### Decision canonicity

Because canonicity here describes *decisions*, not *states*, "one spelling
per action" should be read as: for a fixed preceding Game State, every
distinct legal (piece, destination, outcome-if-any, swap-set) combination
has exactly one GAN string, and every GAN string that passes Semantic
Validity below corresponds to exactly one such combination.

## Semantic Validity

A well-formed, canonical GAN string denotes a **legal** Action against a
given Game State only if all applicable checks below hold. Unlike GSFEN's
checklist, these are evaluated *relative to* a preceding Game State, not
against the string alone.

- **BR-GAN-VALID-001 --- Phase match.** `placement` and `done` are only
  valid against a Deploy Phase Game State; `move` and `arata` only against a
  Battle Phase one
  ([BR-PLAY](RULES.md#br-play---play-rules)).
- **BR-GAN-VALID-002 --- Placement legality.** `piece` is in the placing
  Player's Hand; if it is that Player's Marshal, this must be their first
  Placement
  ([BR-DEPLOY-003](RULES.md#br-deploy-003---marshal-first));
  `square` is within that Player's deploy zone
  ([BR-DEPLOY-004](RULES.md#br-deploy-004---deploy-zone)) and is
  either empty or a friendly non-Marshal-topped Stack under size 3.
- **BR-GAN-VALID-003 --- Move legality.** `origin` holds a Stack whose top
  Piece belongs to the Active Player
  ([BR-MOVE-002](RULES.md#br-move-002---origin-must-contain-own-piece));
  `dest` is reachable by that Piece's
  [Movement](RULES.md#movement) rules, scaled for
  [Stack Size](RULES.md#stack-size)
  ([BR-MOVEMENT](RULES.md#br-movement---piece-movement-rules));
  the landing satisfies
  [BR-MOVE-005](RULES.md#br-move-005---stack-size-landing-restriction);
  `outcome` is present exactly when BR-GAN-CANON-001 requires it; the
  resulting position does not leave the mover's own Marshal in Check
  ([BR-ACTION-002](RULES.md#br-action-002---self-check)).
- **BR-GAN-VALID-004 --- Arata legality.** `piece` is in the Active
  Player's Hand and is never `M`; `dest` lies within that Player's Arata
  placement zone
  ([BR-ARATA-003](RULES.md#br-arata-003---arata-placement-zone))
  and is empty or friendly-topped under size 3
  ([BR-ARATA-004](RULES.md#br-arata-004---arata-on-empty-squares) /
  [BR-ARATA-005](RULES.md#br-arata-005---arata-stacking-on-friendly-pieces));
  Self Check applies as in BR-GAN-VALID-003.
- **BR-GAN-VALID-005 --- Turncoat legality.** Present only if the
  acting/placed Piece is a Captain and the Action's outcome is a Stacking;
  each listed level held an opposing Piece immediately beforehand; the Hand
  held a matching replacement Piece Type at the moment of that swap
  ([BR-STACK-006](RULES.md#br-stack-006---captain-turncoat)).
- **BR-GAN-VALID-006 --- Done legality.** A standalone `!` is legal only
  against a Deploy Phase Game State, and only when the declaring Player has
  already deployed their Marshal
  ([BR-DEPLOY-003](RULES.md#br-deploy-003---marshal-first));
  declaring it ends that Player's deploying
  ([BR-DEPLOY-007](RULES.md#br-deploy-007---done-declaration)).

If any check fails, the Action is Illegal and the Game State is unchanged
([BR-ACTION-003](RULES.md#br-action-003---consequence-of-an-illegal-action)).

## Applying a GAN Action to a GSFEN state

Conceptually (not a full algorithm):

1. **Placement** removes `piece` from the acting Player's Hands section of
   GSFEN, appends it to the top of `square`'s stack group in the Position
   field (or writes it alone), and advances Turn/Counter per
   [BR-DEPLOY-002](RULES.md#br-deploy-002---placement-order)/
   [BR-DEPLOY-008](RULES.md#br-deploy-008---opponent-continues-after-done).
2. **Done** sets the Done flag on the Turn field (e.g. `dw` -> `dwB`) and
   passes the Turn to the Opponent; it changes no Position field and no
   Hands.
3. **Move** detaches the top letter from `origin`'s stack group, resolves
   `outcome` (drop enemy letters on Capture; otherwise append the moving
   letter as the new top), applies any Turncoat swaps (removing the
   enemy letter at each named Level, moving the matching Piece Type from
   Hand to that Level), and flips Turn.
4. **Arata** removes `piece` from Hand, appends it as the new top of
   `dest`'s stack group (or writes it alone), applies any Turncoat swaps,
   and flips Turn.

In all cases the Turn Counter resets/increments per GSFEN Field 4, and the
Deploy->Battle transition triggers the one-time
[Exposure](RULES.md#exposure) check
([BR-DEPLOY-012](RULES.md#br-deploy-012---exposure-evaluation))
rather than any GAN Action.

## Worked examples

### 1. Opening Placement

```
M5-9
```
White places their Marshal at 5-9 --- the mandatory first Placement
([BR-DEPLOY-003](RULES.md#br-deploy-003---marshal-first)). Applied
to `startpos`, this produces the GSFEN state shown in
[GSFEN example 2](GSFEN.md#2-whites-first-placement-made-marshal-at-5-9-black-to-place).

### 2. Standalone Done declaration

```
!
```
Black declares Done as a standalone Action (their Marshal and a General were
placed on earlier Actions) --- no further Black Placements occur until the
Deploy Phase ends for both Players.

### 3. Plain Move, no choice available

```
2-7>2-6
```
A Pawn (or whatever occupies 2-7) steps forward to an empty Square --- no
`outcome`, no `turncoat`.

### 4. Move with a forced Capture

```
3-3>3-2
```
`dest` holds an enemy Stack of size 3, so Capture is forced by
[BR-CAPTURE-002](RULES.md#br-capture-002---capture-is-forced-at-max-stack-size).
No `x` is written --- there is nothing to disambiguate.

### 5. Move with a genuine Stack/Capture choice, Turncoat declined

```
5-6>5-5=
```
A Captain at 5-6 moves onto 5-5, which holds an enemy-topped Stack of size
2 under size 3 --- both Stack and Capture are legal, so `=` is required.
The Captain becomes the new top; the enemy Piece now at Level 2 is
eligible for Turncoat, but no `+` token is present, so the swap is
declined. This produces exactly the mixed-ownership stack shown in
[GSFEN example 4](GSFEN.md#4-regular-play-with-a-mixed-ownership-stack-white-to-move-turn-12)
(`PyT`, bottom->top: White Pawn, Black Spy, White Captain).

### 6. Same Move, Turncoat taken

```
5-6>5-5=+2
```
Identical to example 5, except the Player also swaps the Level-2 enemy
Spy for a friendly Spy from Hand (consuming one Spy from White's Hand).
The resulting stack is `PYT` (White Pawn, White Spy, White Captain)
instead of `PyT`.

### 7. Arata with Turncoat

```
T*5-6+1
```
White drops a Captain from Hand onto 5-6, a friendly-controlled Square
whose Level-1 occupant is an enemy Piece; the Player elects to swap it now.

### Invalid strings (all rejected)

```
5-8-5-7            ; GRAMMAR-005: uses "-" instead of ">" between squares
3-3>3-2x           ; CANON-001: Stack size 3 forces Capture; redundant `x` token is non-canonical
5-6>5-5            ; CANON-001: choice existed (target size 2, top not Marshal) but `outcome` is missing
T*5-6+21           ; GRAMMAR-010: turncoat levels must be ascending ("12", not "21")
M5-9!!             ; GRAMMAR-011: `!` is a standalone Action token; a Placement cannot carry it
P3-8!              ; GRAMMAR-011: Done is a standalone `!` Action, never a Placement suffix
5-6>5-5!           ; GRAMMAR-011: `!` is a standalone Action token, not a Move suffix
G5-1               ; VALID-002: illegal if Black's Marshal has not yet been placed
```

## Design notes

- **Why not encode the piece letter on Moves?** USI omits it too, for the
  same reason: the origin Square already pins it down given the Game
  State, so writing it would be pure redundancy --- GSFEN takes the same
  stance on the Turn counter being excluded from Repetition comparisons.
- **Why `>` instead of Shogi's bare concatenation?** Shogi squares are
  two characters (`7g`) with no internal punctuation, so concatenation
  alone (`7g7f`) is unambiguous. Gungi Squares already contain `-`
  (`5-8`), so bare concatenation would be genuinely ambiguous; `>` is a
  cheap, readable fix that also happens to visually suggest "moves to."
- **Why `=`/`x` and not something else?** `x` for Capture mirrors
  algebraic chess notation, which most readers already associate with
  "a piece was removed." `=` reads as "no removal, just a new top" ---
  and is left unclaimed by every other token in the grammar.
- **Why `+` for Turncoat?** It deliberately echoes USI's `+` promotion
  marker: both denote "the Piece placed here undergoes an identity-level
  event as part of this Action." No other Gungi Action changes what a
  Piece *is* mid-play, so there's no risk of confusing the two games'
  uses of the symbol.
- **No check/mate annotation, on purpose.** Adding a chess-style `+`/`#`
  suffix would collide visually and syntactically with the Turncoat `+`
  (`5-8>5-7+1` could otherwise be misread as "check, then stray digit 1").
  Rather than pick a different symbol for a feature that's easy to derive
  by re-evaluating the resulting GSFEN state anyway, GAN leaves
  check/mate annotation out of scope entirely --- it belongs in a
  transcript/PGN-equivalent layer built on top of GAN, not in GAN itself.
- **Canonical-by-omission is a stance, not a law of nature.** An
  alternative design could always write `outcome` and `turncoat`
  explicitly (e.g. `=` always present when landing on any Stack,
  `+0`/`+none` for "no swap"). That would make every token's *presence*
  uniform at the cost of verbosity on the common case. GAN chose
  terseness to match GSFEN's own minimalism (e.g. a bare `!` for the standalone Done
  Action rather than a richer token),
  but this is a legitimate place to reconsider if a different priority
  (e.g. easier hand-parsing without a rules engine) turns out to matter
  more in practice.
