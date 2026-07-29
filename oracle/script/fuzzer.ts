#!/usr/bin/env node

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Game } from '../src/game/game.js';
import { Logger } from '../fuzzing/logger.js';
import { mulberry32, playGame } from '../fuzzing/runner.js';
import type { FuzzerConfig, RunResult, StrategyName } from '../fuzzing/types.js';

const VALID_STRATEGIES: StrategyName[] = [
  'uniform',
  'avoid-stack',
  'avoid-arata',
  'avoid-stack-and-arata',
  'favor-capture',
  'favor-arata',
  'only-moves',
  'only-placements',
  'cycle-through',
  'custom',
];

function parseArgs(): Partial<FuzzerConfig> & { strategyConfig: FuzzerConfig['strategyConfig'] } {
  const args = process.argv.slice(2);
  const config: any = {
    strategyConfig: {
      avoidStack: false,
      avoidArata: false,
      captureWeight: 1,
      arataWeight: 1,
      moveWeight: 1,
      placementWeight: 1,
    },
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--gsfen':
        config.gsfen = args[++i];
        break;
      case '--gsfen-file':
        config.gsfenFile = args[++i];
        break;
      case '--seed':
        config.seed = parseInt(args[++i], 10);
        break;
      case '--games':
        config.games = parseInt(args[++i], 10);
        break;
      case '--log-dir':
        config.logDir = args[++i];
        break;
      case '--strategy':
        config.strategy = args[++i];
        if (!VALID_STRATEGIES.includes(config.strategy)) {
          process.stderr.write(`Invalid strategy: ${config.strategy}. Valid: ${VALID_STRATEGIES.join(', ')}\n`);
          process.exit(1);
        }
        break;
      case '--move-timeout':
        config.moveTimeoutMs = parseInt(args[++i], 10);
        break;
      case '--game-timeout':
        config.gameTimeoutMs = parseInt(args[++i], 10);
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--no-capture':
        config.noCapture = true;
        break;
      case '--stop-on-error':
        config.stopOnError = true;
        break;
      case '--avoid-stack':
        config.strategyConfig.avoidStack = true;
        break;
      case '--avoid-arata':
        config.strategyConfig.avoidArata = true;
        break;
      case '--capture-weight':
        config.strategyConfig.captureWeight = parseInt(args[++i], 10);
        break;
      case '--arata-weight':
        config.strategyConfig.arataWeight = parseInt(args[++i], 10);
        break;
      case '--move-weight':
        config.strategyConfig.moveWeight = parseInt(args[++i], 10);
        break;
      case '--placement-weight':
        config.strategyConfig.placementWeight = parseInt(args[++i], 10);
        break;
      default:
        process.stderr.write(`Unknown flag: ${arg}\n`);
        process.exit(1);
    }
  }

  return config;
}

function getGsfen(config: { gsfen?: string; gsfenFile?: string }): string {
  if (config.gsfenFile) {
    const filePath = resolve(config.gsfenFile);
    return readFileSync(filePath, 'utf-8').trim();
  }
  return config.gsfen ?? 'startpos';
}

function timestamp(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function main(): void {
  const partial = parseArgs();
  const gsfenInput = getGsfen(partial);

  const config: FuzzerConfig = {
    gsfen: gsfenInput,
    seed: partial.seed ?? Math.floor(Math.random() * 2147483647),
    games: partial.games ?? 1,
    logDir: partial.logDir ?? './fuzzing-logs/',
    strategy: partial.strategy ?? 'uniform',
    moveTimeoutMs: partial.moveTimeoutMs ?? 30000,
    gameTimeoutMs: partial.gameTimeoutMs ?? 500000,
    verbose: partial.verbose ?? false,
    noCapture: partial.noCapture ?? false,
    stopOnError: partial.stopOnError ?? false,
    strategyConfig: partial.strategyConfig,
  };

  if (config.games !== 0) {
    if (partial.gsfenFile) {
      config.gsfen = gsfenInput;
    }
  }

  const logDir = resolve(config.logDir);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  let totalErrors = 0;
  let totalCrashes = 0;

  const rng = mulberry32(config.seed);
  const baseRng = rng;

  const gameCount = config.games === 0 ? Infinity : config.games;

  for (let i = 0; i < gameCount; i++) {
    const gameSeed = config.seed + i;
    const gameRng = mulberry32(gameSeed);
    const ts = timestamp();
    const logFileName = `fuzzer-${config.strategy}-${gameSeed}-${i}-${ts}.log`;
    const logFilePath = resolve(logDir, logFileName);
    const logger = new Logger(logFilePath);

    const gameConfig: FuzzerConfig = { ...config, seed: gameSeed, gsfen: i === 0 ? config.gsfen : 'startpos' };

    if (i > 0) {
      gameConfig.gsfen = 'startpos';
    }

    const result: RunResult = playGame(gameConfig, i, logger, gameRng);

    logger.close();

    totalErrors += result.errors;
    totalCrashes += result.crashes;

    if (config.stopOnError && (result.errors > 0 || result.crashes > 0)) {
      process.stderr.write(`Stopping on error after game ${i}\n`);
      break;
    }
  }

  if (totalErrors > 0 || totalCrashes > 0) {
    process.stderr.write(`Fuzzer complete: ${totalErrors} errors, ${totalCrashes} crashes across all games\n`);
  }
}

main();
