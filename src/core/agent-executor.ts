/**
 * Agent 执行器
 * 真正调用 CLI 让 Agent 干活，而不是只聊天
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface AgentExecutorConfig {
  agentType: 'claude' | 'codex' | 'gemini';
  model?: string;
  workdir: string;
  apiKey?: string;
  apiBase?: string;
  timeout?: number;
}

export interface ExecutionResult {
  id: string;
  agentType: string;
  prompt: string;
  response: string;
  toolCalls: ToolCall[];
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface ToolCall {
  name: string;
  input: unknown;
  output?: unknown;
  timestamp: number;
}

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
}

export class AgentExecutor extends EventEmitter {
  private config: AgentExecutorConfig;
  private process: ChildProcess | null = null;
  private currentExecution: ExecutionResult | null = null;

  constructor(config: AgentExecutorConfig) {
    super();
    this.config = {
      timeout: 300000, // 5 分钟默认超时
      ...config,
    };
  }

  /**
   * 执行 Agent 任务
   */
  async execute(prompt: string): Promise<ExecutionResult> {
    const executionId = uuidv4();

    this.currentExecution = {
      id: executionId,
      agentType: this.config.agentType,
      prompt,
      response: '',
      toolCalls: [],
      status: 'running',
      startTime: Date.now(),
    };

    this.emit('start', this.currentExecution);

    try {
      const result = await this.runCli(prompt);
      this.currentExecution.response = result;
      this.currentExecution.status = 'completed';
      this.currentExecution.endTime = Date.now();
    } catch (error) {
      this.currentExecution.status = 'failed';
      this.currentExecution.error = error instanceof Error ? error.message : String(error);
      this.currentExecution.endTime = Date.now();
    }

    this.emit('complete', this.currentExecution);
    return this.currentExecution;
  }

  /**
   * 流式执行，实时返回结果
   */
  async *executeStream(prompt: string): AsyncGenerator<StreamEvent> {
    const executionId = uuidv4();

    this.currentExecution = {
      id: executionId,
      agentType: this.config.agentType,
      prompt,
      response: '',
      toolCalls: [],
      status: 'running',
      startTime: Date.now(),
    };

    this.emit('start', this.currentExecution);

    const { command, args, env } = this.buildCommand(prompt);

    this.process = spawn(command, args, {
      cwd: this.config.workdir,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });

    let buffer = '';
    let timeoutId: NodeJS.Timeout | null = null;

    if (this.config.timeout) {
      timeoutId = setTimeout(() => {
        this.abort('Execution timeout');
      }, this.config.timeout);
    }

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    // 使用 Promise + 事件队列模式处理异步流
    const eventQueue: StreamEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;
    let stderrBuffer = '';

    // 处理 stdout
    this.process.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          const streamEvent = this.parseEvent(event);
          if (streamEvent) {
            eventQueue.push(streamEvent);

            if (streamEvent.type === 'text' && streamEvent.content) {
              this.currentExecution!.response += streamEvent.content;
            }

            if (streamEvent.type === 'tool_use') {
              this.currentExecution!.toolCalls.push({
                name: streamEvent.toolName || 'unknown',
                input: streamEvent.toolInput,
                timestamp: Date.now(),
              });
            }
          }
        } catch {
          // 非 JSON 行，作为普通文本处理
          eventQueue.push({ type: 'text', content: line });
          this.currentExecution!.response += line + '\n';
        }
        resolveNext?.();
      }
    });

    // 处理 stderr - 关键修复！
    this.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuffer += text;
      console.error('[AgentExecutor] stderr:', text);
    });

    // 处理进程关闭
    this.process.on('close', (code) => {
      done = true;

      // 处理剩余 buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          const streamEvent = this.parseEvent(event);
          if (streamEvent) {
            eventQueue.push(streamEvent);
          }
        } catch {
          eventQueue.push({ type: 'text', content: buffer });
          this.currentExecution!.response += buffer;
        }
      }

      // 如果有 stderr 输出且没有正常响应，作为错误处理
      if (stderrBuffer && !this.currentExecution!.response) {
        eventQueue.push({ type: 'error', content: stderrBuffer });
        this.currentExecution!.error = stderrBuffer;
        this.currentExecution!.status = 'failed';
      } else if (code !== 0 && !this.currentExecution!.response) {
        const errorMsg = stderrBuffer || `Process exited with code ${code}`;
        eventQueue.push({ type: 'error', content: errorMsg });
        this.currentExecution!.error = errorMsg;
        this.currentExecution!.status = 'failed';
      } else {
        this.currentExecution!.status = 'completed';
      }

      this.currentExecution!.endTime = Date.now();
      eventQueue.push({ type: 'done' });
      resolveNext?.();
    });

    // 处理进程错误（如命令不存在）
    this.process.on('error', (err) => {
      done = true;
      const errorMsg = `Failed to start process: ${err.message}`;
      console.error('[AgentExecutor] process error:', errorMsg);
      eventQueue.push({ type: 'error', content: errorMsg });
      this.currentExecution!.status = 'failed';
      this.currentExecution!.error = errorMsg;
      this.currentExecution!.endTime = Date.now();
      eventQueue.push({ type: 'done' });
      resolveNext?.();
    });

    try {
      // 使用事件队列模式 yield 事件
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

    } catch (error) {
      this.currentExecution!.status = 'failed';
      this.currentExecution!.error = error instanceof Error ? error.message : String(error);
      this.currentExecution!.endTime = Date.now();
      yield { type: 'error', content: this.currentExecution!.error };
    } finally {
      cleanup();
      this.emit('complete', this.currentExecution);
    }
  }

  /**
   * 构建 CLI 命令
   */
  private buildCommand(prompt: string): { command: string; args: string[]; env: Record<string, string> } {
    const env: Record<string, string> = {};

    switch (this.config.agentType) {
      case 'claude':
        // 设置 API 配置
        if (this.config.apiKey) {
          env.ANTHROPIC_API_KEY = this.config.apiKey;
        }
        if (this.config.apiBase) {
          env.ANTHROPIC_BASE_URL = this.config.apiBase;
        }

        return {
          command: 'claude',
          args: [
            '-p', prompt,
            '--output-format', 'stream-json',
            '--verbose',  // stream-json 需要 --verbose
            '--dangerously-skip-permissions',  // 允许执行操作
            ...(this.config.model ? ['--model', this.config.model] : []),
          ],
          env,
        };

      case 'codex':
        if (this.config.apiKey) {
          env.OPENAI_API_KEY = this.config.apiKey;
        }
        return {
          command: 'codex',
          args: ['exec', '--json', prompt],
          env,
        };

      case 'gemini':
        if (this.config.apiKey) {
          env.GOOGLE_API_KEY = this.config.apiKey;
        }
        return {
          command: 'gemini',
          args: ['chat', '--json', prompt],
          env,
        };

      default:
        throw new Error(`Unknown agent type: ${this.config.agentType}`);
    }
  }

  /**
   * 解析 CLI 事件
   */
  private parseEvent(event: Record<string, unknown>): StreamEvent | null {
    const type = event.type as string;

    switch (type) {
      case 'assistant': {
        const message = event.message as { content?: Array<{ type: string; text?: string }> };
        if (message?.content) {
          const textContent = message.content.find(c => c.type === 'text');
          if (textContent?.text) {
            return { type: 'text', content: textContent.text };
          }
        }
        break;
      }

      case 'result': {
        // 处理最终结果
        if (event.subtype === 'success' && event.result) {
          return { type: 'text', content: event.result as string };
        }
        return { type: 'done' };
      }

      case 'content_block_delta':
        const delta = event.delta as { type?: string; text?: string };
        if (delta?.type === 'text_delta' && delta.text) {
          return { type: 'text', content: delta.text };
        }
        break;

      case 'tool_use':
        return {
          type: 'tool_use',
          toolName: event.name as string,
          toolInput: event.input,
        };

      case 'tool_result':
        return {
          type: 'tool_result',
          toolOutput: event.output || event.content,
        };

      case 'error':
        return {
          type: 'error',
          content: typeof event.error === 'string' ? event.error : JSON.stringify(event.error),
        };
    }

    return null;
  }

  /**
   * 同步执行（等待完成）- 使用 spawn + stdin 传递 prompt
   */
  private runCli(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { command, args, env } = this.buildCommand(prompt);

      // 移除 -p prompt 参数，改用 stdin
      const argsWithoutPrompt = args.filter((arg, i) => {
        if (arg === '-p') return false;
        if (i > 0 && args[i - 1] === '-p') return false;
        return true;
      });

      console.log('[AgentExecutor] Running:', command, argsWithoutPrompt.join(' '));
      console.log('[AgentExecutor] Prompt length:', prompt.length);

      const proc = spawn(command, argsWithoutPrompt, {
        cwd: this.config.workdir,
        env: { ...process.env, ...env },
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // 设置超时
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
      }, this.config.timeout);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (stderr) {
          console.error('[AgentExecutor] stderr:', stderr.slice(0, 500));
        }

        if (timedOut) {
          // 超时但可能有输出
          if (stdout) {
            const result = this.parseCliOutput(stdout);
            if (result) {
              resolve(result);
              return;
            }
          }
          reject(new Error('Execution timeout'));
          return;
        }

        if (code !== 0 && !stdout) {
          reject(new Error(stderr || `Process exited with code ${code}`));
          return;
        }

        const result = this.parseCliOutput(stdout);
        resolve(result || '(无响应)');
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start process: ${err.message}`));
      });

      // 通过 stdin 传递 prompt
      proc.stdin?.write(prompt);
      proc.stdin?.end();
    });
  }

  /**
   * 解析 CLI 输出，提取最终结果
   */
  private parseCliOutput(output: string): string {
    const lines = output.trim().split('\n');
    let result = '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);

        // 优先从 result 事件获取
        if (event.type === 'result' && event.result) {
          return event.result;
        }

        // 从 assistant 消息获取
        if (event.type === 'assistant' && event.message?.content) {
          const textContent = event.message.content.find((c: { type: string; text?: string }) => c.type === 'text');
          if (textContent?.text) {
            result = textContent.text;
          }
        }
      } catch {
        // 非 JSON 行，忽略
      }
    }

    return result;
  }

  /**
   * 中止执行
   */
  abort(reason?: string): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        this.process?.kill('SIGKILL');
      }, 5000);
    }

    if (this.currentExecution) {
      this.currentExecution.status = 'failed';
      this.currentExecution.error = reason || 'Aborted';
      this.currentExecution.endTime = Date.now();
    }

    this.emit('abort', reason);
  }

  /**
   * 获取当前执行状态
   */
  getStatus(): ExecutionResult | null {
    return this.currentExecution;
  }
}

/**
 * Agent 执行管理器
 * 管理多个 Agent 的执行
 */
export class AgentExecutorManager {
  private executors: Map<string, AgentExecutor> = new Map();
  private executions: Map<string, ExecutionResult> = new Map();

  /**
   * 创建或获取 Agent 执行器
   */
  getExecutor(agentId: string, config: AgentExecutorConfig): AgentExecutor {
    if (!this.executors.has(agentId)) {
      const executor = new AgentExecutor(config);

      executor.on('start', (execution: ExecutionResult) => {
        this.executions.set(execution.id, execution);
      });

      executor.on('complete', (execution: ExecutionResult) => {
        this.executions.set(execution.id, execution);
      });

      this.executors.set(agentId, executor);
    }
    return this.executors.get(agentId)!;
  }

  /**
   * 执行任务
   */
  async execute(agentId: string, config: AgentExecutorConfig, prompt: string): Promise<ExecutionResult> {
    const executor = this.getExecutor(agentId, config);
    return executor.execute(prompt);
  }

  /**
   * 流式执行
   */
  async *executeStream(agentId: string, config: AgentExecutorConfig, prompt: string): AsyncGenerator<StreamEvent> {
    const executor = this.getExecutor(agentId, config);
    yield* executor.executeStream(prompt);
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(limit = 100): ExecutionResult[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * 获取 Agent 的执行历史
   */
  getAgentExecutions(agentType: string, limit = 50): ExecutionResult[] {
    return Array.from(this.executions.values())
      .filter(e => e.agentType === agentType)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * 中止所有执行
   */
  abortAll(reason?: string): void {
    for (const executor of this.executors.values()) {
      executor.abort(reason);
    }
  }
}

export default AgentExecutorManager;
