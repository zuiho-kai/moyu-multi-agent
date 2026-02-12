/**
 * Agent 调度器模块
 * 负责任务队列管理、并发控制、Agent 实例管理、依赖解析、健康检查和进度监控
 */

import { EventEmitter } from 'events';
import {
  AgentConfig,
  AgentInstance,
  AgentStatus,
  TaskDefinition,
  TaskStatus,
  SchedulerConfig,
  LogEntry,
} from './types.js';
import { CliSpawner, CliEvent } from '../utils/cli-spawn.js';

export interface SchedulerEvents {
  taskAdded: (task: TaskDefinition) => void;
  taskStarted: (task: TaskDefinition, agent: AgentInstance) => void;
  taskCompleted: (task: TaskDefinition) => void;
  taskFailed: (task: TaskDefinition, error: string) => void;
  agentStarted: (agent: AgentInstance) => void;
  agentStopped: (agent: AgentInstance) => void;
  agentError: (agent: AgentInstance, error: string) => void;
  healthCheck: (agents: AgentInstance[]) => void;
  log: (entry: LogEntry) => void;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrentAgents: 5,
  taskQueueSize: 100,
  healthCheckInterval: 30000,
  logSyncInterval: 5000,
  gitAutoCommit: true,
};

export class AgentScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private taskQueue: Map<string, TaskDefinition> = new Map();
  private agents: Map<string, AgentInstance> = new Map();
  private spawners: Map<string, CliSpawner> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private logSyncTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== 任务队列管理 ====================

  addTask(task: TaskDefinition): void {
    if (this.taskQueue.size >= this.config.taskQueueSize) {
      throw new Error(`Task queue is full (max: ${this.config.taskQueueSize})`);
    }

    if (this.taskQueue.has(task.id)) {
      throw new Error(`Task ${task.id} already exists`);
    }

    task.status = 'pending';
    task.createdAt = task.createdAt || Date.now();
    task.updatedAt = Date.now();
    this.taskQueue.set(task.id, task);

    this.log('info', 'scheduler', `Task added: ${task.id} - ${task.module}`);
    this.emit('taskAdded', task);

    if (this.running) {
      this.scheduleNext();
    }
  }

  getTask(taskId: string): TaskDefinition | undefined {
    return this.taskQueue.get(taskId);
  }

  getAllTasks(): TaskDefinition[] {
    return Array.from(this.taskQueue.values());
  }

  getPendingTasks(): TaskDefinition[] {
    return this.getAllTasks().filter((t) => t.status === 'pending');
  }

  getInProgressTasks(): TaskDefinition[] {
    return this.getAllTasks().filter((t) => t.status === 'in_progress');
  }

  updateTaskStatus(taskId: string, status: TaskStatus, logs?: string[]): void {
    const task = this.taskQueue.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = status;
    task.updatedAt = Date.now();

    if (logs) {
      task.logs = [...(task.logs || []), ...logs];
    }

    if (status === 'completed' || status === 'failed') {
      task.completedAt = Date.now();
    }

    this.log('info', 'scheduler', `Task ${taskId} status updated to ${status}`);
  }

  removeTask(taskId: string): boolean {
    const task = this.taskQueue.get(taskId);
    if (task && task.status === 'in_progress') {
      throw new Error(`Cannot remove in-progress task ${taskId}`);
    }
    return this.taskQueue.delete(taskId);
  }

  // ==================== 并发控制 ====================

  getRunningAgentCount(): number {
    return Array.from(this.agents.values()).filter(
      (a) => a.status === 'running'
    ).length;
  }

  canStartNewAgent(): boolean {
    return this.getRunningAgentCount() < this.config.maxConcurrentAgents;
  }

  setMaxConcurrentAgents(max: number): void {
    if (max < 1) {
      throw new Error('Max concurrent agents must be at least 1');
    }
    this.config.maxConcurrentAgents = max;
    this.log('info', 'scheduler', `Max concurrent agents set to ${max}`);
  }

  // ==================== Agent 实例管理 ====================

  registerAgent(config: AgentConfig): AgentInstance {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent ${config.id} already registered`);
    }

    const instance: AgentInstance = {
      config,
      status: 'idle',
    };

    this.agents.set(config.id, instance);
    this.log('info', 'scheduler', `Agent registered: ${config.id} (${config.type})`);
    return instance;
  }

  async startAgent(agentId: string, task: TaskDefinition): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status === 'running') {
      throw new Error(`Agent ${agentId} is already running`);
    }

    if (!this.canStartNewAgent()) {
      throw new Error('Max concurrent agents reached');
    }

    agent.status = 'running';
    agent.currentTask = task.id;
    agent.startedAt = Date.now();
    agent.lastActivity = Date.now();
    agent.worktreePath = task.worktreePath;

    task.status = 'in_progress';
    task.assignedAgent = agentId;
    task.updatedAt = Date.now();

    const spawner = new CliSpawner();
    this.spawners.set(agentId, spawner);

    const cliArgs = this.buildCliArgs(agent.config, task);

    this.log('info', 'scheduler', `Starting agent ${agentId} for task ${task.id}`);
    this.emit('agentStarted', agent);
    this.emit('taskStarted', task, agent);

    try {
      for await (const event of spawner.spawn({
        command: this.getCliCommand(agent.config.type),
        args: cliArgs,
        cwd: task.worktreePath || agent.config.workdir,
        timeout: agent.config.timeout || 300000,
      })) {
        agent.lastActivity = Date.now();
        this.handleAgentEvent(agent, task, event);

        if (event.type === 'exit') {
          const exitData = event.data as { code: number };
          if (exitData.code === 0) {
            this.completeTask(task, agent);
          } else {
            this.failTask(task, agent, `Agent exited with code ${exitData.code}`);
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.failTask(task, agent, errorMsg);
    } finally {
      this.spawners.delete(agentId);
      agent.pid = spawner.pid;
    }
  }

  async stopAgent(agentId: string, reason?: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const spawner = this.spawners.get(agentId);
    if (spawner) {
      spawner.abort(reason);
      this.spawners.delete(agentId);
    }

    agent.status = 'aborted';
    this.log('warn', 'scheduler', `Agent ${agentId} stopped: ${reason || 'manual stop'}`);
    this.emit('agentStopped', agent);

    if (agent.currentTask) {
      const task = this.taskQueue.get(agent.currentTask);
      if (task) {
        task.status = 'failed';
        task.updatedAt = Date.now();
        this.emit('taskFailed', task, reason || 'Agent stopped');
      }
    }

    agent.currentTask = undefined;
  }

  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agents.get(agentId)?.status;
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  getRunningAgents(): AgentInstance[] {
    return this.getAllAgents().filter((a) => a.status === 'running');
  }

  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (agent?.status === 'running') {
      throw new Error(`Cannot unregister running agent ${agentId}`);
    }
    return this.agents.delete(agentId);
  }

  // ==================== 任务依赖解析 ====================

  getReadyTasks(): TaskDefinition[] {
    const pending = this.getPendingTasks();
    return pending.filter((task) => this.areDependenciesMet(task));
  }

  areDependenciesMet(task: TaskDefinition): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every((depId) => {
      const depTask = this.taskQueue.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  getTaskDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const task of this.taskQueue.values()) {
      graph.set(task.id, task.dependencies || []);
    }
    return graph;
  }

  getTopologicalOrder(): string[] {
    const graph = this.getTaskDependencyGraph();
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (taskId: string, ancestors: Set<string>) => {
      if (ancestors.has(taskId)) {
        throw new Error(`Circular dependency detected: ${taskId}`);
      }
      if (visited.has(taskId)) return;

      ancestors.add(taskId);
      const deps = graph.get(taskId) || [];
      for (const dep of deps) {
        if (graph.has(dep)) {
          visit(dep, new Set(ancestors));
        }
      }
      ancestors.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
    };

    for (const taskId of graph.keys()) {
      visit(taskId, new Set());
    }

    return result;
  }

  // ==================== 健康检查 ====================

  startHealthCheck(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.log('info', 'scheduler', 'Health check started');
  }

  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.log('info', 'scheduler', 'Health check stopped');
    }
  }

  private performHealthCheck(): void {
    const runningAgents = this.getRunningAgents();
    const now = Date.now();
    const unhealthyAgents: AgentInstance[] = [];

    for (const agent of runningAgents) {
      const inactiveTime = now - (agent.lastActivity || agent.startedAt || now);
      const timeout = agent.config.timeout || 300000;

      if (inactiveTime > timeout) {
        unhealthyAgents.push(agent);
        this.log('warn', 'scheduler', `Agent ${agent.config.id} is unresponsive (inactive for ${inactiveTime}ms)`);
      }
    }

    for (const agent of unhealthyAgents) {
      this.handleUnhealthyAgent(agent);
    }

    this.emit('healthCheck', runningAgents);
  }

  private async handleUnhealthyAgent(agent: AgentInstance): Promise<void> {
    const taskId = agent.currentTask;
    const task = taskId ? this.taskQueue.get(taskId) : undefined;

    await this.stopAgent(agent.config.id, 'Health check failed - agent unresponsive');

    agent.status = 'idle';
    this.emit('agentError', agent, 'Agent became unresponsive');

    if (task) {
      task.status = 'pending';
      task.assignedAgent = undefined;
      task.updatedAt = Date.now();
      this.log('info', 'scheduler', `Task ${task.id} re-queued for retry`);
    }

    if (this.running) {
      this.scheduleNext();
    }
  }

  // ==================== 进度监控和日志同步 ====================

  startLogSync(): void {
    if (this.logSyncTimer) return;

    this.logSyncTimer = setInterval(() => {
      this.syncLogs();
    }, this.config.logSyncInterval);

    this.log('info', 'scheduler', 'Log sync started');
  }

  stopLogSync(): void {
    if (this.logSyncTimer) {
      clearInterval(this.logSyncTimer);
      this.logSyncTimer = null;
      this.log('info', 'scheduler', 'Log sync stopped');
    }
  }

  private syncLogs(): void {
    const runningAgents = this.getRunningAgents();
    for (const agent of runningAgents) {
      if (agent.currentTask) {
        const task = this.taskQueue.get(agent.currentTask);
        if (task) {
          this.log('debug', 'scheduler', `Agent ${agent.config.id} working on ${task.module}`);
        }
      }
    }
  }

  getProgress(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    runningAgents: number;
    maxAgents: number;
  } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      runningAgents: this.getRunningAgentCount(),
      maxAgents: this.config.maxConcurrentAgents,
    };
  }

  private log(
    level: LogEntry['level'],
    module: string,
    message: string,
    data?: unknown
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data,
    };
    this.emit('log', entry);
  }

  // ==================== 调度控制 ====================

  start(): void {
    if (this.running) return;

    this.running = true;
    this.startHealthCheck();
    this.startLogSync();
    this.log('info', 'scheduler', 'Scheduler started');
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    this.stopHealthCheck();
    this.stopLogSync();
    this.log('info', 'scheduler', 'Scheduler stopped');
  }

  async shutdown(): Promise<void> {
    this.stop();

    const runningAgents = this.getRunningAgents();
    await Promise.all(
      runningAgents.map((agent) =>
        this.stopAgent(agent.config.id, 'Scheduler shutdown')
      )
    );

    this.log('info', 'scheduler', 'Scheduler shutdown complete');
  }

  private scheduleNext(): void {
    if (!this.running) return;

    const readyTasks = this.getReadyTasks();
    const idleAgents = this.getAllAgents().filter((a) => a.status === 'idle');

    for (const task of readyTasks) {
      if (!this.canStartNewAgent()) break;

      const agent = this.selectAgentForTask(task, idleAgents);
      if (agent) {
        this.startAgent(agent.config.id, task).catch((error) => {
          this.log('error', 'scheduler', `Failed to start agent: ${error}`);
        });
      }
    }
  }

  private selectAgentForTask(
    task: TaskDefinition,
    idleAgents: AgentInstance[]
  ): AgentInstance | undefined {
    if (task.assignedAgent) {
      return idleAgents.find((a) => a.config.id === task.assignedAgent);
    }
    return idleAgents[0];
  }

  // ==================== 辅助方法 ====================

  private getCliCommand(agentType: AgentConfig['type']): string {
    const commands: Record<AgentConfig['type'], string> = {
      claude: 'claude',
      codex: 'codex',
      gemini: 'gemini',
    };
    return commands[agentType];
  }

  private buildCliArgs(config: AgentConfig, task: TaskDefinition): string[] {
    const args: string[] = [];

    if (config.type === 'claude') {
      args.push('--print', '--output-format', 'stream-json');
      if (config.model) {
        args.push('--model', config.model);
      }
      if (config.permissionMode === 'bypassPermissions') {
        args.push('--dangerously-skip-permissions');
      } else if (config.permissionMode === 'acceptEdits') {
        args.push('--allowedTools', 'Edit', 'Write', 'Bash');
      }
      args.push('--prompt', task.prompt);
    } else if (config.type === 'codex') {
      args.push('--json');
      if (config.model) {
        args.push('--model', config.model);
      }
      args.push(task.prompt);
    } else if (config.type === 'gemini') {
      args.push('--json');
      if (config.model) {
        args.push('--model', config.model);
      }
      args.push(task.prompt);
    }

    return args;
  }

  private handleAgentEvent(
    agent: AgentInstance,
    task: TaskDefinition,
    event: CliEvent
  ): void {
    const logMessage = `[${agent.config.id}] ${event.type}: ${
      typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    }`;

    task.logs = task.logs || [];
    task.logs.push(logMessage);

    if (event.type === 'error' || event.type === 'stderr') {
      this.log('error', agent.config.id, String(event.data));
    } else {
      this.log('debug', agent.config.id, String(event.data));
    }
  }

  private completeTask(task: TaskDefinition, agent: AgentInstance): void {
    task.status = 'completed';
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    agent.status = 'completed';
    agent.currentTask = undefined;

    this.log('info', 'scheduler', `Task ${task.id} completed by ${agent.config.id}`);
    this.emit('taskCompleted', task);

    agent.status = 'idle';
    this.scheduleNext();
  }

  private failTask(task: TaskDefinition, agent: AgentInstance, error: string): void {
    task.status = 'failed';
    task.updatedAt = Date.now();
    task.logs = [...(task.logs || []), `Error: ${error}`];

    agent.status = 'error';
    agent.currentTask = undefined;

    this.log('error', 'scheduler', `Task ${task.id} failed: ${error}`);
    this.emit('taskFailed', task, error);
    this.emit('agentError', agent, error);

    agent.status = 'idle';
    this.scheduleNext();
  }
}

export default AgentScheduler;
