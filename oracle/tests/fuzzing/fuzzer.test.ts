import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '../../fuzzing/logger.js';
import {
  uniformStrategy,
  avoidStackStrategy,
  avoidArataStrategy,
} from '../../fuzzing/strategies.js';
import { playGame, mulberry32 } from '../../fuzzing/runner.js';
import type { Action, BoardCoord, GameState } from '../../src/types.js';
import type { FuzzerConfig, RunResult } from '../../fuzzing/types.js';

const logPaths: string[] = [];
const nullState = null as unknown as GameState;

afterEach(() => {
  for (const p of logPaths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      // ignore
    }
  }
  logPaths.length = 0;
});

function tmpLogPath(name: string): string {
  const p = resolve('/tmp', name);
  logPaths.push(p);
  return p;
}

function c(n: number): BoardCoord {
  return n as BoardCoord;
}

function makeAction(overrides: Partial<Action & { kind: 'move' }> = {}): Action {
  const base = {
    kind: 'move' as const,
    origin: { col: c(5), row: c(5) },
    dest: { col: c(5), row: c(4) },
    outcome: null as 'stack' | 'capture' | null,
    turncoat: [] as [] | [1] | [2] | [1, 2],
  };
  return { ...base, ...overrides } as Action;
}

describe('Strategies', () => {
  it('uniform picks from non-empty list', () => {
    const actions = [makeAction(), makeAction({ outcome: 'capture' })];
    const rng = mulberry32(42);
    const result = uniformStrategy(actions, nullState, rng);
    expect(result).not.toBeNull();
    expect(actions).toContain(result);
  });

  it('uniform returns null for empty list', () => {
    const rng = mulberry32(42);
    expect(uniformStrategy([], nullState, rng)).toBeNull();
  });

  it('avoid-stack filters stack moves when alternatives exist', () => {
    const stackAction = makeAction({ outcome: 'stack' });
    const captureAction = makeAction({ outcome: 'capture' });
    const actions = [stackAction, captureAction];
    const rng = mulberry32(42);
    const result = avoidStackStrategy(actions, nullState, rng);
    expect(result).not.toBe(stackAction);
  });

  it('avoid-stack falls back to stack when no alternatives', () => {
    const actions = [makeAction({ outcome: 'stack' })];
    const rng = mulberry32(42);
    const result = avoidStackStrategy(actions, nullState, rng);
    expect(result).toBe(actions[0]);
  });

  it('avoid-arata filters arata when alternatives exist', () => {
    const arataAction: Action = {
      kind: 'arata',
      piece: 'P',
      dest: { col: c(5), row: c(5) },
      turncoat: [],
    };
    const moveAction = makeAction();
    const actions = [arataAction, moveAction];
    const rng = mulberry32(42);
    const result = avoidArataStrategy(actions, nullState, rng);
    expect(result).not.toBe(arataAction);
  });
});

describe('Logger', () => {
  it('creates a valid log file', () => {
    const logPath = tmpLogPath('test-logger-ok.log');
    const logger = new Logger(logPath);

    logger.append({ gsfen: 'startpos', action: 'P5-5!' });
    logger.append({ gsfen: 'startpos', action: 'M8-8' });

    const result: RunResult = {
      seed: 42,
      strategy: 'uniform',
      totalMoves: 2,
      result: 'ongoing',
      duration: 100,
      errors: 0,
      crashes: 0,
    };
    logger.summary(result);
    logger.close();

    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('startpos | P5-5!');
    expect(content).toContain('startpos | M8-8');
    expect(content).toContain('Game Summary');
    expect(content).toContain('Seed:         42');
  });

  it('handles error lines correctly', () => {
    const logPath = tmpLogPath('test-logger-error.log');
    const logger = new Logger(logPath);

    logger.appendLine('startpos | M5-9 | error:BR-MOVE-005');
    logger.close();

    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('startpos | M5-9 | error:BR-MOVE-005');
  });
});

describe('Runner integration', () => {
  it('completes a full deploy+battle game from startpos', () => {
    const logPath = tmpLogPath('test-runner-full.log');
    const logger = new Logger(logPath);
    const rng = mulberry32(42);

    const config: FuzzerConfig = {
      gsfen: 'startpos',
      seed: 42,
      games: 1,
      logDir: '/tmp',
      strategy: 'uniform',
      moveTimeoutMs: 30000,
      gameTimeoutMs: 500000,
      verbose: false,
      noCapture: false,
      stopOnError: false,
      strategyConfig: {
        avoidStack: false,
        avoidArata: false,
        captureWeight: 1,
        arataWeight: 1,
        moveWeight: 1,
        placementWeight: 1,
      },
    };

    const result = playGame(config, 0, logger, rng);
    logger.close();

    expect(result.totalMoves).toBeGreaterThan(0);
    expect(existsSync(logPath)).toBe(true);

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');

    const actionLines = lines.filter(
      (l) => l.includes(' | ') && !l.includes('Game Summary') && !l.includes('═'),
    );
    expect(actionLines.length).toBeGreaterThan(0);

    const lastActionLine = actionLines[actionLines.length - 1];
    expect(lastActionLine).toMatch(/terminal:/);
  });
});
