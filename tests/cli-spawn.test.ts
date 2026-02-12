/**
 * CLI Spawn 工具单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliSpawner, spawnCli } from '../src/utils/cli-spawn.js';

describe('CliSpawner', () => {
  let spawner: CliSpawner;

  beforeEach(() => {
    spawner = new CliSpawner();
  });

  afterEach(() => {
    spawner.abort();
  });

  describe('spawn', () => {
    it('should spawn a simple command and yield events', async () => {
      const events: Array<{ type: string }> = [];

      for await (const event of spawner.spawn({
        command: process.platform === 'win32' ? 'cmd' : 'echo',
        args: process.platform === 'win32' ? ['/c', 'echo', 'hello'] : ['hello'],
        timeout: 5000,
      })) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'exit')).toBe(true);
    });

    it('should handle JSON output', async () => {
      const events: Array<{ type: string; data: unknown }> = [];
      const jsonStr = '{"type":"test","value":123}';

      for await (const event of spawner.spawn({
        command: process.platform === 'win32' ? 'cmd' : 'echo',
        args: process.platform === 'win32' ? ['/c', 'echo', jsonStr] : [jsonStr],
        timeout: 5000,
      })) {
        events.push(event);
      }

      const jsonEvent = events.find(e => e.type === 'test');
      expect(jsonEvent).toBeDefined();
      expect((jsonEvent?.data as { value: number })?.value).toBe(123);
    });

    it('should handle command errors', async () => {
      const events: Array<{ type: string }> = [];

      for await (const event of spawner.spawn({
        command: 'nonexistent-command-12345',
        args: [],
        timeout: 5000,
      })) {
        events.push(event);
      }

      expect(events.some(e => e.type === 'error' || e.type === 'exit')).toBe(true);
    });
  });

  describe('abort', () => {
    it('should emit abort event', () => {
      let aborted = false;
      spawner.on('abort', () => {
        aborted = true;
      });

      spawner.abort('test abort');
      expect(aborted).toBe(true);
    });
  });
});

describe('spawnCli helper', () => {
  it('should work as a generator function', async () => {
    const events: Array<{ type: string }> = [];

    for await (const event of spawnCli({
      command: process.platform === 'win32' ? 'cmd' : 'echo',
      args: process.platform === 'win32' ? ['/c', 'echo', 'test'] : ['test'],
      timeout: 5000,
    })) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
  });
});
