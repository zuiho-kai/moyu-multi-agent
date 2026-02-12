/**
 * Codex Agent 服务
 * 基于 CLI 子进程模式调用 Codex (缅因猫)
 */

import { spawnCli, CliEvent } from '../utils/cli-spawn.js';
import type { AgentConfig, AgentMessage, AgentType } from '../core/types.js';

export class CodexAgentService {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      id: config.id || `codex-${Date.now()}`,
      type: 'codex' as AgentType,
      name: config.name || '缅因猫',
      workdir: config.workdir,
      timeout: config.timeout || 300000,
    };
  }

  async *invoke(prompt: string, options?: { workdir?: string }): AsyncGenerator<AgentMessage> {
    const args: string[] = ['exec', prompt, '--json'];

    const cwd = options?.workdir || this.config.workdir;

    const events = spawnCli({
      command: 'codex',
      args,
      cwd,
      timeout: this.config.timeout,
    });

    for await (const event of events) {
      const result = this.transformEvent(event);
      if (result) yield result;
    }

    yield {
      type: 'done',
      agentId: this.config.id,
      agentType: 'codex',
      timestamp: Date.now(),
    };
  }

  private transformEvent(event: CliEvent): AgentMessage | null {
    const data = event.data as Record<string, unknown>;

    switch (event.type) {
      case 'thread.started':
        return {
          type: 'session_init',
          agentId: this.config.id,
          agentType: 'codex',
          sessionId: data.thread_id as string,
          timestamp: Date.now(),
        };

      case 'item.completed':
        const item = data.item as { type?: string; text?: string };
        if (item?.type === 'agent_message' && item.text) {
          return {
            type: 'text',
            agentId: this.config.id,
            agentType: 'codex',
            content: item.text,
            timestamp: Date.now(),
          };
        }
        break;

      case 'error':
        return {
          type: 'error',
          agentId: this.config.id,
          agentType: 'codex',
          content: typeof data === 'string' ? data : JSON.stringify(data),
          timestamp: Date.now(),
        };
    }

    return null;
  }

  get id(): string {
    return this.config.id;
  }

  get type(): AgentType {
    return this.config.type;
  }
}
