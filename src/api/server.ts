/**
 * Web API 服务
 * 提供 HTTP 接口管理多 Agent 系统
 */

import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import type { TaskDefinition, AgentInstance, TaskStatus, AgentConfig } from '../core/types.js';
import { getOperationLogger, OperationLog } from '../core/operation-logger.js';

export interface ApiConfig {
  port: number;
  host: string;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string;
  agentName?: string;
  content: string;
  mentions?: string[];  // @agent 提及
  timestamp: number;
}

export interface AgentSettings {
  id: string;
  name: string;
  avatar: string;
  role: string;
  model: string;
  workflow?: string;
  color: string;
}

// 默认 Agent 设置
const DEFAULT_AGENT_SETTINGS: AgentSettings[] = [
  {
    id: 'claude',
    name: '布偶猫',
    avatar: '🐱',
    role: '主架构师，负责核心开发和深度思考',
    model: 'claude-sonnet-4-5-20250929',
    color: '#8B5CF6',
  },
  {
    id: 'codex',
    name: '缅因猫',
    avatar: '🐈',
    role: 'Code Review，安全审查，测试',
    model: 'codex',
    color: '#10B981',
  },
  {
    id: 'gemini',
    name: '暹罗猫',
    avatar: '😺',
    role: '视觉设计，创意发散',
    model: 'gemini-pro',
    color: '#F59E0B',
  },
];

export class ApiServer {
  private app = express();
  private tasks = new Map<string, TaskDefinition>();
  private agents = new Map<string, AgentInstance>();
  private agentSettings = new Map<string, AgentSettings>();
  private chatMessages = new Map<string, ChatMessage[]>();  // taskId -> messages
  private config: ApiConfig;
  private operationLogger = getOperationLogger();

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '127.0.0.1',
    };

    // 初始化默认 Agent 设置
    for (const settings of DEFAULT_AGENT_SETTINGS) {
      this.agentSettings.set(settings.id, settings);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req, _res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    const router = Router();

    // 任务管理
    router.post('/tasks', this.createTask.bind(this));
    router.get('/tasks', this.listTasks.bind(this));
    router.get('/tasks/:id', this.getTask.bind(this));
    router.patch('/tasks/:id', this.updateTask.bind(this));
    router.delete('/tasks/:id', this.deleteTask.bind(this));

    // Agent 管理
    router.get('/agents', this.listAgents.bind(this));
    router.get('/agents/:id', this.getAgent.bind(this));
    router.post('/agents/:id/start', this.startAgent.bind(this));
    router.post('/agents/:id/stop', this.stopAgent.bind(this));

    // Agent 设置
    router.get('/settings/agents', this.getAgentSettings.bind(this));
    router.get('/settings/agents/:id', this.getAgentSetting.bind(this));
    router.put('/settings/agents/:id', this.updateAgentSetting.bind(this));

    // 聊天
    router.get('/chat/:taskId', this.getChatMessages.bind(this));
    router.post('/chat/:taskId', this.sendChatMessage.bind(this));

    // 操作日志
    router.get('/logs', this.getLogs.bind(this));
    router.get('/logs/operations', this.getOperationLogs.bind(this));
    router.get('/logs/operations/stats', this.getOperationStats.bind(this));
    router.get('/logs/:agentId', this.getAgentLogs.bind(this));

    // 系统状态
    router.get('/status', this.getStatus.bind(this));

    this.app.use('/api', router);
  }

  // 任务 API
  private createTask(req: Request, res: Response): void {
    const { module, description, prompt, dependencies } = req.body;

    // 输入验证
    if (!module || typeof module !== 'string') {
      res.status(400).json({ error: 'Invalid module' });
      return;
    }

    const task: TaskDefinition = {
      id: uuidv4(),
      module,
      description: description || '',
      prompt: prompt || '',
      dependencies,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    this.chatMessages.set(task.id, []);  // 初始化聊天记录

    // 记录操作日志
    this.operationLogger.logOperation({
      agentId: 'system',
      agentName: '系统',
      operation: `创建任务: ${task.module}`,
      status: 'completed',
      metadata: { taskId: task.id },
    });

    res.status(201).json(task);
  }

  private listTasks(_req: Request, res: Response): void {
    res.json(Array.from(this.tasks.values()));
  }

  private getTask(req: Request, res: Response): void {
    const task = this.tasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  }

  private updateTask(req: Request, res: Response): void {
    const task = this.tasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const updates = req.body as Partial<TaskDefinition>;
    Object.assign(task, updates, { updatedAt: Date.now() });
    if (updates.status === 'completed') {
      task.completedAt = Date.now();
    }
    res.json(task);
  }

  private deleteTask(req: Request, res: Response): void {
    if (this.tasks.delete(req.params.id)) {
      this.chatMessages.delete(req.params.id);
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  }

  // Agent API
  private listAgents(_req: Request, res: Response): void {
    const agents = Array.from(this.agents.values()).map(agent => ({
      ...agent,
      settings: this.agentSettings.get(agent.config.type) || null,
    }));
    res.json(agents);
  }

  private getAgent(req: Request, res: Response): void {
    const agent = this.agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({
      ...agent,
      settings: this.agentSettings.get(agent.config.type) || null,
    });
  }

  private startAgent(req: Request, res: Response): void {
    const { id } = req.params;
    const agent = this.agents.get(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    agent.status = 'running';
    agent.startedAt = Date.now();

    this.operationLogger.logOperation({
      agentId: agent.config.id,
      agentName: agent.config.name,
      operation: 'Agent 启动',
      status: 'completed',
    });

    res.json(agent);
  }

  private stopAgent(req: Request, res: Response): void {
    const { id } = req.params;
    const agent = this.agents.get(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    agent.status = 'idle';

    this.operationLogger.logOperation({
      agentId: agent.config.id,
      agentName: agent.config.name,
      operation: 'Agent 停止',
      status: 'completed',
    });

    res.json(agent);
  }

  // Agent 设置 API
  private getAgentSettings(_req: Request, res: Response): void {
    res.json(Array.from(this.agentSettings.values()));
  }

  private getAgentSetting(req: Request, res: Response): void {
    const settings = this.agentSettings.get(req.params.id);
    if (!settings) {
      res.status(404).json({ error: 'Agent settings not found' });
      return;
    }
    res.json(settings);
  }

  private updateAgentSetting(req: Request, res: Response): void {
    const { id } = req.params;
    const updates = req.body as Partial<AgentSettings>;

    let settings = this.agentSettings.get(id);
    if (!settings) {
      // 创建新设置
      settings = {
        id,
        name: updates.name || id,
        avatar: updates.avatar || '🤖',
        role: updates.role || '',
        model: updates.model || '',
        color: updates.color || '#6B7280',
        ...updates,
      };
    } else {
      Object.assign(settings, updates);
    }

    this.agentSettings.set(id, settings);

    this.operationLogger.logOperation({
      agentId: 'system',
      agentName: '系统',
      operation: `更新 Agent 设置: ${settings.name}`,
      status: 'completed',
      metadata: { agentId: id, updates },
    });

    res.json(settings);
  }

  // 聊天 API
  private getChatMessages(req: Request, res: Response): void {
    const { taskId } = req.params;
    const messages = this.chatMessages.get(taskId) || [];
    res.json(messages);
  }

  private sendChatMessage(req: Request, res: Response): void {
    const { taskId } = req.params;
    const { content, agentId } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Invalid content' });
      return;
    }

    // 解析 @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    // 确定消息角色
    let role: ChatMessage['role'] = 'user';
    let agentName: string | undefined;

    if (agentId) {
      role = 'agent';
      const settings = this.agentSettings.get(agentId);
      agentName = settings?.name || agentId;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      taskId,
      role,
      agentId,
      agentName,
      content,
      mentions: mentions.length > 0 ? mentions : undefined,
      timestamp: Date.now(),
    };

    // 获取或创建消息列表
    if (!this.chatMessages.has(taskId)) {
      this.chatMessages.set(taskId, []);
    }
    this.chatMessages.get(taskId)!.push(message);

    // 记录操作日志
    this.operationLogger.logOperation({
      agentId: agentId || 'user',
      agentName: agentName || '用户',
      operation: `发送消息${mentions.length > 0 ? ` (提及: ${mentions.join(', ')})` : ''}`,
      status: 'completed',
      metadata: { taskId, messageId: message.id, mentions },
    });

    // 如果有 @mentions，触发意图识别（简化版）
    if (mentions.length > 0) {
      this.handleMentions(taskId, message, mentions);
    } else if (role === 'user') {
      // 没有指定 agent，基于意图自动识别
      this.autoRouteMessage(taskId, message);
    }

    res.status(201).json(message);
  }

  /**
   * 处理 @mentions，唤起对应 Agent
   */
  private handleMentions(taskId: string, message: ChatMessage, mentions: string[]): void {
    for (const mention of mentions) {
      // 查找匹配的 Agent
      const settings = Array.from(this.agentSettings.values()).find(
        s => s.id === mention || s.name.includes(mention)
      );

      if (settings) {
        // 创建系统消息通知 Agent 被唤起
        const systemMessage: ChatMessage = {
          id: uuidv4(),
          taskId,
          role: 'system',
          content: `${settings.avatar} ${settings.name} 被唤起`,
          timestamp: Date.now(),
        };
        this.chatMessages.get(taskId)?.push(systemMessage);

        this.operationLogger.logOperation({
          agentId: settings.id,
          agentName: settings.name,
          operation: '被 @mention 唤起',
          status: 'started',
          metadata: { taskId, triggeredBy: message.agentId || 'user' },
        });
      }
    }
  }

  /**
   * 基于意图自动路由消息到合适的 Agent
   */
  private autoRouteMessage(taskId: string, message: ChatMessage): void {
    const content = message.content.toLowerCase();

    // 简单的意图识别规则
    let targetAgent: AgentSettings | undefined;

    if (content.includes('代码') || content.includes('开发') || content.includes('实现') || content.includes('架构')) {
      targetAgent = this.agentSettings.get('claude');
    } else if (content.includes('review') || content.includes('审查') || content.includes('测试') || content.includes('安全')) {
      targetAgent = this.agentSettings.get('codex');
    } else if (content.includes('设计') || content.includes('ui') || content.includes('界面') || content.includes('创意')) {
      targetAgent = this.agentSettings.get('gemini');
    } else {
      // 默认路由到 Claude
      targetAgent = this.agentSettings.get('claude');
    }

    if (targetAgent) {
      const systemMessage: ChatMessage = {
        id: uuidv4(),
        taskId,
        role: 'system',
        content: `🎯 意图识别: 自动唤起 ${targetAgent.avatar} ${targetAgent.name}`,
        timestamp: Date.now(),
      };
      this.chatMessages.get(taskId)?.push(systemMessage);

      this.operationLogger.logOperation({
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        operation: '被意图识别自动唤起',
        status: 'started',
        metadata: { taskId, intent: 'auto-route' },
      });
    }
  }

  // 日志 API
  private getLogs(_req: Request, res: Response): void {
    res.json({ logs: [] });
  }

  private getOperationLogs(req: Request, res: Response): void {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = this.operationLogger.getAllLogs(limit);
    res.json(logs);
  }

  private getOperationStats(_req: Request, res: Response): void {
    const stats = this.operationLogger.getStats();
    res.json(stats);
  }

  private getAgentLogs(req: Request, res: Response): void {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = this.operationLogger.getAgentLogs(agentId, limit);
    res.json({ agentId, logs });
  }

  // 系统状态
  private getStatus(_req: Request, res: Response): void {
    const runningAgents = Array.from(this.agents.values()).filter(a => a.status === 'running');
    const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending');
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    const operationStats = this.operationLogger.getStats();

    res.json({
      status: 'running',
      agents: {
        total: this.agents.size,
        running: runningAgents.length,
        settings: Array.from(this.agentSettings.values()),
      },
      tasks: {
        total: this.tasks.size,
        pending: pendingTasks.length,
        completed: completedTasks.length,
      },
      operations: operationStats,
      uptime: process.uptime(),
    });
  }

  // 注册 Agent
  registerAgent(agent: AgentInstance): void {
    this.agents.set(agent.config.id, agent);
  }

  // 注册任务
  registerTask(task: TaskDefinition): void {
    this.tasks.set(task.id, task);
    if (!this.chatMessages.has(task.id)) {
      this.chatMessages.set(task.id, []);
    }
  }

  // 更新任务状态
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      if (status === 'completed') {
        task.completedAt = Date.now();
      }
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        console.log(`[API] Server running at http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }
}
