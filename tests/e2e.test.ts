/**
 * 端到端测试
 * 模拟完整用户流程：创建任务 → 选择任务 → 发送消息 → Agent 执行
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiServer } from '../src/api/server.js';
import { existsSync, rmSync } from 'fs';

const API_BASE = 'http://127.0.0.1:3098';

describe('端到端测试', () => {
  let server: ApiServer;
  const port = 3098;
  const testDbPath = './data/test-e2e.db';

  beforeAll(async () => {
    // 清理测试数据库
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    server = new ApiServer({
      port,
      host: '127.0.0.1',
      dbPath: testDbPath,
      workdir: process.cwd(),
    });

    await server.start();
  });

  afterAll(() => {
    server.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('完整用户流程', () => {
    let taskId: string;

    it('1. 页面加载 - 获取初始数据', async () => {
      // 获取系统状态
      const statusRes = await fetch(`${API_BASE}/api/status`);
      expect(statusRes.status).toBe(200);
      const status = await statusRes.json();
      expect(status.status).toBe('running');
      expect(status.agents.total).toBe(3);

      // 获取 Agent 列表
      const agentsRes = await fetch(`${API_BASE}/api/settings/agents`);
      expect(agentsRes.status).toBe(200);
      const agents = await agentsRes.json();
      expect(agents.length).toBe(3);
      expect(agents.map((a: { id: string }) => a.id)).toContain('claude');

      // 获取任务列表（初始为空）
      const tasksRes = await fetch(`${API_BASE}/api/tasks`);
      expect(tasksRes.status).toBe(200);
      const tasks = await tasksRes.json();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('2. 创建任务', async () => {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'test-feature',
          description: '测试功能开发',
          prompt: '开发一个测试功能',
        }),
      });

      expect(response.status).toBe(201);
      const task = await response.json();
      expect(task.id).toBeDefined();
      expect(task.module).toBe('test-feature');
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeDefined();

      taskId = task.id;
    });

    it('3. 验证任务已创建', async () => {
      // 获取任务列表
      const listRes = await fetch(`${API_BASE}/api/tasks`);
      const tasks = await listRes.json();
      expect(tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);

      // 获取单个任务
      const taskRes = await fetch(`${API_BASE}/api/tasks/${taskId}`);
      expect(taskRes.status).toBe(200);
      const task = await taskRes.json();
      expect(task.module).toBe('test-feature');
    });

    it('4. 选择任务 - 获取聊天历史', async () => {
      const response = await fetch(`${API_BASE}/api/chat/${taskId}`);
      expect(response.status).toBe(200);
      const messages = await response.json();
      expect(Array.isArray(messages)).toBe(true);
    });

    it('5. 发送聊天消息', async () => {
      const response = await fetch(`${API_BASE}/api/chat/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '@claude 帮我分析一下这个任务',
        }),
      });

      expect(response.status).toBe(201);
      const message = await response.json();
      expect(message.id).toBeDefined();
      expect(message.content).toContain('@claude');
      expect(message.role).toBe('user');
      expect(message.mentions).toContain('claude');
    });

    it('6. 验证消息已保存', async () => {
      const response = await fetch(`${API_BASE}/api/chat/${taskId}`);
      const messages = await response.json();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m: { content: string }) => m.content.includes('@claude'))).toBe(true);
    });

    it('7. 更新任务状态', async () => {
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      expect(response.status).toBe(200);
      const task = await response.json();
      expect(task.status).toBe('in_progress');
    });

    it('8. 资源池操作', async () => {
      // 添加资源
      const createRes = await fetch(`${API_BASE}/api/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Claude API',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
          apiKey: 'sk-test-key',
        }),
      });
      expect(createRes.status).toBe(201);
      const resource = await createRes.json();
      expect(resource.apiKey).toBe('***'); // API Key 应该被隐藏

      // 列出资源
      const listRes = await fetch(`${API_BASE}/api/resources`);
      expect(listRes.status).toBe(200);
      const resources = await listRes.json();
      expect(resources.length).toBeGreaterThan(0);

      // 删除资源
      const deleteRes = await fetch(`${API_BASE}/api/resources/${resource.id}`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(204);
    });

    it('9. 记忆系统操作', async () => {
      // 保存记忆
      const saveRes = await fetch(`${API_BASE}/api/memory/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'working',
          content: '用户正在开发测试功能',
        }),
      });
      expect(saveRes.status).toBe(201);

      // 获取记忆
      const getRes = await fetch(`${API_BASE}/api/memory/claude?type=working`);
      expect(getRes.status).toBe(200);
      const memories = await getRes.json();
      expect(memories.length).toBeGreaterThan(0);
    });

    it('10. 获取执行历史', async () => {
      const response = await fetch(`${API_BASE}/api/executions`);
      expect(response.status).toBe(200);
      const executions = await response.json();
      expect(Array.isArray(executions)).toBe(true);
    });

    it('11. 获取操作日志', async () => {
      const response = await fetch(`${API_BASE}/api/logs/operations`);
      expect(response.status).toBe(200);
      const logs = await response.json();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('前端数据格式验证', () => {
    it('任务列表返回正确的字段格式', async () => {
      // 创建任务
      const createRes = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'format-test',
          description: '格式测试',
        }),
      });
      const task = await createRes.json();

      // 验证字段名是驼峰格式（前端期望的格式）
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('module');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('createdAt'); // 驼峰，不是 created_at
      expect(task).toHaveProperty('updatedAt'); // 驼峰，不是 updated_at

      // 验证类型
      expect(typeof task.id).toBe('string');
      expect(typeof task.createdAt).toBe('number');
    });

    it('Agent 设置返回正确的字段格式', async () => {
      const response = await fetch(`${API_BASE}/api/settings/agents`);
      const agents = await response.json();

      expect(agents.length).toBe(3);
      const claude = agents.find((a: { id: string }) => a.id === 'claude');
      expect(claude).toBeDefined();
      expect(claude).toHaveProperty('id');
      expect(claude).toHaveProperty('name');
      expect(claude).toHaveProperty('avatar');
      expect(claude).toHaveProperty('role');
      expect(claude).toHaveProperty('model');
    });

    it('聊天消息返回正确的字段格式', async () => {
      // 先创建任务
      const taskRes = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'chat-test' }),
      });
      const task = await taskRes.json();

      // 发送消息
      const msgRes = await fetch(`${API_BASE}/api/chat/${task.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      });
      const message = await msgRes.json();

      // 验证字段
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('taskId');
      expect(message).toHaveProperty('role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('timestamp');
      expect(typeof message.timestamp).toBe('number');
    });
  });
});
