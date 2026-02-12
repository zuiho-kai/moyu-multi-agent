/**
 * Agent 调度器单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentScheduler } from '../src/core/scheduler.js';
import type { TaskDefinition, AgentConfig } from '../src/core/types.js';

describe('AgentScheduler', () => {
  let scheduler: AgentScheduler;

  beforeEach(() => {
    scheduler = new AgentScheduler({
      maxConcurrentAgents: 3,
      healthCheckInterval: 60000,
      logSyncInterval: 60000,
    });
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('任务队列管理', () => {
    it('should add task to queue', () => {
      const task: TaskDefinition = {
        id: 'task-1',
        module: 'test-module',
        description: 'Test task',
        prompt: 'Do something',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      scheduler.addTask(task);

      expect(scheduler.getTask('task-1')).toBeDefined();
      expect(scheduler.getAllTasks()).toHaveLength(1);
    });

    it('should reject duplicate task', () => {
      const task: TaskDefinition = {
        id: 'task-1',
        module: 'test',
        description: 'Test',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      scheduler.addTask(task);
      expect(() => scheduler.addTask(task)).toThrow('already exists');
    });

    it('should update task status', () => {
      const task: TaskDefinition = {
        id: 'task-1',
        module: 'test',
        description: 'Test',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      scheduler.addTask(task);
      scheduler.updateTaskStatus('task-1', 'in_progress');

      expect(scheduler.getTask('task-1')?.status).toBe('in_progress');
    });

    it('should get pending tasks', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test 1',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.addTask({
        id: 'task-2',
        module: 'test',
        description: 'Test 2',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.updateTaskStatus('task-1', 'completed');

      expect(scheduler.getPendingTasks()).toHaveLength(1);
      expect(scheduler.getPendingTasks()[0].id).toBe('task-2');
    });
  });

  describe('并发控制', () => {
    it('should respect max concurrent agents', () => {
      expect(scheduler.canStartNewAgent()).toBe(true);
      expect(scheduler.getRunningAgentCount()).toBe(0);
    });

    it('should update max concurrent agents', () => {
      scheduler.setMaxConcurrentAgents(10);
      expect(scheduler.canStartNewAgent()).toBe(true);
    });

    it('should reject invalid max value', () => {
      expect(() => scheduler.setMaxConcurrentAgents(0)).toThrow();
      expect(() => scheduler.setMaxConcurrentAgents(-1)).toThrow();
    });
  });

  describe('Agent 实例管理', () => {
    it('should register agent', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude',
        name: '布偶猫',
      };

      const instance = scheduler.registerAgent(config);

      expect(instance.config.id).toBe('agent-1');
      expect(instance.status).toBe('idle');
      expect(scheduler.getAgent('agent-1')).toBeDefined();
    });

    it('should reject duplicate agent', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude',
        name: '布偶猫',
      };

      scheduler.registerAgent(config);
      expect(() => scheduler.registerAgent(config)).toThrow('already registered');
    });

    it('should list all agents', () => {
      scheduler.registerAgent({ id: 'agent-1', type: 'claude', name: 'Claude' });
      scheduler.registerAgent({ id: 'agent-2', type: 'codex', name: 'Codex' });

      expect(scheduler.getAllAgents()).toHaveLength(2);
    });

    it('should unregister idle agent', () => {
      scheduler.registerAgent({ id: 'agent-1', type: 'claude', name: 'Claude' });

      expect(scheduler.unregisterAgent('agent-1')).toBe(true);
      expect(scheduler.getAgent('agent-1')).toBeUndefined();
    });
  });

  describe('任务依赖解析', () => {
    it('should detect ready tasks without dependencies', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(scheduler.getReadyTasks()).toHaveLength(1);
    });

    it('should block tasks with unmet dependencies', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test 1',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.addTask({
        id: 'task-2',
        module: 'test',
        description: 'Test 2',
        prompt: 'Test',
        status: 'pending',
        dependencies: ['task-1'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const ready = scheduler.getReadyTasks();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('task-1');
    });

    it('should unblock tasks when dependencies complete', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test 1',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.addTask({
        id: 'task-2',
        module: 'test',
        description: 'Test 2',
        prompt: 'Test',
        status: 'pending',
        dependencies: ['task-1'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.updateTaskStatus('task-1', 'completed');

      const ready = scheduler.getReadyTasks();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('task-2');
    });

    it('should detect circular dependencies', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test 1',
        prompt: 'Test',
        status: 'pending',
        dependencies: ['task-2'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.addTask({
        id: 'task-2',
        module: 'test',
        description: 'Test 2',
        prompt: 'Test',
        status: 'pending',
        dependencies: ['task-1'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(() => scheduler.getTopologicalOrder()).toThrow('Circular dependency');
    });
  });

  describe('进度监控', () => {
    it('should return correct progress', () => {
      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test 1',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.addTask({
        id: 'task-2',
        module: 'test',
        description: 'Test 2',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      scheduler.updateTaskStatus('task-1', 'completed');

      const progress = scheduler.getProgress();
      expect(progress.total).toBe(2);
      expect(progress.pending).toBe(1);
      expect(progress.completed).toBe(1);
    });
  });

  describe('事件发射', () => {
    it('should emit taskAdded event', () => {
      const handler = vi.fn();
      scheduler.on('taskAdded', handler);

      scheduler.addTask({
        id: 'task-1',
        module: 'test',
        description: 'Test',
        prompt: 'Test',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
