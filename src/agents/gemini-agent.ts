/**
 * Gemini Agent 服务
 * 双 Adapter 模式：gemini-cli (headless) / antigravity (IDE)
 */

import { spawnCli, CliEvent } from '../utils/cli-spawn.js';
import type { AgentConfig, AgentMessage, AgentType } from '../core/types.js';

type GeminiAdapter = 'gemini-cli' | 'antigravity';

export class GeminiAgentService {
  private config: AgentConfig;
  private adapter: GeminiAdapter;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      id: config.id || `gemini-${Date.now()}`,
      type: 'gemini' as AgentType,
      name: config.name || '暹罗猫',
      workdir: config.workdir,
      timeout: config.timeout || 300000,
    };
    this.adapter = (process.env.GEMINI_ADAPTER as GeminiAdapter) || 'gemini-cli';
  }

  async *invoke(prompt: string, options?: { workdir?: string }): AsyncGenerator<AgentMessage> {
    if (this.adapter === 'antigravity') {
      yield* this.invokeAntigravity(prompt, options);
    } else {
      yield* this.invokeGeminiCli(prompt, options);
    }
  }

  private async *invokeGeminiCli(prompt: string, options?: { workdir?: string }): AsyncGenerator<AgentMessage> {
    const args: string[] = ['chat', prompt];
    const cwd = options?.workdir || this.config.workdir;

    const events = spawnCli({
      command: 'gemini',
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
      agentType: 'gemini',
      timestamp: Date.now(),
    };
  }

  private async *invokeAntigravity(prompt: string, _options?: { workdir?: string }): AsyncGenerator<AgentMessage> {
    // Antigravity 是 GUI 程序，通过 MCP callback 回传消息
    // 这里只是启动，实际消息通过 MCP 服务器接收
    yield {
      type: 'session_init',
      agentId: this.config.id,
      agentType: 'gemini',
      content: `Antigravity mode: waiting for MCP callback. Prompt: ${prompt}`,
      timestamp: Date.now(),
    };

    // TODO: 实现 MCP callback 监听
    yield {
      type: 'done',
      agentId: this.config.id,
      agentType: 'gemini',
      timestamp: Date.now(),
    };
  }

  private transformEvent(event: CliEvent): AgentMessage | null {
    const data = event.data as Record<string, unknown>;

    if (event.type === 'raw' && typeof data === 'string') {
      return {
        type: 'text',
        agentId: this.config.id,
        agentType: 'gemini',
        content: data,
        timestamp: Date.now(),
      };
    }

    if (event.type === 'error') {
      return {
        type: 'error',
        agentId: this.config.id,
        agentType: 'gemini',
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
