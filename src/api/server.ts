/**
 * Web API 服务
 * 提供 HTTP 接口管理多 Agent 系统
 */

import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { TaskDefinition, AgentInstance, TaskStatus } from '../core/types.js';

export interface ApiConfig {
  port: number;
  host: string;
}

export class ApiServer {
  private app = express();
  private tasks = new Map<string, TaskDefinition>();
  private agents = new Map<string, AgentInstance>();
  private config: ApiConfig;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '0.0.0.0',
    };
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
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

    // 日志
    router.get('/logs', this.getLogs.bind(this));
    router.get('/logs/:agentId', this.getAgentLogs.bind(this));

    // 系统状态
    router.get('/status', this.getStatus.bind(this));

    this.app.use('/api', router);
  }

  // 任务 API
  private createTask(req: Request, res: Response): void {
    const { module, description, prompt, dependencies } = req.body;
    const task: TaskDefinition = {
      id: uuidv4(),
      module,
      description,
      prompt,
      dependencies,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.set(task.id, task);
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
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  }

  // Agent API
  private listAgents(_req: Request, res: Response): void {
    res.json(Array.from(this.agents.values()));
  }

  private getAgent(req: Request, res: Response): void {
    const agent = this.agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  }

  private startAgent(req: Request, res: Response): void {
    const { id } = req.params;
    const agent = this.agents.get(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    // TODO: 实际启动 Agent 进程
    agent.status = 'running';
    agent.startedAt = Date.now();
    res.json(agent);
  }

  private stopAgent(req: Request, res: Response): void {
    const { id } = req.params;
    const agent = this.agents.get(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    // TODO: 实际停止 Agent 进程
    agent.status = 'idle';
    res.json(agent);
  }

  // 日志 API
  private getLogs(_req: Request, res: Response): void {
    // TODO: 从 LogManager 获取日志
    res.json({ logs: [] });
  }

  private getAgentLogs(req: Request, res: Response): void {
    const { agentId } = req.params;
    // TODO: 从 LogManager 获取特定 Agent 日志
    res.json({ agentId, logs: [] });
  }

  // 系统状态
  private getStatus(_req: Request, res: Response): void {
    const runningAgents = Array.from(this.agents.values()).filter(a => a.status === 'running');
    const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending');
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');

    res.json({
      status: 'running',
      agents: {
        total: this.agents.size,
        running: runningAgents.length,
      },
      tasks: {
        total: this.tasks.size,
        pending: pendingTasks.length,
        completed: completedTasks.length,
      },
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
