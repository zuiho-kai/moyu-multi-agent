/**
 * API 服务器集成测试
 * 适配新的数据库持久化 API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiServer } from '../src/api/server.js';
import { existsSync, rmSync } from 'fs';

describe('ApiServer 集成测试', () => {
  let server: ApiServer;
  const port = 3099; // 使用不同端口避免冲突
  const testDbPath = './data/test-api.db';

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
    // 清理测试数据库
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('GET /api/status', () => {
    it('should return system status', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('running');
      expect(data.agents).toBeDefined();
      expect(data.tasks).toBeDefined();
    });
  });

  describe('GET /api/settings/agents', () => {
    it('should return agent settings list', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/settings/agents`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      // 默认有三个 Agent
      expect(data.length).toBe(3);
    });
  });

  describe('GET /api/tasks', () => {
    it('should return task list', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create new task', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'new-module',
          description: 'New task',
          prompt: 'Do something new',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.module).toBe('new-module');
      expect(data.status).toBe('pending');
    });

    it('should reject invalid task', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('资源池 API', () => {
    it('should create and list resources', async () => {
      // 创建资源
      const createResponse = await fetch(`http://127.0.0.1:${port}/api/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test API',
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        }),
      });
      const created = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(created.name).toBe('Test API');
      expect(created.apiKey).toBe('***'); // API Key 应该被隐藏

      // 列出资源
      const listResponse = await fetch(`http://127.0.0.1:${port}/api/resources`);
      const resources = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(resources.length).toBeGreaterThan(0);
    });
  });

  describe('记忆系统 API', () => {
    it('should save and retrieve memories', async () => {
      const agentId = 'claude';

      // 保存记忆
      const saveResponse = await fetch(`http://127.0.0.1:${port}/api/memory/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'working',
          content: 'Test memory content',
        }),
      });
      const saved = await saveResponse.json();

      expect(saveResponse.status).toBe(201);
      expect(saved.content).toBe('Test memory content');

      // 获取记忆
      const getResponse = await fetch(`http://127.0.0.1:${port}/api/memory/${agentId}`);
      const memories = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(memories.length).toBeGreaterThan(0);
    });
  });
});
