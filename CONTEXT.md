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
Any interaction a Player can have with the Game. Either a Placement, a Play, or a Resignation.

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
