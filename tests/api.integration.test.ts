/**
 * API 服务器集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiServer } from '../src/api/server.js';

describe('ApiServer 集成测试', () => {
  let server: ApiServer;
  const port = 3001; // 使用不同端口避免冲突

  beforeAll(async () => {
    server = new ApiServer({ port, host: '127.0.0.1' });

    // 注册测试数据
    server.registerAgent({
      config: { id: 'test-agent', type: 'claude', name: 'Test Agent' },
      status: 'idle',
    });

    server.registerTask({
      id: 'test-task',
      module: 'test',
      description: 'Test task',
      prompt: 'Test',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await server.start();
  });

  afterAll(() => {
    // Server doesn't have a stop method, but tests will end
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

  describe('GET /api/agents', () => {
    it('should return agent list', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/agents`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
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
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update task status', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks/test-task`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('in_progress');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks/non-existent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      expect(response.status).toBe(404);
    });
  });
});
