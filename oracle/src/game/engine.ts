import type { Action, GameResult, GameState, GlobalState } from '../types.js';
import { GameError } from '../errors.js';
import { validatePlacement, validateDone } from './deploy.js';
import { validatePlay } from './battle.js';
import { applyPlacement, applyDone } from './apply.js';
import { evaluateExposure, checkTerminal } from './terminal.js';
import { placementCandidates, playCandidates } from './candidates.js';

export type StepResult =
  { ok: true; state: GlobalState } | { ok: false; state: GlobalState; error: GameError };

function beginBattle(state: GameState): GameState {
  return {
    ...state,
    turn: {
      phase: 'battle',
      activePlayer: 'white',
      done: null,
      counter: 1,
    },
  };
}

function withCurrent(
  global: GlobalState,
  current: GameState,
  result: GameResult = global.result,
): GlobalState {
  return { current, history: global.history, result };
}

/** Validate and apply one Action without mutating the supplied runtime state. */
export function step(global: GlobalState, action: Action): StepResult {
  if (global.result.kind !== 'ongoing') {
    return {
      ok: false,
      state: global,
      error: new GameError('No actions are accepted after the game ends', 'BR-GAME-003'),
    };
  }

  if (global.current.turn.phase === 'deploy') {
    // Deploy-Phase actions: Placement or standalone Done.
    const validation =
      action.kind === 'done'
        ? validateDone(global.current)
        : validatePlacement(global.current, action);
    if (!validation.ok) return { ok: false, state: global, error: validation.error };

    const applied =
      action.kind === 'done'
        ? applyDone(global.current)
        : applyPlacement(global.current, action as Extract<Action, { kind: 'placement' }>);
    if (!applied.deployEnded) {
      return { ok: true, state: withCurrent(global, applied.state) };
    }

    const exposure = evaluateExposure(applied.state.position);
    if (exposure.kind !== 'ongoing') {
      return { ok: true, state: withCurrent(global, applied.state, exposure) };
    }

    return { ok: true, state: withCurrent(global, beginBattle(applied.state)) };
  }

  const validation = validatePlay(global.current, action);
  if (!validation.ok) return { ok: false, state: global, error: validation.error };

  const history = [...global.history, global.current];
  const current = validation.speculativeState;
  const result = checkTerminal(current, history);
  return { ok: true, state: { current, history, result } };
}

/** Enumerate every legal Action using the same validators as step(). */
export function legalActions(global: GlobalState): Action[] {
  if (global.result.kind !== 'ongoing') return [];

  if (global.current.turn.phase === 'deploy') {
    const placements = placementCandidates(global.current).filter(
      (action) => validatePlacement(global.current, action).ok,
    );
    // Standalone Done is legal once the active player's Marshal is deployed.
    if (validateDone(global.current).ok) {
      return [...placements, { kind: 'done' }];
    }
    return placements;
  }

  return playCandidates(global.current).filter((action) => validatePlay(global.current, action).ok);
}
