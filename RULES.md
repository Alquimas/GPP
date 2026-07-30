# Rules

## Glossary of terms

---

#### Standard Diagram
A fixed visual reference for how the [Board](<#board>) is depicted in this
document:
- [White](<#player>) sits at the **bottom** edge of the diagram.
- [Black](<#player>) sits at the **top** edge of the diagram.
- [Row](<#row>) 1 is the **topmost** row; [Row](<#row>) 9 is the
**bottommost** row.
- [Column](<#column>) 1 is the **rightmost** column; [Column](<#column>) 9 is the
**leftmost** column.
- [Square](<#square>) 1-1 is therefore the **top-right corner** and
[Square](<#square>) 9-9 the **bottom-left corner**.
The diagram never rotates between [Turns](<#turn>). Coordinates are always read
from this fixed layout.

#### Board
A 9x9 grid consisting of 81 [Squares](<#square>), arranged in
9 [Columns](<#column>) and 9 [Rows](<#row>).

#### Column
A column of the [Board](<#board>). [Column](<#column>) 1 is the column closest to
[White's](<#player>) right hand in the [Standard Diagram](<#standard-diagram>).
Columns are numbered from 1 to 9, growing from right to left from
[White's](<#player>) perspective.

#### Row
A row of the [Board](<#board>). [Row](<#row>) 1 is the row farthest from
[White](<#player>). Rows are numbered from 1 to 9,
growing from the opponent's side toward [White's](<#player>) seat.

#### Square
A single cell of the [Board](<#board>), identified by a coordinate
`(column, row)` and represented as `{column}-{row}`. For example,
[Square](<#square>) `2-3` represents the square on *Column 2* and *Row 3*.
[Square](<#square>) `1-1` is the top-right corner and
[Square](<#square>) `9-9` is the bottom-left corner in the
[Standard Diagram](<#standard-diagram>).

#### Player
An entity that can interact with the [Game](<#game>). It can be either **White**
or **Black**.

#### Active Player
The [Player](<#player>) who must do a [Play](<#play>) this [Turn](<#turn>).

#### Opponent
The [Player](<#player>) other than the referenced [Player](<#player>).

#### Level
The position of a [Piece](<#piece>) within a [Stack](<#stack>).
[Level](<#level>) 1 is the **bottommost** layer, [Level](<#level>) 2 is the
**middle** layer, [Level](<#level>) 3 is the **topmost** layer.
[Level](<#level>) is a dynamic property determined by the [Stack's](<#stack>)
composition, not an intrinsic property of the [Piece Type](<#piece-type>).

For the top [Piece](<#piece>) of a [Stack](<#stack>) (the only one that can
move), its [Level](<#level>) is always equal to the
[Stack Size](<#stack-size>). Rules referencing [Level](<#level>) in the
context of movement or stacking are equivalent to comparing
[Stack Sizes](<#stack-size>) of the involved [Stacks](<#stack>).

#### Stack
One to three [Pieces](<#piece>) occupying the same [Square](<#square>). The
[Player](<#player>) who owns the [Piece](<#piece>) at the **top** (highest
[Level](<#level>)) controls the [Stack](<#stack>). [Stacks](<#stack>) are
limited to a maximum of 3 [Pieces](<#piece>).

#### Stack Size
The number of [Pieces](<#piece>) in a [Stack](<#stack>), from 1 to 3.
[Stack Size](<#stack-size>) is the source of all movement bonuses for the top
[Piece](<#piece>): at size 1 there is no bonus, at size 2 the bonus is +1,
at size 3 the bonus is +2. This bonus applies to all allowed
[Movement](<#movement>) patterns.

#### Deploy Phase
The opening phase where [Players](<#player>) alternately place their unplaced
[Pieces](<#piece>) on the [Board](<#board>) via **Placements**. Undeployed
[Pieces](<#piece>) remain in the [Player's](<#player>) [Hand](<#hand>) and may
be introduced later via [Arata](<#arata>). [Check](<#check>),
[Self Check](<#self-check>), and [Terminal Conditions](<#terminal-condition>)
are not evaluated during this phase. The only terminal evaluation at this
boundary is [Exposure](<#exposure>). See
[BR-DEPLOY](<#br-deploy---deploy-phase-rules>) for full rules.

#### Battle Phase
The main phase of the [Game](<#game>) following the
[Deploy Phase](<#deploy-phase>). Consists of alternating **Turns**, each
requiring exactly one **Play** ([Move](<#move>) or [Arata](<#arata>)).
[Terminal Conditions](<#terminal-condition>) ([Checkmate](<#checkmate>),
[Stalemate](<#stalemate>), [Repetition](<#repetition>)) are evaluated before
each [Turn](<#turn>). [Exposure](<#exposure>) is evaluated exactly once, at
the [Deploy](<#deploy-phase>)->[Battle](<#battle-phase>) boundary.
[BR-TERMINATION](<#br-termination---game-termination-rules>).

#### Placement
An [Action](<#action>) available only during the
[Deploy Phase](<#deploy-phase>): placing one unplaced [Piece](<#piece>) on an
empty [Square](<#square>) of the [Player's](<#player>) deploy zone, or on top
of a friendly [Stack](<#stack>) there (never on a [Marshal](<#marshal>),
[Stack Size](<#stack-size>) permitting). [Placements](<#placement>) are not
[Plays](<#play>); [Self Check](<#self-check>) and
[Terminal Condition](<#terminal-condition>) evaluation do not apply during
the [Deploy Phase](<#deploy-phase>). See
[BR-DEPLOY](<#br-deploy---deploy-phase-rules>) for full rules.

#### Action
Any interaction that a [Player](<#player>) can have with the [Game](<#game>).
An [Action](<#action>) is either a [Placement](<#placement>) or a
[Play](<#play>).

#### Play
An [Action](<#action>) that a [Player](<#player>) performs during their
[Turn](<#turn>). Either a [Move](<#move>) or an [Arata](<#arata>). Captured
[Pieces](<#piece>) are removed from the [Game](<#game>) entirely and never
return.

#### Hand
A [Player's](<#player>) inventory of [Pieces](<#piece>) not currently on the
[Board](<#board>). Starts full (25 [Pieces](<#piece>) per
[Player](<#player>)). Shrinks via [Placements](<#placement>) during the
[Deploy Phase](<#deploy-phase>) and via [Arata](<#arata>) during the
[Battle Phase](<#battle-phase>). Captured [Pieces](<#piece>) are removed from
the [Game](<#game>) entirely and never enter a [Hand](<#hand>).

#### Arata
An [Action](<#action>) that a [Player](<#player>) performs during their
[Turn](<#turn>) **instead** of a [Move](<#move>). An
[Arata](<#arata>) places a [Piece](<#piece>) from the
[Player's](<#player>) [Hand](<#hand>) onto the [Board](<#board>),
subject to placement zone and stacking restrictions. See
[BR-ARATA](<#br-arata---arata-rules>) for full rules.

#### Move
A [Play](<#play>) where the [Active Player](<#active player>) relocates the top
[Piece](<#piece>) of one of their [Stacks](<#stack>) (or the sole
[Piece](<#piece>) if alone on a [Square](<#square>)) to another
[Square](<#square>) according to that [Piece Type's](<#piece-type>) movement
rules. A [Move](<#move>) may result in a [Capture](<#capture>) or a
[Stacking](<#stacking>) action.

#### Stacking (verb)
A result of a [Move](<#move>) where the moving [Piece](<#piece>) lands on a
[Square](<#square>) occupied by another [Stack](<#stack>) without removing the
occupants. The moving [Piece](<#piece>) becomes the new top of the target
[Stack](<#stack>). See [BR-STACK](<#br-stack---stack-rules>) for conditions.

#### Capture
A consequence of a [Move](<#move>) where all enemy [Pieces](<#piece>) in the
target [Stack](<#stack>) are removed from the [Game](<#game>) entirely. The
moving [Piece](<#piece>) becomes the sole occupant (or top of any remaining
friendly [Stack](<#stack>)). See [BR-CAPTURE](<#br-capture---capture-rules>)
for conditions.

#### Legal Play
A [Play](<#play>) that satisfies all applicable rules.

#### Illegal Play
A [Play](<#play>) that does not satisfy at least one applicable rule.

#### Turn
A unit of the [Battle Phase](<#battle-phase>) where the
[Active Player](<#active player>) must do exactly one [Play](<#play>). Ends
immediately after the [Play](<#play>); the
[Active Player](<#active player>) passes to the
[Opponent](<#opponent>).

#### Game
A formal contest between two [Players](<#player>) that progresses in
[Turns](<#turn>), beginning from a [Deploy Phase](<#deploy-phase>) and
ending when a [Terminal Condition](<#terminal-condition>) is met. A
[Game](<#game>) holds an ordered sequence of [Game States](<#game-state>),
used for rules such as [Repetition](<#repetition>).

#### Piece
An entity that represents a single movable unit owned by a [Player](<#player>).
It is uniquely described by:
- Type (one of 14 [Piece Types](<#piece-type>)), which determines its movement
pattern;
- Owner ([White](<#player>) or [Black](<#player>)), which defines its forward
direction.
A [Piece](<#piece>) always exists on a specific [Square](<#square>) of the
[Board](<#board>) within a [Stack](<#stack>). Once captured, a
[Piece](<#piece>) is removed from the [Game](<#game>) and never returns.

#### Position
The arrangement of all [Pieces](<#piece>) on the [Board](<#board>), organized
into [Stacks](<#stack>). The order of [Pieces](<#piece>) within each
[Stack](<#stack>) (their [Levels](<#level>)) matters: two arrangements with
the same [Pieces](<#piece>) in different internal orders are different
[Positions](<#position>).

#### Game State
A snapshot of the [Game](<#game>) at a given instant. It consists of the
[Active Player](<#active player>), the current [Position](<#position>), and
the contents of both [Hands](<#hand>). Two [Game States](<#game-state>) are
equal only when all three match --- states with different [Hands](<#hand>)
afford different [Arata](<#arata>) continuations.
[Repetition](<#repetition>) compares full [Game States](<#game-state>).

#### Terminal Condition
Any situation that immediately ends the [Game](<#game>), determines a winner,
or declares a draw. They are:
- [Checkmate](<#checkmate>)
- [Stalemate](<#stalemate>)
- [Repetition](<#repetition>)
- [Exposure](<#exposure>)
- [Insufficient Material](<#insufficient-material>)

#### Check
A condition where a [Player's](<#player>) [Marshal](<#marshal>) occupies a
[Square](<#square>) that is under [Attack](<#attack>) by one or more of the
[Opponent's](<#opponent>) [Pieces](<#piece>).

#### Checkmate
A condition where a [Player's](<#player>) [Marshal](<#marshal>) is in
[Check](<#check>) and no legal [Play](<#play>) exists to remove the threat.
[Checkmate](<#checkmate>) ends the [Game](<#game>) with the
[Active Player](<#active player>) losing.

#### Stalemate
A [Game State](<#game-state>) where the [Active Player](<#active player>) does
not have any legal [Plays](<#play>) available. Results in the loss of the
[Active Player](<#active player>).

#### Repetition
A draw declared when the same [Game State](<#game-state>) (same
[Active Player](<#active player>), same [Position](<#position>) and same
[Hands](<#hand>) contents) occurs for the fourth time in the
[Battle Phase](<#battle-phase>) of a [Game](<#game>), not necessarily
consecutively. [Deploy Phase](<#deploy-phase>) states are never counted.
The initial [Game State](<#game-state>) at the start of the
[Battle Phase](<#battle-phase>) counts as the first occurrence.

#### Exposure
A [Terminal Condition](<#terminal-condition>) evaluated once, immediately
after the [Deploy Phase](<#deploy-phase>) ends. If exactly one
[Player's](<#player>) [Marshal](<#marshal>) is under [Attack](<#attack>),
that [Player](<#player>) loses immediately; if both [Marshals](<#marshal>)
are under [Attack](<#attack>), the [Game](<#game>) is a draw.
[Exposure](<#exposure>) is not [Check](<#check>) --- there is no escape
attempt at this boundary. See
[BR-DEPLOY-012](<#br-deploy-012---exposure-evaluation>).

#### Insufficient Material
A [Terminal Condition](<#terminal-condition>) evaluated before each
[Turn](<#turn>) in the [Battle Phase](<#battle-phase>), after
[Repetition](<#repetition>). If both [Players](<#player>) have exactly
their [Marshal](<#marshal>) on the [Board](<#board>) and no pieces remaining
in either [Hand](<#hand>), the [Game](<#game>) ends in a draw --- no
[Player](<#player>) can ever deliver [Checkmate](<#checkmate>).

#### Attack
A [Piece](<#piece>) attacks a [Square](<#square>) if, applying the same
[Movement](<#movement>) rules that govern its possible destinations, the
[Square](<#square>) can be reached disregarding whether it is currently
occupied by a friendly [Piece](<#piece>). [Stack Size](<#stack-size>) scaling
applies to [Attack](<#attack>) just as it does to
[Movement](<#movement>): a [Piece](<#piece>) at a higher
[Stack Size](<#stack-size>) attacks its extended destinations.
[Obstructions](<#obstruction>) and [Board](<#board>) boundaries are considered
as defined by [Movement](<#movement>). For threat evaluation against a
[Marshal](<#marshal>), the restriction on landing on the
[Marshal's](<#marshal>) [Square](<#square>) is disregarded --- a
[Marshal](<#marshal>) is never actually [Captured](<#capture>) because
[Checkmate](<#checkmate>) ends the [Game](<#game>) first (see
[BR-STACK-004](<#br-stack-004---stacking-on-marshal-is-forbidden>)). The
stack size landing restriction
([BR-MOVE-005](<#br-move-005---stack-size-landing-restriction>)) still
applies: a [Piece](<#piece>) cannot attack a [Square](<#square>) whose
[Stack Size](<#stack-size>) exceeds its own source
[Stack Size](<#stack-size>).

#### Self Check
A restriction that prohibits a [Player](<#player>) from performing any
[Play](<#play>) that places or leaves their own [Marshal](<#marshal>) in
[Check](<#check>). It does not apply during the
[Deploy Phase](<#deploy-phase>).

#### Piece Type
A category defining a [Piece's](<#piece>) [Movement](<#movement>). Gungi has
14 [Piece Types](<#piece-type>). See the
[Piece Type Reference](#piece-type-reference) section.

#### Marshal
The [Piece](<#piece>) that is the analogue from king from chess --- its
[Checkmate](<#checkmate>) ends the [Game](<#game>). Each [Player](<#player>)
has exactly one [Marshal](<#marshal>). It must be the first [Piece](<#piece>)
deployed by each [Player](<#player>) during the [Deploy Phase](<#deploy-phase>).
No [Piece](<#piece>) may ever be placed or moved on top of a
[Marshal](<#marshal>) --- the [Marshal](<#marshal>) is always the topmost
[Piece](<#piece>) in any [Stack](<#stack>) it belongs to. The
[Marshal](<#marshal>) has [Step Movement](<#step-movement>) in all 8
[directions](<#directional-vector>).

#### Movement
The set of options that a [Piece Type](<#piece-type>) has in a [Move](<#move>)
[Play](<#play>). They are classified as [Step Movement](<#step-movement>),
[Limited Range Movement](<#limited-range-movement>),
[Range Movement](<#range-movement>) and [Jump Movement](<#jump-movement>).

#### Step Movement
A [Movement](<#movement>) pattern where a [Piece](<#piece>) shifts exactly one
[Square](<#square>) in a [Directional Vector](<#directional-vector>) allowed by
its [Piece Type](<#piece-type>).

#### Limited Range Movement
A [Movement](<#movement>) pattern where a [Piece](<#piece>) shifts along a
[Directional Vector](<#directional-vector>) allowed by its
[Piece Type](<#piece-type>) up to a bounded maximum number of
[Squares](<#square>) --- the base maximum is 2 at [Stack Size](<#stack-size>)
1, extended by the [Stack Size](<#stack-size>) bonus (range 1-3 at size 2,
range 1-4 at size 3; see
[BR-MOVEMENT-005](<#br-movement-005---stack-scaling-general-rule>)). The
[Piece](<#piece>) may stop at any [Square](<#square>) up to the maximum, but
must obey [Obstruction](<#obstruction>) rules --- it cannot pass through an
occupied [Square](<#square>).

#### Range Movement
A [Movement](<#movement>) pattern where a [Piece](<#piece>) shifts along a
continuous straight line by repeatedly applying the same
[Directional Vector](<#directional-vector>). The [Piece](<#piece>) may pass
through any number of empty [Squares](<#square>), but must stop at the
[Board](<#board>) edge or upon encountering an [Obstruction](<#obstruction>).

#### Jump Movement
A [Movement](<#movement>) pattern where a [Piece](<#piece>) relocates directly
to a [Destination](<#destination>), bypassing the [Squares](<#square>) in
between. Each jump is defined at Level 1 by:
- `dest = (Δcol, Δrow)` --- the [Destination](<#destination>) relative to the
  [Origin](<#origin>), expressed in [Player](<#player>)-relative coordinates:
  positive row = forward, positive col = left.
- `over = {(col, row), ...}` --- the set of [Squares](<#square>) the
  [Piece](<#piece>) jumps over and must be passable.

[Obstructions](<#obstruction>) are ignored **unless** a jumped-over
[Square](<#square>) has a [Stack](<#stack>) whose
[Stack Size](<#stack-size>) is greater than the jumping [Piece's](<#piece>)
source [Stack Size](<#stack-size>) --- in that case the jump is blocked.

[Jump Movement](<#jump-movement>) scales with [Stack Size](<#stack-size>)
per [BR-MOVEMENT-005](<#br-movement-005---stack-scaling-general-rule>).

#### Directional Vector
A direction of movement relative to the [Piece's](<#piece>) owner. The eight
vectors are:
- **Forward (F)**: toward the opponent's side.
- **Backward (B)**: toward the player's own side.
- **Left (L)**: to the player's left.
- **Right (R)**: to the player's right.
- **Forward-Left (FL)**: a Forward and Left step simultaneously.
- **Forward-Right (FR)**: a Forward and Right step simultaneously.
- **Backward-Left (BL)**: a Backward and Left step simultaneously.
- **Backward-Right (BR)**: a Backward and Right step simultaneously.

In terms of the [Standard Diagram](<#standard-diagram>):
- For [White](<#player>): Forward = toward [Row](<#row>) 1,
Backward = toward [Row](<#row>) 9, Left = toward [Column](<#column>) 9,
Right = toward [Column](<#column>) 1.
- For [Black](<#player>): Forward = toward [Row](<#row>) 9,
Backward = toward [Row](<#row>) 1, Left = toward [Column](<#column>) 1,
Right = toward [Column](<#column>) 9.

#### Orthogonal Vector
Any of the following [Directional Vectors](<#directional-vector>):
- **Forward (F)**
- **Backward (B)**
- **Left (L)**
- **Right (R)**

#### Diagonal Vector
Any of the following [Directional Vectors](<#directional-vector>):
- **Forward-Left (FL)**
- **Forward-Right (FR)**
- **Backward-Left (BL)**
- **Backward-Right (BR)**

#### Path
The [Squares](<#square>) between the [Origin](<#origin>) and the
[Destination](<#destination>) of a [Move](<#move>) done by a [Piece](<#piece>)
using a [Range Movement](<#range-movement>) or
[Limited Range Movement](<#limited-range-movement>).
[Jump Movement](<#jump-movement>) has no [Path](<#path>) --- its intervening
[Squares](<#square>) are defined by its jumped-over set instead.

#### Obstruction
A [Square](<#square>) along a [Path](<#path>) that is occupied by any
[Piece](<#piece>). For [Step Movement](<#step-movement>),
[Limited Range Movement](<#limited-range-movement>), and
[Range Movement](<#range-movement>):
- If the obstructing [Piece](<#piece>) belongs to the same
[Player](<#player>) as the moving [Piece](<#piece>), the obstructed
[Square](<#square>) is reachable (resulting in automatic
[Stacking](<#stacking>)), but the [Path](<#path>) cannot extend beyond it.
- If it belongs to the [Opponent](<#opponent>), the obstructed
[Square](<#square>) is reachable (resulting in a [Capture](<#capture>),
[Stacking](<#stacking>), or being considered [Attacked](<#attack>)), but the
[Path](<#path>) cannot extend beyond it.
For [Jump Movement](<#jump-movement>): [Obstructions](<#obstruction>) are
ignored unless the obstructing [Stack](<#stack>) has a
[Stack Size](<#stack-size>) greater than the jumping [Piece's](<#piece>)
source [Stack Size](<#stack-size>) --- in that case the jump is blocked.

#### Destination
The [Square](<#square>) where a [Piece](<#piece>) is at the end of a
[Move](<#move>).

#### Origin
The [Square](<#square>) where a [Piece](<#piece>) is before a [Move](<#move>).

---

## Piece Type Reference

Gungi has 14 [Piece Types](<#piece-type>). Each [Player](<#player>) has the
following inventory: 1x [Marshal](<#marshal>), 1x [General](<#general>),
1x [Lieutenant](<#lieutenant>), 2x [Major](<#major>), 2x [Samurai](<#samurai>),
3x [Spear](<#spear>), 2x [Knight](<#knight>), 2x [Spy](<#spy>),
2x [Fortress](<#fortress>), 4x [Pawn](<#pawn>), 1x [Cannon](<#cannon>),
2x [Archer](<#archer>), 1x [Musketeer](<#musketeer>) and
1x [Captain](<#captain>) --- 25 [Pieces](<#piece>) per [Player](<#player>)
total.

#### Marshal
- **Count per player:** 1
- **Movement:** [Step](<#step-movement>) in all 8
  [Directional Vectors](<#directional-vector>): (F, B, L, R, FL, FR, BL, BR).
- **Role:** The [Game](<#game>) ends when the [Marshal](<#marshal>) is
  [Checkmated](<#checkmate>).
- **Restrictions:** No [Piece](<#piece>) may be placed or moved on top of a
  [Marshal](<#marshal>). The [Marshal](<#marshal>) is always the topmost
  [Piece](<#piece>) in any [Stack](<#stack>) it belongs to. Must be deployed
  first during the [Deploy Phase](<#deploy-phase>).

#### General
- **Count per player:** 1
- **Movement:**
  - [Range Movement](<#range-movement>) in all 4
  [Orthogonal Vectors](<#orthogonal-vector>): (F, B, L, R).
  - [Step Movement](<#step-movement>) in all 4
  [Diagonal Vectors](<#diagonal-vector>): (FL, FR, BL, BR).

#### Lieutenant
- **Count per player:** 1
- **Movement:**
  - [Range Movement](<#range-movement>) in all 4
  [Diagonal Vectors](<#diagonal-vector>): (FL, FR, BL, BR).
  - [Step Movement](<#step-movement>) in all 4
  [Orthogonal Vectors](<#orthogonal-vector>): (F, B, L, R).

#### Major
- **Count per player:** 2
- **Movement:** [Step Movement](<#step-movement>) in F, B, L, R, FL, FR (all
  [Orthogonal Vectors](<#orthogonal-vector>) plus
  [Forward Diagonals](<#diagonal-vector>)).

#### Samurai
- **Count per player:** 2
- **Movement:** [Step Movement](<#step-movement>) in F, FL, FR, B.

#### Spear
- **Count per player:** 3
- **Movement:**
  - [Limited Range Movement](<#limited-range-movement>) (1 or 2
    [Squares](<#square>)): F.
  - [Step Movement](<#step-movement>): FL, FR, B.

#### Knight
- **Count per player:** 2
- **Movement:**
  - [Limited Range Movement](<#limited-range-movement>) (1 or 2
    [Squares](<#square>)): F, B.
  - [Step Movement](<#step-movement>): L, R.

#### Spy
- **Count per player:** 2
- **Movement:** [Limited Range Movement](<#limited-range-movement>) (1 or 2
  [Squares](<#square>)) in all 4 [Diagonal Vectors](<#diagonal-vector>)
  (FL, FR, BL, BR).

#### Fortress
- **Count per player:** 2
- **Movement:** [Step Movement](<#step-movement>) in F, L, R, BL, BR.

#### Pawn
- **Count per player:** 4
- **Movement:** [Step Movement](<#step-movement>) in F, B.

#### Cannon
- **Count per player:** 1
- **Movement:**
  - **Step:** L, R, B.
  - **Jump:** dest = (0, +3), over = {(0, +1), (0, +2)}.

#### Archer
- **Count per player:** 2
- **Movement:**
  - **Step:** B.
  - **Jump right:** dest = (-1, +2), over = {(0, +1)}.
  - **Jump left:** dest = (+1, +2), over = {(0, +1)}.
  - **Jump forward:** dest = (0, +2), over = {(0, +1)}.

#### Musketeer
- **Count per player:** 1
- **Movement:**
  - **Step:** BL, BR.
  - **Jump:** dest = (0, +2), over = {(0, +1)}.

#### Captain
- **Count per player:** 1
- **Movement:** [Step Movement](<#step-movement>) in FL, FR, B.
- **Special ability --- Turncoat:** When the [Captain](<#captain>) becomes
  the top of a [Stack](<#stack>) containing enemy [Pieces](<#piece>) (via
  [Stacking](<#stacking>) by a [Move](<#move>) or by an [Arata](<#arata>)),
  the [Player](<#player>) may swap each enemy [Piece](<#piece>) below it: the
  enemy [Piece](<#piece>) is removed from the [Game](<#game>) and replaced at
  the same [Level](<#level>) by a friendly [Piece](<#piece>) of the same type
  from their [Hand](<#hand>). A swap is not a [Capture](<#capture>). See
  [BR-STACK-006](<#br-stack-006---captain-turncoat>).

---

## Business Rules

Gungi is a tactical board game with stacking mechanics. Below is a rewrite of
the rules in the form of business rules.

### BR-DEPLOY - Deploy Phase Rules

#### BR-DEPLOY-001 - Deploy phase start
A [Game](<#game>) begins with the [Deploy Phase](<#deploy-phase>). During this
phase, [Players](<#player>) alternately place their [Pieces](<#piece>) on the
[Board](<#board>).

#### BR-DEPLOY-002 - Placement order
[White](<#player>) takes the first [Placement](<#placement>).
[Players](<#player>) alternate thereafter, placing exactly one unplaced
[Piece](<#piece>) per [Placement](<#placement>).

#### BR-DEPLOY-003 - Marshal first
Each [Player](<#player>) must deploy their [Marshal](<#marshal>) as their very
first [Piece](<#piece>) in the [Deploy Phase](<#deploy-phase>).

#### BR-DEPLOY-004 - Deploy zone
Each [Piece](<#piece>) must be placed on one of the three [Rows](<#row>)
closest to its owner's side of the [Board](<#board>):
- [White](<#player>) must place on [Rows](<#row>) 7, 8, or 9.
- [Black](<#player>) must place on [Rows](<#row>) 1, 2, or 3.

#### BR-DEPLOY-005 - Deploy stacking
During the [Deploy Phase](<#deploy-phase>), a [Player](<#player>) may place a
[Piece](<#piece>) on top of one of their own already-placed
[Pieces](<#piece>), creating a [Stack](<#stack>). This is subject to the
[Stack Size](<#stack-size>) limit of 3 and the restriction that no
[Piece](<#piece>) may ever be stacked on top of a [Marshal](<#marshal>).

#### BR-DEPLOY-006 - Deploy on empty squares
A [Piece](<#piece>) may also be placed on an empty [Square](<#square>) within
the [Player's](<#player>) deploy zone.

#### BR-DEPLOY-007 - Done declaration
After placing a [Piece](<#piece>) during their [Placement](<#placement>), a
[Player](<#player>) may declare themselves **Done**. A [Player](<#player>) who
declares Done ceases deploying; any remaining unplaced [Pieces](<#piece>)
remain in their [Hand](<#hand>) and may be used later via [Arata](<#arata>).

#### BR-DEPLOY-008 - Opponent continues after Done
If a [Player](<#player>) declares Done, the [Opponent](<#opponent>) may
continue deploying on their [Placements](<#placement>) until they also declare
Done or have placed all their [Pieces](<#piece>).

#### BR-DEPLOY-009 - Deploy phase end
The [Deploy Phase](<#deploy-phase>) ends when both [Players](<#player>) have
either placed all their [Pieces](<#piece>) or declared Done.

#### BR-DEPLOY-010 - First Battle Phase turn
After the [Deploy Phase](<#deploy-phase>) ends, the [Battle Phase](<#battle-phase>)
begins with [White](<#player>) as the [Active Player](<#active player>) for the
first [Turn](<#turn>).

#### BR-DEPLOY-011 - Hand contents after deploy
After the [Deploy Phase](<#deploy-phase>) ends, each [Player's](<#player>)
[Hand](<#hand>) contains all of their [Pieces](<#piece>) that were not placed
on the [Board](<#board>) during the phase. Once the
[Deploy Phase](<#deploy-phase>) has ended, the
[Marshal](<#marshal>) is never in a [Hand](<#hand>) since it must always be
deployed first. (During the [Deploy Phase](<#deploy-phase>), an undeployed
[Marshal](<#marshal>) resides in the [Hand](<#hand>) until its
[Placement](<#placement>).)

#### BR-DEPLOY-012 - Exposure evaluation
When the [Deploy Phase](<#deploy-phase>) ends, both [Marshals](<#marshal>)
are evaluated for [Exposure](<#exposure>) before the [Battle Phase](<#battle-phase>)
[Turn](<#turn>) sequence begins:
- If exactly one [Player's](<#player>) [Marshal](<#marshal>) is under
  [Attack](<#attack>), that [Player](<#player>) loses immediately.
- If both [Marshals](<#marshal>) are under [Attack](<#attack>), the
  [Game](<#game>) is a draw.
- Otherwise, the [Battle Phase](<#battle-phase>) [Turn](<#turn>) sequence begins
  ([BR-DEPLOY-010](<#br-deploy-010---first-battle-phase-turn>)) with neither
  [Marshal](<#marshal>) under [Attack](<#attack>).

### BR-GAME - Game Lifecycle Rules

#### BR-GAME-001 - Game start
A [Game](<#game>) begins when the [Deploy Phase](<#deploy-phase>) starts.

#### BR-GAME-002 - Game end
A [Game](<#game>) ends when a [Terminal Condition](<#terminal-condition>) is
met.

#### BR-GAME-003 - No actions after termination
After a [Terminal Condition](<#terminal-condition>) is met, no further
[Action](<#action>) is accepted.

#### BR-GAME-004 - Terminal Condition evaluation order
Before each [Turn](<#turn>), [Terminal Conditions](<#terminal-condition>) are
evaluated in the following order:
1. [Checkmate](<#checkmate>) and [Stalemate](<#stalemate>)
2. [Repetition](<#repetition>)
3. [Insufficient Material](<#insufficient-material>)
The first applicable condition ends the [Game](<#game>).
[Terminal Conditions](<#terminal-condition>) are not evaluated during the
[Deploy Phase](<#deploy-phase>); the only boundary evaluation is
[Exposure](<#exposure>)
([BR-DEPLOY-012](<#br-deploy-012---exposure-evaluation>)), which runs once
when the [Deploy Phase](<#deploy-phase>) ends.

### BR-TURN - Turn Management Rules

#### BR-TURN-001 - Number of plays per turn
During their [Turn](<#turn>), a [Player](<#player>) must do exactly one
[Play](<#play>).

#### BR-TURN-002 - Turn transition
After executing a [Play](<#play>), the [Turn](<#turn>) ends and the
[Active Player](<#active player>) becomes the [Opponent](<#opponent>).

### BR-ACTION - Action Validation Rules

#### BR-ACTION-001 - Player authority
If an [Action](<#action>) references a [Piece](<#piece>), that
[Piece](<#piece>) must belong to the [Player](<#player>) performing the
[Action](<#action>).

#### BR-ACTION-002 - Self Check
A [Player](<#player>) cannot perform any [Play](<#play>) that places or
leaves their own [Marshal](<#marshal>) in [Check](<#check>). Self Check does
not apply to [Placements](<#placement>): [Check](<#check>) is not evaluated
during the [Deploy Phase](<#deploy-phase>) (see
[BR-DEPLOY-012](<#br-deploy-012---exposure-evaluation>)).

#### BR-ACTION-003 - Consequence of an illegal action
If an [Action](<#action>) does not satisfy all applicable rules, the
[Game State](<#game-state>) remains unchanged.

#### BR-ACTION-004 - Player identification in actions
For a [Play](<#play>) ([Move](<#move>) or [Arata](<#arata>)), the performing
[Player](<#player>) is always inferred from the
[Active Player](<#active player>) --- it is never carried in the
[Play](<#play>) itself. For a [Placement](<#placement>), the performing
[Player](<#player>) is inferred from the [Placement](<#placement>) order
([BR-DEPLOY-002](<#br-deploy-002---placement-order>)).

### BR-PLAY - Play Rules

#### BR-PLAY-001 - Board boundaries
The [Destination](<#destination>) of a [Play](<#play>) must be a valid
[Square](<#square>) within the 9x9 [Board](<#board>).

#### BR-PLAY-002 - Turn context
A [Play](<#play>) can only be performed during the
[Active Player's](<#active player>) [Turn](<#turn>).

#### BR-PLAY-003 - Types of plays
A [Play](<#play>) in Gungi is either a [Move](<#move>) or an [Arata](<#arata>).
Exactly one [Play](<#play>) is performed per [Turn](<#turn>). Captured
[Pieces](<#piece>) are removed from the [Game](<#game>) entirely.

### BR-ARATA - Arata Rules

#### BR-ARATA-001 - Arata replaces a Move
An [Arata](<#arata>) is a [Play](<#play>) that a [Player](<#player>) may
perform **instead** of a [Move](<#move>) during their [Turn](<#turn>).
A [Player](<#player>) cannot both [Move](<#move>) and
[Arata](<#arata>) in the same [Turn](<#turn>).

#### BR-ARATA-002 - Piece must be in hand
An [Arata](<#arata>) can only place a [Piece](<#piece>) that currently exists
in the [Player's](<#player>) [Hand](<#hand>). The placed [Piece](<#piece>) is
removed from the [Hand](<#hand>) upon placement.

#### BR-ARATA-003 - Arata placement zone
An [Arata](<#arata>) can only place a [Piece](<#piece>) on a
[Square](<#square>) whose [Row](<#row>) lies between the
[Player's](<#player>) own edge of the [Board](<#board>) and the
[Player's](<#player>) most advanced [Piece](<#piece>) already on the
[Board](<#board>). The most advanced [Piece](<#piece>) is the one closest to
the [Opponent's](<#opponent>) edge:
- For [White](<#player>): between [Row](<#row>) 9 (own edge) and the
  smallest [Row](<#row>) containing any of [White's](<#player>)
  [Pieces](<#piece>), inclusive.
- For [Black](<#player>): between [Row](<#row>) 1 (own edge) and the
  largest [Row](<#row>) containing any of [Black's](<#player>)
  [Pieces](<#piece>), inclusive.

#### BR-ARATA-004 - Arata on empty squares
An [Arata](<#arata>) may place a [Piece](<#piece>) on any empty
[Square](<#square>) within the [Arata](<#arata>) placement zone.

#### BR-ARATA-005 - Arata stacking on friendly pieces
An [Arata](<#arata>) may stack the placed [Piece](<#piece>) on top of a
friendly [Stack](<#stack>) within the placement zone, subject to the normal
[Stack Size](<#stack-size>) limit of 3 and the restriction that no
[Piece](<#piece>) may ever be stacked on top of a [Marshal](<#marshal>). If
the placed [Piece](<#piece>) is a [Captain](<#captain>) and the target
[Stack](<#stack>) contains enemy [Pieces](<#piece>) below its friendly top,
[Turncoat](<#br-stack-006---captain-turncoat>) swaps may apply.

#### BR-ARATA-006 - Arata cannot stack on enemy pieces
An [Arata](<#arata>) can never place a [Piece](<#piece>) on a
[Square](<#square>) occupied by an [Opponent's](<#opponent>)
[Stack](<#stack>). The target [Square](<#square>) must either be empty or
contain a [Stack](<#stack>) which the top [Piece](<#piece>) is friendly,
regardless of the ownership of [Pieces](<#piece>) below the top.

#### BR-ARATA-007 - Arata cannot stack on Marshal
An [Arata](<#arata>) can never place a [Piece](<#piece>) on top of a
[Marshal](<#marshal>), whether friendly or enemy.

### BR-MOVE - Move Validation Rules

#### BR-MOVE-001 - Moving the top piece
A [Move](<#move>) can only relocate the top [Piece](<#piece>) of a
[Stack](<#stack>) (or the sole [Piece](<#piece>) if the
[Stack](<#stack>) size is 1). The moving [Piece](<#piece>) detaches from its
source [Stack](<#stack>).

#### BR-MOVE-002 - Origin must contain own piece
The [Origin](<#origin>) of a [Move](<#move>) must contain a
[Piece](<#piece>) belonging to the [Active Player](<#active player>).

#### BR-MOVE-003 - Valid movement path
A [Move](<#move>) must follow the [Movement](<#movement>) rules of the moved
[Piece](<#piece>), as defined by [BR-MOVEMENT](<#br-movement---piece-movement-rules>).

#### BR-MOVE-004 - Move resolution on occupied squares
When a [Move](<#move>) lands on an occupied [Square](<#square>), the outcome
is determined by [BR-STACK](<#br-stack---stack-rules>) and
[BR-CAPTURE](<#br-capture---capture-rules>).

#### BR-MOVE-005 - Stack size landing restriction
A [Move](<#move>) is [Illegal](<#illegal-play>) if the
[Destination](<#destination>) [Square](<#square>) is occupied by a
[Stack](<#stack>) whose [Stack Size](<#stack-size>) exceeds the moving
[Piece's](<#piece>) source [Stack Size](<#stack-size>). This applies
regardless of whether the occupant is friendly or enemy.

### BR-MOVEMENT - Piece Movement Rules

#### BR-MOVEMENT-001 - Step Movement validity
A [Move](<#move>) using [Step Movement](<#step-movement>) is valid if the
[Destination](<#destination>) is exactly one step away in a
[Directional Vector](<#directional-vector>) allowed by the
[Piece Type](<#piece-type>).

#### BR-MOVEMENT-002 - Limited Range Movement validity
A [Move](<#move>) using [Limited Range Movement](<#limited-range-movement>)
is valid if the [Destination](<#destination>) is 1 or 2 [Squares](<#square>)
away along a [Directional Vector](<#directional-vector>) allowed by the
[Piece Type](<#piece-type>), with no [Obstructions](<#obstruction>) along the
[Path](<#path>) before the [Destination](<#destination>).

#### BR-MOVEMENT-003 - Range Movement validity
A [Move](<#move>) using [Range Movement](<#range-movement>) is valid if the
[Destination](<#destination>) lies along a continuous line in a
[Directional Vector](<#directional-vector>) allowed by the
[Piece Type](<#piece-type>), with no [Obstructions](<#obstruction>) along the
[Path](<#path>).

#### BR-MOVEMENT-004 - Jump Movement validity
A [Move](<#move>) using [Jump Movement](<#jump-movement>) is valid if the
[Destination](<#destination>) matches the jump pattern of the
[Piece Type](<#piece-type>), regardless of intervening
[Squares](<#square>), **except** that the jump is blocked if any jumped-over
[Square](<#square>) contains a [Stack](<#stack>) whose
[Stack Size](<#stack-size>) is greater than the jumping [Piece's](<#piece>)
source [Stack Size](<#stack-size>).

#### BR-MOVEMENT-005 - Stack scaling general rule
The top [Piece](<#piece>) of a [Stack](<#stack>) gains a movement bonus based
on the [Stack Size](<#stack-size>) of the [Stack](<#stack>) it belongs to:
- At size 1: no bonus.
- At size 2: +1 to all allowed movement ranges.
- At size 3: +2 to all allowed movement ranges.

Consequences per movement type:
- [Step Movement](<#step-movement>) becomes [Limited Range Movement](<#limited-range-movement>)
  (range 1-2 at size 2, range 1-3 at size 3).
- [Limited Range Movement](<#limited-range-movement>) extends (range 1-3
  at size 2, range 1-4 at size 3).
- [Range Movement](<#range-movement>) is unaffected by the bonus: it already
  extends to the [Board](<#board>) edge or the first
  [Obstruction](<#obstruction>).

For [Jump Movement](<#jump-movement>), the scaling vector is derived from the
Level 1 pattern: each level extends the jump by `dest - farthest(over)` --- the
vector from the farthest jumped-over [Square](<#square>) to the
[Destination](<#destination>). The previous level's
[Destination](<#destination>) becomes part of the jumped-over set. All
lower-level jump destinations remain valid.

### BR-STACK - Stack Rules

#### BR-STACK-001 - Stack size limit
No [Square](<#square>) may contain more than 3 [Pieces](<#piece>).

#### BR-STACK-002 - Stacking on enemy squares
When a [Move](<#move>) lands on a [Square](<#square>) occupied by an
[Opponent's](<#opponent>) [Stack](<#stack>), the moving [Player](<#player>)
may choose to [Stack](<#stacking>) (place their [Piece](<#piece>) on top,
preserving the enemy [Pieces](<#piece>) below) **only if**:
1. The moving [Piece's](<#piece>) source [Stack Size](<#stack-size>) >=
   target [Stack Size](<#stack-size>), AND
2. The target [Stack](<#stack>) has fewer than 3 [Pieces](<#piece>), AND
3. The target [Stack's](<#stack>) top [Piece](<#piece>) is not a
   [Marshal](<#marshal>).

If conditions are met, the moving [Player](<#player>) may choose between
[Stacking](<#stacking>) and [Capture](<#capture>).

#### BR-STACK-003 - Stacking on friendly squares
When a [Move](<#move>) lands on a [Square](<#square>) occupied by a friendly
[Stack](<#stack>), [Stacking](<#stacking>) occurs automatically (no
[Capture](<#capture>) applies). The same [Stack Size](<#stack-size>) constraint
applies (moving [Piece's](<#piece>) source [Stack Size](<#stack-size>) >=
target [Stack Size](<#stack-size>)). A [Move](<#move>) landing on a friendly
[Stack](<#stack>) of 3 [Pieces](<#piece>) is
[Illegal](<#illegal-play>) --- the [Stack Size](<#stack-size>) limit of 3
cannot be exceeded.

#### BR-STACK-004 - Stacking on Marshal is forbidden
No [Piece](<#piece>) may ever be placed or moved **on top of** a
[Marshal](<#marshal>) within the same [Stack](<#stack>). The
[Marshal](<#marshal>) is always the topmost [Piece](<#piece>) in any
[Stack](<#stack>) it belongs to. This rule governs vertical position within
the [Stack](<#stack>) only. The
[Marshal](<#marshal>) is never actually [Captured](<#capture>) because
[Checkmate](<#checkmate>) ends the [Game](<#game>) first (see
[Attack](<#attack>) for threat evaluation).

#### BR-STACK-005 - Effect of stacking on stack composition
When a [Piece](<#piece>) is stacked onto a target [Square](<#square>), it
becomes the new top of the target [Stack](<#stack>) at the highest
[Level](<#level>). All existing [Pieces](<#piece>) in the target
[Stack](<#stack>) retain their [Levels](<#level>) and internal order. The
moving [Piece's](<#piece>) source [Stack](<#stack>) loses one
[Piece](<#piece>) (its top), reducing that [Stack's](<#stack>)
[Size](<#stack-size>) by 1.

#### BR-STACK-006 - Captain Turncoat
When the [Captain](<#captain>) becomes the top of a [Stack](<#stack>)
containing enemy [Pieces](<#piece>) --- whether by a [Move](<#move>) that
results in [Stacking](<#stacking>) (onto an enemy- or friendly-controlled
[Square](<#square>)) or by an [Arata](<#arata>) that stacks it onto a
friendly-controlled [Stack](<#stack>) --- the moving [Player](<#player>) may,
per enemy [Piece](<#piece>) below the [Captain](<#captain>), **swap** it: the
enemy [Piece](<#piece>) is removed from the [Game](<#game>) entirely and is
immediately replaced at the same [Level](<#level>) by a friendly
[Piece](<#piece>) of the **same [Piece Type](<#piece-type>)** from the
[Player's](<#player>) own [Hand](<#hand>).

Each swap is optional and is possible only if the matching
[Piece Type](<#piece-type>) is available in the [Hand](<#hand>). A swap is
not a [Capture](<#capture>): a [Captain](<#captain>) that chooses the
[Capture](<#capture>) outcome when landing on an [Opponent's](<#opponent>)
[Stack](<#stack>) performs a normal [Capture](<#capture>) (all enemy
[Pieces](<#piece>) removed) and no swaps occur. The [Captain](<#captain>)
itself remains at the top of the [Stack](<#stack>). The applicable stacking
and placement conditions
([BR-STACK-002](<#br-stack-002---stacking-on-enemy-squares>),
[BR-STACK-003](<#br-stack-003---stacking-on-friendly-squares>),
[BR-ARATA-005](<#br-arata-005---arata-stacking-on-friendly-pieces>) and
[BR-ARATA-006](<#br-arata-006---arata-cannot-stack-on-enemy-pieces>)) must be
satisfied for the underlying [Move](<#move>) or [Arata](<#arata>) to be
legal. Any [Pieces](<#piece>) placed from the [Hand](<#hand>) are removed
from the [Hand](<#hand>).

### BR-CAPTURE - Capture Rules

#### BR-CAPTURE-001 - Capture condition
A [Capture](<#capture>) occurs when a [Move](<#move>) lands on a
[Square](<#square>) occupied by an [Opponent's](<#opponent>)
[Stack](<#stack>) and the moving [Player](<#player>) chooses (or is forced) to
[Capture](<#capture>) rather than [Stack](<#stacking>).

#### BR-CAPTURE-002 - Capture is forced at max stack size
If a [Move](<#move>) lands on a [Square](<#square>) containing an
[Opponent's](<#opponent>) [Stack](<#stack>) of 3 [Pieces](<#piece>) and the
moving [Piece's](<#piece>) source [Stack Size](<#stack-size>) >=
target [Stack Size](<#stack-size>), [Capture](<#capture>) is forced (cannot exceed stack size
limit).

#### BR-CAPTURE-003 - Stack size restriction on capture
If the moving [Piece's](<#piece>) source [Stack Size](<#stack-size>) is
**less than** the target [Stack Size](<#stack-size>), the [Move](<#move>) is
[Illegal](<#illegal-play>) --- the moving [Piece](<#piece>) cannot land on
that [Square](<#square>).

#### BR-CAPTURE-004 - Consequence of capture
When a [Capture](<#capture>) occurs, all enemy [Pieces](<#piece>) in the target
[Stack](<#stack>) are removed from the [Game](<#game>) entirely. They never
enter a [Hand](<#hand>) and are never returned to the [Board](<#board>). The
moving [Piece](<#piece>) becomes the sole occupant of the
[Square](<#square>) (or sits on top of any friendly [Pieces](<#piece>) that
were below the enemy [Pieces](<#piece>) in the target [Stack](<#stack>)).

### BR-PATH - Path and Obstruction Rules

#### BR-PATH-001 - Obstruction blocks step, limited range, and range movement
For [Step Movement](<#step-movement>),
[Limited Range Movement](<#limited-range-movement>), and
[Range Movement](<#range-movement>), a [Move](<#move>) is valid only if no
[Obstruction](<#obstruction>) exists between the [Origin](<#origin>) and the
[Destination](<#destination>). If an [Obstruction](<#obstruction>) exists, the
[Destination](<#destination>) is valid only if it is the obstructing
[Square](<#square>) itself: if it is occupied by a friendly
[Piece](<#piece>), the result is automatic [Stacking](<#stacking>)
([BR-STACK-003](<#br-stack-003---stacking-on-friendly-squares>)); if it is
occupied by an [Opponent's](<#opponent>) [Piece](<#piece>), the result is a
[Capture](<#capture>) or [Stacking](<#stacking>)
([BR-STACK-002](<#br-stack-002---stacking-on-enemy-squares>)). In both cases
the [Path](<#path>) cannot extend beyond the obstructing
[Square](<#square>).

#### BR-PATH-002 - Obstruction partially blocks jumping movement
For [Jump Movement](<#jump-movement>), [Obstructions](<#obstruction>) are
ignored **unless** the obstructing [Stack](<#stack>) has a
[Stack Size](<#stack-size>) greater than the jumping [Piece's](<#piece>)
source [Stack Size](<#stack-size>). In that case, the jump is blocked
entirely and the [Move](<#move>) is [Illegal](<#illegal-play>).

### BR-REPETITION - Repetition Rules

#### BR-REPETITION-001 - Repetition draw
If the same [Game State](<#game-state>) (same
[Active Player](<#active player>), same [Position](<#position>) and same
[Hands](<#hand>) contents) occurs for the fourth time in the
[Battle Phase](<#battle-phase>) of a [Game](<#game>), the [Game](<#game>) ends
in a draw. Only [Battle Phase](<#battle-phase>) states count toward
repetition; [Deploy Phase](<#deploy-phase>) states are excluded. The first
[Game State](<#game-state>) at the start of the
[Battle Phase](<#battle-phase>) counts as the first occurrence.

### BR-TERMINATION - Game Termination Rules

#### BR-TERMINATION-001 - Checkmate
If the [Active Player](<#active player>) is in [Check](<#check>) and has no
legal [Play](<#play>) available, the [Game](<#game>) ends with the loss of the
[Active Player](<#active player>).

#### BR-TERMINATION-002 - Stalemate
If the [Active Player](<#active player>) is in [Stalemate](<#stalemate>), the
[Game](<#game>) ends with the loss of the [Active Player](<#active player>).

#### BR-TERMINATION-003 - Insufficient Material Draw
If both [Players](<#player>) have only their [Marshal](<#marshal>) on the
[Board](<#board>) (no other [Pieces](<#piece>) belonging to either
[Player](<#player>)) and no [Pieces](<#piece>) in either
[Hand](<#hand>), the [Game](<#game>) ends in a draw --- no
[Player](<#player>) can ever deliver [Checkmate](<#checkmate>).
