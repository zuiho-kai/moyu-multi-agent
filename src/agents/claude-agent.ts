/**
 * Claude Agent 服务
 * 基于 CLI 子进程模式调用 Claude
 */

import { spawnCli, CliEvent } from '../utils/cli-spawn.js';
import type { AgentConfig, AgentMessage, AgentType } from '../core/types.js';

const CAT_ID = 'claude';
const ALLOWED_TOOLS = 'Read,Edit,Glob,Grep,Bash';
const PERMISSION_MODE = 'acceptEdits';

export interface AgentServiceOptions {
  sessionId?: string;
  workdir?: string;
}

export class ClaudeAgentService {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      id: config.id || `claude-${Date.now()}`,
      type: 'claude' as AgentType,
      name: config.name || '布偶猫',
      model: config.model || 'claude-sonnet-4-5-20250929',
      workdir: config.workdir,
      allowedTools: config.allowedTools || ALLOWED_TOOLS.split(','),
      permissionMode: config.permissionMode || 'acceptEdits',
      timeout: config.timeout || 300000,
    };
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncGenerator<AgentMessage> {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--model', this.config.model!,
      '--allowedTools', this.config.allowedTools!.join(','),
      '--permission-mode', this.config.permissionMode!,
    ];

    if (options?.sessionId) {
      args.push('--resume', options.sessionId);
    }

    const cwd = options?.workdir || this.config.workdir;

    const events = spawnCli({
      command: 'claude',
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
      agentType: 'claude',
      timestamp: Date.now(),
    };
  }

  private transformEvent(event: CliEvent): AgentMessage | null {
    const data = event.data as Record<string, unknown>;

    switch (event.type) {
      case 'system':
        if (data.subtype === 'init') {
          return {
            type: 'session_init',
            agentId: this.config.id,
            agentType: 'claude',
            sessionId: data.session_id as string,
            timestamp: Date.now(),
          };
        }
        break;

      case 'assistant':
        const message = data.message as { content?: Array<{ type: string; text?: string }> };
        const textContent = message?.content?.find(c => c.type === 'text');
        if (textContent?.text) {
          return {
            type: 'text',
            agentId: this.config.id,
            agentType: 'claude',
            content: textContent.text,
            timestamp: Date.now(),
          };
        }
        break;

      case 'tool_use':
        return {
          type: 'tool_use',
          agentId: this.config.id,
          agentType: 'claude',
          toolName: data.name as string,
          toolInput: data.input,
          timestamp: Date.now(),
        };

      case 'tool_result':
        return {
          type: 'tool_result',
          agentId: this.config.id,
          agentType: 'claude',
          toolOutput: data.output,
          timestamp: Date.now(),
        };

      case 'error':
        return {
          type: 'error',
          agentId: this.config.id,
          agentType: 'claude',
          content: typeof data === 'string' ? data : JSON.stringify(data),
          timestamp: Date.now(),
        };

      case 'exit':
        break;
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
