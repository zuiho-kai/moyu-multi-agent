/**
 * Cat Café Multi-Agent System
 * 多 Agent 协作系统主入口
 *
 * 基于 cat-cafe-tutorials + OpenClaw 设计
 * 支持 Claude/Codex/Gemini 三猫协作
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentScheduler, LogManager, GitManager, TaskDefinition, AgentConfig } from './core/index.js';
import { ClaudeAgentService, CodexAgentService, GeminiAgentService } from './agents/index.js';
import { ApiServer } from './api/index.js';

export interface MultiAgentSystemConfig {
  projectRoot: string;
  logDir?: string;
  maxConcurrentAgents?: number;
  apiPort?: number;
  gitAutoCommit?: boolean;
  dbPath?: string;
}

export class MultiAgentSystem {
  private scheduler: AgentScheduler;
  private logManager: LogManager;
  private gitManager: GitManager;
  private apiServer: ApiServer;
  private config: MultiAgentSystemConfig;

  constructor(config: MultiAgentSystemConfig) {
    this.config = config;

    // 初始化日志管理器
    this.logManager = LogManager.getInstance(config.logDir || `${config.projectRoot}/logs`);

    // 初始化 Git 管理器
    this.gitManager = new GitManager({
      repoPath: config.projectRoot,
      autoCommit: config.gitAutoCommit ?? true,
    });

    // 初始化调度器
    this.scheduler = new AgentScheduler({
      maxConcurrentAgents: config.maxConcurrentAgents || 5,
      gitAutoCommit: config.gitAutoCommit ?? true,
    });

    // 初始化 API 服务器（使用数据库持久化）
    this.apiServer = new ApiServer({
      port: config.apiPort || 3000,
      host: '127.0.0.1',
      dbPath: config.dbPath || `${config.projectRoot}/data/catcafe.db`,
      workdir: config.projectRoot,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const logger = this.logManager.getGlobalLogger('system');

    this.scheduler.on('taskAdded', (task) => {
      logger.info(`Task added: ${task.module}`);
    });

    this.scheduler.on('taskCompleted', async (task) => {
      logger.info(`Task completed: ${task.module}`);
      if (this.config.gitAutoCommit && task.assignedAgent) {
        await this.gitManager.autoCommit(
          task.module,
          task.assignedAgent,
          `Complete ${task.description}`,
          undefined,
          task.worktreePath
        );
      }
    });

    this.scheduler.on('taskFailed', (task, error) => {
      logger.error(`Task failed: ${task.module} - ${error}`);
    });

    this.scheduler.on('agentError', (agent, error) => {
      logger.error(`Agent error: ${agent.config.id} - ${error}`);
    });
  }

  /**
   * 注册 Agent
   */
  registerAgent(config: AgentConfig): void {
    this.scheduler.registerAgent(config);
  }

  /**
   * 注册默认的三猫 Agent
   */
  registerDefaultAgents(): void {
    // 布偶猫 (Claude)
    this.registerAgent({
      id: 'claude-main',
      type: 'claude',
      name: '布偶猫',
      model: 'claude-sonnet-4-5-20250929',
      workdir: this.config.projectRoot,
      permissionMode: 'acceptEdits',
    });

    // 缅因猫 (Codex)
    this.registerAgent({
      id: 'codex-main',
      type: 'codex',
      name: '缅因猫',
      workdir: this.config.projectRoot,
    });

    // 暹罗猫 (Gemini)
    this.registerAgent({
      id: 'gemini-main',
      type: 'gemini',
      name: '暹罗猫',
      workdir: this.config.projectRoot,
    });
  }

  /**
   * 添加开发任务
   */
  addTask(task: Omit<TaskDefinition, 'id' | 'status' | 'createdAt' | 'updatedAt'>): string {
    const fullTask: TaskDefinition = {
      ...task,
      id: uuidv4(),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.scheduler.addTask(fullTask);
    return fullTask.id;
  }

  /**
   * 为模块创建 Worktree
   */
  async createModuleWorktree(module: string, agentId?: string): Promise<string> {
    const worktreePath = `${this.config.projectRoot}/agents/worktrees/${module}`;
    const branch = `feature/${module}`;

    await this.gitManager.createWorktree(worktreePath, branch, module, agentId);
    return worktreePath;
  }

  /**
   * 启动系统
   */
  async start(): Promise<void> {
    const logger = this.logManager.getGlobalLogger('system');
    logger.info('Starting Multi-Agent System...');

    // 启动 API 服务器
    await this.apiServer.start();

    // 启动调度器
    this.scheduler.start();

    logger.info('Multi-Agent System started');
  }

  /**
   * 停止系统
   */
  async stop(): Promise<void> {
    const logger = this.logManager.getGlobalLogger('system');
    logger.info('Stopping Multi-Agent System...');

    await this.scheduler.shutdown();
    this.apiServer.close();
    await this.logManager.close();

    logger.info('Multi-Agent System stopped');
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    progress: ReturnType<AgentScheduler['getProgress']>;
    agents: ReturnType<AgentScheduler['getAllAgents']>;
    tasks: ReturnType<AgentScheduler['getAllTasks']>;
  } {
    return {
      progress: this.scheduler.getProgress(),
      agents: this.scheduler.getAllAgents(),
      tasks: this.scheduler.getAllTasks(),
    };
  }

  // 暴露内部组件供高级用法
  get Scheduler(): AgentScheduler {
    return this.scheduler;
  }

  get Git(): GitManager {
    return this.gitManager;
  }

  get Log(): LogManager {
    return this.logManager;
  }

  get Api(): ApiServer {
    return this.apiServer;
  }
}

// 导出所有模块
export * from './core/index.js';
export * from './agents/index.js';
export * from './api/index.js';
export * from './utils/index.js';

// 默认导出
export default MultiAgentSystem;
