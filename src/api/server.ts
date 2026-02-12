/**
 * Web API 服务 v2
 * 集成真实 CLI 执行 + 数据库持久化
 */

import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { getDatabase, DatabaseManager } from '../core/database.js';
import { AgentExecutorManager, StreamEvent } from '../core/agent-executor.js';
import { getOperationLogger } from '../core/operation-logger.js';

export interface ApiConfig {
  port: number;
  host: string;
  dbPath?: string;
  workdir?: string;
}

export class ApiServer {
  private app = express();
  private db: DatabaseManager;
  private executorManager: AgentExecutorManager;
  private operationLogger = getOperationLogger();
  private config: ApiConfig;
  private activeStreams: Map<string, { taskId: string; agentId: string }> = new Map();

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '127.0.0.1',
      dbPath: config.dbPath || './data/catcafe.db',
      workdir: config.workdir || process.cwd(),
    };

    this.db = getDatabase({ dbPath: this.config.dbPath! });
    this.executorManager = new AgentExecutorManager();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS 配置 - 允许前端访问
    this.app.use(cors({
      origin: ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }));
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

    // Agent 设置
    router.get('/settings/agents', this.getAgentSettings.bind(this));
    router.get('/settings/agents/:id', this.getAgentSetting.bind(this));
    router.put('/settings/agents/:id', this.updateAgentSetting.bind(this));

    // 聊天 + 执行
    router.get('/chat/:taskId', this.getChatMessages.bind(this));
    router.post('/chat/:taskId', this.sendChatMessage.bind(this));
    router.post('/chat/:taskId/execute', this.executeAgent.bind(this));  // 真正执行
    router.get('/chat/:taskId/stream/:streamId', this.streamResponse.bind(this));  // SSE 流

    // 资源池
    router.get('/resources', this.getResources.bind(this));
    router.post('/resources', this.createResource.bind(this));
    router.delete('/resources/:id', this.deleteResource.bind(this));

    // 记忆系统
    router.get('/memory/:agentId', this.getMemories.bind(this));
    router.post('/memory/:agentId', this.saveMemory.bind(this));

    // 执行历史
    router.get('/executions', this.getExecutions.bind(this));

    // 操作日志
    router.get('/logs/operations', this.getOperationLogs.bind(this));

    // 系统状态
    router.get('/status', this.getStatus.bind(this));

    this.app.use('/api', router);
  }

  // ==================== 任务 API ====================

  private createTask(req: Request, res: Response): void {
    const { module, description, prompt } = req.body;

    if (!module || typeof module !== 'string') {
      res.status(400).json({ error: 'Invalid module' });
      return;
    }

    const task = {
      id: uuidv4(),
      module,
      description: description || '',
      prompt: prompt || '',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.db.saveTask(task);

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
    const tasks = this.db.getAllTasks();
    res.json(tasks);
  }

  private getTask(req: Request, res: Response): void {
    const task = this.db.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  }

  private updateTask(req: Request, res: Response): void {
    const task = this.db.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { status } = req.body;
    if (status) {
      this.db.updateTaskStatus(req.params.id, status);
    }

    res.json(this.db.getTask(req.params.id));
  }

  private deleteTask(req: Request, res: Response): void {
    // TODO: 实现删除
    res.status(204).send();
  }

  // ==================== Agent 设置 API ====================

  private getAgentSettings(_req: Request, res: Response): void {
    const settings = this.db.getAllAgentSettings();
    // 隐藏 API Key
    const safeSettings = settings.map(s => ({
      ...s,
      api_key: s.api_key ? '***' : null,
    }));
    res.json(safeSettings);
  }

  private getAgentSetting(req: Request, res: Response): void {
    const settings = this.db.getAgentSettings(req.params.id);
    if (!settings) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({
      ...settings,
      api_key: settings.api_key ? '***' : null,
    });
  }

  private updateAgentSetting(req: Request, res: Response): void {
    const { id } = req.params;
    const updates = req.body;

    const existing = this.db.getAgentSettings(id);
    const settings = {
      id,
      name: updates.name || existing?.name || id,
      avatar: updates.avatar || existing?.avatar || '🤖',
      role: updates.role || existing?.role || '',
      model: updates.model || existing?.model || '',
      workflow: updates.workflow || existing?.workflow || '',
      color: updates.color || existing?.color || '#6B7280',
      apiKey: updates.apiKey || existing?.api_key || undefined,
      apiBase: updates.apiBase || existing?.api_base || undefined,
    };

    this.db.saveAgentSettings(settings);

    this.operationLogger.logOperation({
      agentId: 'system',
      agentName: '系统',
      operation: `更新 Agent 设置: ${settings.name}`,
      status: 'completed',
    });

    res.json(this.db.getAgentSettings(id));
  }

  // ==================== 聊天 + 执行 API ====================

  private getChatMessages(req: Request, res: Response): void {
    const { taskId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = this.db.getMessages(taskId, limit);

    // 转换格式
    const formatted = messages.reverse().map(m => ({
      id: m.id,
      taskId: m.task_id,
      role: m.role,
      agentId: m.agent_id,
      agentName: m.agent_name,
      content: m.content,
      mentions: m.mentions ? JSON.parse(m.mentions) : undefined,
      timestamp: m.timestamp,
    }));

    res.json(formatted);
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
    let role = 'user';
    let agentName: string | undefined;

    if (agentId) {
      role = 'agent';
      const settings = this.db.getAgentSettings(agentId);
      agentName = settings?.name || agentId;
    }

    const message = {
      id: uuidv4(),
      taskId,
      role,
      agentId,
      agentName,
      content,
      mentions: mentions.length > 0 ? mentions : undefined,
      timestamp: Date.now(),
    };

    this.db.saveMessage(message);

    this.operationLogger.logOperation({
      agentId: agentId || 'user',
      agentName: agentName || '用户',
      operation: `发送消息${mentions.length > 0 ? ` (@${mentions.join(', ')})` : ''}`,
      status: 'completed',
      metadata: { taskId, messageId: message.id },
    });

    res.status(201).json(message);
  }

  /**
   * 真正执行 Agent 任务
   */
  private async executeAgent(req: Request, res: Response): Promise<void> {
    const { taskId } = req.params;
    const { agentId, prompt } = req.body;

    if (!agentId || !prompt) {
      res.status(400).json({ error: 'agentId and prompt are required' });
      return;
    }

    const agentSettings = this.db.getAgentSettings(agentId);
    if (!agentSettings) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // 获取 Agent 的记忆作为上下文
    const memories = this.db.getMemories(agentId, 'working', 10);
    const recentMessages = this.db.getMessages(taskId, 20);

    // 构建完整 prompt，包含上下文
    let fullPrompt = prompt;

    if (memories.length > 0) {
      const memoryContext = memories.map(m => m.content).join('\n');
      fullPrompt = `[工作记忆]\n${memoryContext}\n\n[任务]\n${prompt}`;
    }

    if (recentMessages.length > 0) {
      const chatContext = recentMessages
        .slice(-5)
        .map(m => `${m.agent_name || '用户'}: ${m.content}`)
        .join('\n');
      fullPrompt = `[最近对话]\n${chatContext}\n\n${fullPrompt}`;
    }

    // 记录用户消息
    this.db.saveMessage({
      id: uuidv4(),
      taskId,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    });

    // 记录系统消息
    this.db.saveMessage({
      id: uuidv4(),
      taskId,
      role: 'system',
      content: `${agentSettings.avatar} ${agentSettings.name} 开始执行任务...`,
      timestamp: Date.now(),
    });

    const operationId = this.operationLogger.startOperation({
      agentId,
      agentName: agentSettings.name,
      operation: '执行任务',
      input: { prompt },
    });

    try {
      // 根据 model 设置确定 Agent 类型（CLI）
      const model = (agentSettings.model || '').toLowerCase();
      const agentType = model.includes('claude') ? 'claude' :
                        model.includes('codex') ? 'codex' :
                        model.includes('gemini') ? 'gemini' :
                        model.includes('gpt') ? 'codex' : 'claude';

      // 执行
      const result = await this.executorManager.execute(agentId, {
        agentType: agentType as 'claude' | 'codex' | 'gemini',
        model: agentSettings.model || undefined,
        workdir: this.config.workdir!,
        apiKey: agentSettings.api_key || undefined,
        apiBase: agentSettings.api_base || undefined,
      }, fullPrompt);

      // 保存执行结果
      this.db.saveExecution({
        id: result.id,
        agentType: result.agentType,
        prompt: result.prompt,
        response: result.response,
        toolCalls: result.toolCalls,
        status: result.status,
        startTime: result.startTime,
        endTime: result.endTime,
        error: result.error,
      });

      // 保存 Agent 响应消息
      this.db.saveMessage({
        id: uuidv4(),
        taskId,
        role: 'agent',
        agentId,
        agentName: agentSettings.name,
        content: result.response || '(无响应)',
        timestamp: Date.now(),
      });

      // 更新工作记忆
      if (result.response) {
        this.db.saveMemory({
          id: uuidv4(),
          agentId,
          type: 'working',
          content: `执行任务: ${prompt.slice(0, 100)}...\n结果: ${result.response.slice(0, 200)}...`,
          expiresAt: Date.now() + 3600000, // 1 小时后过期
        });
      }

      this.operationLogger.completeOperation(operationId, { status: result.status });

      res.json({
        success: result.status === 'completed',
        execution: result,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.operationLogger.failOperation(operationId, errorMsg);

      // 保存错误消息
      this.db.saveMessage({
        id: uuidv4(),
        taskId,
        role: 'system',
        content: `❌ 执行失败: ${errorMsg}`,
        timestamp: Date.now(),
      });

      res.status(500).json({ error: errorMsg });
    }
  }

  /**
   * SSE 流式响应
   */
  private async streamResponse(req: Request, res: Response): Promise<void> {
    const { taskId, streamId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream not found' })}\n\n`);
      res.end();
      return;
    }

    // TODO: 实现真正的流式传输
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }

  // ==================== 资源池 API ====================

  private getResources(_req: Request, res: Response): void {
    const resources = this.db.getResources();
    // 隐藏 API Key
    const safeResources = resources.map(r => ({
      ...r,
      apiKey: r.apiKey ? '***' : null,
    }));
    res.json(safeResources);
  }

  private createResource(req: Request, res: Response): void {
    const { name, provider, model, apiKey, apiBase, isDefault } = req.body;

    if (!name || !provider || !model) {
      res.status(400).json({ error: 'name, provider, and model are required' });
      return;
    }

    const resource = {
      id: uuidv4(),
      name,
      provider,
      model,
      apiKey,
      apiBase,
      isDefault: isDefault || false,
    };

    this.db.saveResource(resource);

    this.operationLogger.logOperation({
      agentId: 'system',
      agentName: '系统',
      operation: `添加资源: ${name} (${provider})`,
      status: 'completed',
    });

    res.status(201).json({
      ...resource,
      apiKey: apiKey ? '***' : null,
    });
  }

  private deleteResource(req: Request, res: Response): void {
    const deleted = this.db.deleteResource(req.params.id);
    if (deleted) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Resource not found' });
    }
  }

  // ==================== 记忆系统 API ====================

  private getMemories(req: Request, res: Response): void {
    const { agentId } = req.params;
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const memories = this.db.getMemories(agentId, type, limit);
    res.json(memories);
  }

  private saveMemory(req: Request, res: Response): void {
    const { agentId } = req.params;
    const { type, content, metadata, expiresAt } = req.body;

    if (!type || !content) {
      res.status(400).json({ error: 'type and content are required' });
      return;
    }

    const memory = {
      id: uuidv4(),
      agentId,
      type,
      content,
      metadata,
      expiresAt,
    };

    this.db.saveMemory(memory);
    res.status(201).json(memory);
  }

  // ==================== 执行历史 API ====================

  private getExecutions(req: Request, res: Response): void {
    const limit = parseInt(req.query.limit as string) || 100;
    const executions = this.db.getExecutions(limit);
    res.json(executions);
  }

  // ==================== 操作日志 API ====================

  private getOperationLogs(req: Request, res: Response): void {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = this.operationLogger.getAllLogs(limit);
    res.json(logs);
  }

  // ==================== 系统状态 API ====================

  private getStatus(_req: Request, res: Response): void {
    const tasks = this.db.getAllTasks();
    const agents = this.db.getAllAgentSettings();
    const executions = this.db.getExecutions(10);
    const operationStats = this.operationLogger.getStats();

    res.json({
      status: 'running',
      agents: {
        total: agents.length,
        list: agents.map(a => ({
          id: a.id,
          name: a.name,
          avatar: a.avatar,
          model: a.model,
        })),
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
      },
      recentExecutions: executions.slice(0, 5),
      operations: operationStats,
      uptime: process.uptime(),
    });
  }

  async start(): Promise<void> {
    // 等待数据库初始化完成
    await this.db.ensureInitialized();

    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        console.log(`[API] Server running at http://${this.config.host}:${this.config.port}`);
        console.log(`[API] Database: ${this.config.dbPath}`);
        resolve();
      });
    });
  }

  close(): void {
    this.db.close();
  }
}

export default ApiServer;
