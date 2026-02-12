/**
 * CLI 子进程调用工具
 * 基于 cat-cafe-tutorials 的 CLI 子进程模式设计
 * 支持 Claude/Codex/Gemini CLI 调用，NDJSON 流解析
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface CliSpawnOptions {
  command: string;
  args: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface CliEvent {
  type: string;
  data: unknown;
  raw: string;
}

export class CliSpawner extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private timeoutId: NodeJS.Timeout | null = null;
  private aborted = false;

  async *spawn(options: CliSpawnOptions): AsyncGenerator<CliEvent> {
    const { command, args, cwd, timeout = 300000, env } = options;

    this.process = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    if (timeout > 0) {
      this.timeoutId = setTimeout(() => {
        this.abort('Timeout exceeded');
      }, timeout);
    }

    const eventQueue: CliEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            const event: CliEvent = {
              type: parsed.type || 'unknown',
              data: parsed,
              raw: line,
            };
            eventQueue.push(event);
            resolveNext?.();
          } catch {
            eventQueue.push({ type: 'raw', data: line, raw: line });
            resolveNext?.();
          }
        }
      }
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      eventQueue.push({ type: 'stderr', data: text, raw: text });
      resolveNext?.();
    });

    this.process.on('close', (code) => {
      done = true;
      if (this.buffer.trim()) {
        try {
          const parsed = JSON.parse(this.buffer);
          eventQueue.push({ type: parsed.type || 'final', data: parsed, raw: this.buffer });
        } catch {
          eventQueue.push({ type: 'raw', data: this.buffer, raw: this.buffer });
        }
      }
      eventQueue.push({ type: 'exit', data: { code }, raw: `exit:${code}` });
      resolveNext?.();
      this.cleanup();
    });

    this.process.on('error', (err) => {
      done = true;
      eventQueue.push({ type: 'error', data: err.message, raw: err.message });
      resolveNext?.();
      this.cleanup();
    });

    while (!done || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else if (!done) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
        resolveNext = null;
      }
    }
  }

  abort(reason?: string): void {
    if (this.aborted) return;
    this.aborted = true;
    this.process?.kill('SIGTERM');
    setTimeout(() => {
      this.process?.kill('SIGKILL');
    }, 5000);
    this.emit('abort', reason);
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  get pid(): number | undefined {
    return this.process?.pid;
  }
}

export async function* spawnCli(options: CliSpawnOptions): AsyncGenerator<CliEvent> {
  const spawner = new CliSpawner();
  yield* spawner.spawn(options);
}
