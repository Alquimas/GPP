import { Game } from '../src/game/game.js';
import { serializeGAN } from '../src/gan/serialize.js';
import type { Action } from '../src/types.js';
import { Logger } from './logger.js';
import { getStrategy } from './strategies.js';
import type { FuzzerConfig, RunResult } from './types.js';

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playGame(
  config: FuzzerConfig,
  gameIndex: number,
  logger: Logger,
  rng: () => number,
): RunResult {
  const game = new Game(config.gsfen);
  const strategy = getStrategy(config.strategy, config.strategyConfig);

  let totalMoves = 0;
  let errors = 0;
  let crashes = 0;
  let lastKnownGsfen = game.toGsfen();

  const startTime = Date.now();
  const gameDeadline = startTime + config.gameTimeoutMs;

  let resultStr = 'ongoing';

  while (Date.now() < gameDeadline) {
    if (game.result.kind !== 'ongoing') {
      resultStr = `terminal:${game.result.kind}`;
      if (game.result.kind === 'checkmate' || game.result.kind === 'stalemate') {
        resultStr += `:${game.result.loser}`;
      }
      logger.appendLine(`${lastKnownGsfen} | ${resultStr}`);
      break;
    }

    const moveDeadline = Date.now() + config.moveTimeoutMs;

    let actions: Action[];
    try {
      actions = game.legalActions;
    } catch (e) {
      const msg = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
      const stack = e instanceof Error ? (e.stack ?? '') : '';
      logger.appendLine(`${lastKnownGsfen} | crash:legalActions`);
      logger.appendLine(`CRASH: ${msg}`);
      logger.appendLine(`STACK: ${stack}`);
      crashes++;
      resultStr = 'crash:legalActions';
      break;
    }

    if (Date.now() > moveDeadline) {
      logger.appendLine(`${lastKnownGsfen} | TIMEOUT`);
      resultStr = 'crash:move-timeout';
      break;
    }

    if (actions.length === 0) {
      if (game.result.kind === 'ongoing') {
        logger.appendLine(`${lastKnownGsfen} | crash:no-legal-actions-but-ongoing`);
        crashes++;
        resultStr = 'crash:no-legal-actions-but-ongoing';
      }
      break;
    }

    const action = strategy(actions, game.state, rng);
    if (action === null) {
      resultStr = 'no-legal-action-selected';
      break;
    }

    const ganAction = serializeGAN(action);
    const startingGsfen = game.toGsfen();

    if (config.verbose) {
      console.log(`${startingGsfen} | ${ganAction}`);
    }

    let applyResult;
    try {
      applyResult = game.applyAction(action);
    } catch (e) {
      const msg = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
      const stack = e instanceof Error ? (e.stack ?? '') : '';
      logger.appendLine(`${startingGsfen} | crash:applyAction`);
      logger.appendLine(`CRASH: ${msg}`);
      logger.appendLine(`STACK: ${stack}`);
      crashes++;
      resultStr = 'crash:applyAction';
      break;
    }

    if (!applyResult.ok) {
      logger.appendLine(
        `${startingGsfen} | ${ganAction} | error:${applyResult.error.rule}:${applyResult.error.message}`,
      );
      errors++;
      continue;
    }

    const resultingGsfen = game.toGsfen();
    lastKnownGsfen = resultingGsfen;

    if (applyResult.result.kind !== 'ongoing') {
      resultStr = `terminal:${applyResult.result.kind}`;
      if (applyResult.result.kind === 'checkmate' || applyResult.result.kind === 'stalemate') {
        resultStr += `:${applyResult.result.loser}`;
      }

      logger.append({ gsfen: startingGsfen, action: ganAction });
      logger.appendLine(`${resultingGsfen} | ${resultStr}`);
      totalMoves++;
      break;
    }

    logger.append({ gsfen: startingGsfen, action: ganAction });
    totalMoves++;
  }

  if (Date.now() >= gameDeadline && game.result.kind === 'ongoing') {
    resultStr = 'crash:game-timeout';
    logger.appendLine(`${lastKnownGsfen} | TIMEOUT`);
  }

  const duration = Date.now() - startTime;
  const runResult: RunResult = {
    seed: config.seed,
    strategy: config.strategy,
    totalMoves,
    result: resultStr,
    duration,
    errors,
    crashes,
  };

  logger.summary(runResult);

  if (config.verbose) {
    console.log(
      `Game ${gameIndex}: ${totalMoves} moves, result: ${resultStr}, duration: ${duration}ms`,
    );
  }

  return runResult;
}
