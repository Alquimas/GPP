import { closeSync, openSync, writeSync } from 'node:fs';
import type { LogEntry, RunResult } from './types.js';

export class Logger {
  #fd: number;
  #closed: boolean = false;

  constructor(filePath: string) {
    this.#fd = openSync(filePath, 'w');
  }

  append(entry: LogEntry): void {
    if (this.#closed) return;
    writeSync(this.#fd, `${entry.gsfen} | ${entry.action}\n`);
  }

  appendLine(text: string): void {
    if (this.#closed) return;
    writeSync(this.#fd, `${text}\n`);
  }

  summary(result: RunResult): void {
    if (this.#closed) return;

    const lines = [
      '═══════════════════════════════════',
      'Game Summary',
      `  Seed:         ${result.seed}`,
      `  Strategy:     ${result.strategy}`,
      `  Total moves:  ${result.totalMoves}`,
      `  Result:       ${result.result}`,
      `  Duration:     ${result.duration}ms`,
      `  Errors:       ${result.errors}`,
      `  Crashes:      ${result.crashes}`,
      '═══════════════════════════════════',
      '',
    ];

    writeSync(this.#fd, lines.join('\n'));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    closeSync(this.#fd);
  }
}
