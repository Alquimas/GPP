# GPP -- Gungi Playable Prototype

A naive, simple, and easy-to-test oracle for Gungi, the fictional board game
from the Hunter x Hunter series.

This project implements the full game logic (deploy phase, battle phase, movement, stacking, capture, turncoat, Arata,
check, checkmate, stalemate, exposure, repetition, and insufficient material) as a deterministic TypeScript engine
with no UI dependencies. A browser-based client is included for human play.

## Team

This project was carried out to fulfill the requirements for the course "Advanced Topics in Computer Science XI" in the Computer Science undergraduate program at UFPB. The objective of this project was to develop an entire application using agent-based programming in order to produce an experience report.

The team was formed by:

- Michel Diniz Medeiros - [Github](https://github.com/Alquimas/)
- Paloma Duarte de Lira - [Github](https://github.com/PalomaDuarte07)

## Rules

The rules were taken from
[https://planetbanatt.net/docs/gungi_rulebook_jp.pdf](https://planetbanatt.net/docs/gungi_rulebook_jp.pdf)
but have been changed in some aspects to better fit this project. Notable differences from the source rulebook
are documented alongside each business rule in the source tree.

## Project Structure

```
.
  oracle/           Game engine -- all rule logic, types, serialization
    src/            Source modules (22 files)
    tests/          Test suites (18 files, 789 tests)
    script/         CLI utilities (GSFEN validation, move enumeration)
    Dockerfile      Build and test container
  client/           Browser-based play UI
    server.ts       Dev HTTP server (serves static files + game API)
    js/app.js       UI logic
    js/api.js       Server communication layer
    index.html      Entry point
    css/style.css   Lishogi-inspired styling
  gsfen/            GSFEN fixture files (20)
  visualizers/      Standalone HTML tools (move validator, GSFEN viewer)
  assets/           Game piece icons
```

## Game Notation Formats

- **GSFEN** -- Gungi Stacking Forsyth-Edwards Notation. A single-string representation of any game state
  (position, turn, hands, turn counter). Used for serialization, test fixtures, and CLI debugging.
- **GAN** -- Gungi Action Notation. A compact string format for individual actions
  (placements, moves, Arata, Done declarations).

Both formats are fully specified in `GSFEN.md` and `GAN.md` respectively, with formal grammar rules,
canonicity constraints, and semantic validity rules.

## API

The oracle exposes a deterministic game engine with the following core modules:

| Module | Description |
|--------|-------------|
| `src/types.ts` | Core types: GameState, Action, PieceType, Player, Stack, etc. |
| `src/board/board.ts` | Board data structure and stack manipulation |
| `src/board/movement.ts` | Movement rule engine for all 14 piece types |
| `src/board/attack.ts` | Attack detection, check, and exposure evaluation |
| `src/game/game.ts` | Top-level game state machine |
| `src/game/deploy.ts` | Deploy phase placement validation and execution |
| `src/game/battle.ts` | Battle phase move/action validation and execution |
| `src/game/terminal.ts` | Terminal condition detection (checkmate, stalemate, etc.) |
| `src/game/engine.ts` | Pure function game loop (apply action, check terminal) |
| `src/gan/parse.ts` | GAN string parser |
| `src/gan/serialize.ts` | GAN string serializer |
| `src/gsfen/parse.ts` | GSFEN string parser |
| `src/gsfen/serialize.ts` | GSFEN string serializer |
| `src/gsfen/validate.ts` | GSFEN state validation |

### Key Design Principles

- **Stateless by default.** Game logic is organized as pure functions over `GameState` values.
  The engine module applies actions and returns new states without mutation.
- **Every move is enumerable.** `getLegalActions(state)` returns the complete list of legal
  moves/placements from any position, making AI and test scenarios straightforward.
- **Serialization round-trips.** Both GSFEN and GAN formats are specified such that
  `parse(serialize(x)) === x` and `serialize(parse(s)) === s` for all valid inputs.
- **Fuzz-tested.** Property-based tests verify invariants across thousands of random game states.

## Running the Client

```bash
# Start the dev server
cd oracle && npx tsx ../client/server.ts

# Open http://localhost:3030 in a browser
```

The client server serves the static UI files from `client/` and exposes a simple HTTP API
for game creation, action submission, and state retrieval.

### Controls

- Click a piece in your hand to select it for deployment (Deploy phase).
- Click a square in your deploy zone to place the selected piece.
- Click your own piece on the board to select it for movement (Battle phase).
- Click a legal destination to confirm the action.
- Use the navigation controls to step through move history.

## Running Tests

```bash
cd oracle

# All tests
npx vitest run

# Single suite
npx vitest run tests/game/battle.test.ts

# Watch mode
npx vitest
```

## Project Statistics

| Metric | Value |
|--------|-------|
| Source modules | 22 |
| Test files | 18 |
| Tests | 789 |
| GSFEN fixture files | 20 |
| Client files | 6 |
| Source lines of TypeScript | ~16,000 |
| Business rules covered | 50+ |
| Property-based test runs | 1,000+ |

## Game Pieces

14 piece types per side, distinguished by letter codes:

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


Pieces gain extended ranges at stack sizes 2-3 (per BR-MOVEMENT-005).

## Disclaimer

We do not claim ownership of the Gungi concept or the Hunter x Hunter intellectual property.
This project is created out of appreciation for Hunter x Hunter and a desire to bring the
fictional game of Gungi to life as a playable experience. All rights to Hunter x Hunter,
including the concept of Gungi, its characters, and related intellectual property, belong to
their respective owners. The name "Gungi" and the game concept originate from the Hunter x
Hunter series. We are not affiliated with, endorsed by, or connected to any of the rights
holders of the Hunter x Hunter intellectual property.
