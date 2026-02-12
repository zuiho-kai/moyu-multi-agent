/**
 * 操作日志记录器
 * 记录所有 Agent 操作到日志文件，支持工作流节点追踪
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import type { LogEntry } from './types.js';

export interface OperationLog {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  operation: string;
  nodeId?: string;           // 工作流节点 ID
  nodeName?: string;         // 工作流节点名称
  input?: unknown;
  output?: unknown;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'parallel' | 'loop';
  agentId?: string;
  description?: string;
  next?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  startNode: string;
}

export class OperationLogger {
  private logDir: string;
  private logs: OperationLog[] = [];
  private workflows: Map<string, Workflow> = new Map();
  private activeOperations: Map<string, { startTime: number; log: OperationLog }> = new Map();

  constructor(logDir: string = './logs/operations') {
    this.logDir = logDir;
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 开始记录操作
   */
  startOperation(params: {
    agentId: string;
    agentName: string;
    operation: string;
    nodeId?: string;
    nodeName?: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
  }): string {
    const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const log: OperationLog = {
      id,
      timestamp: Date.now(),
      agentId: params.agentId,
      agentName: params.agentName,
      operation: params.operation,
      nodeId: params.nodeId,
      nodeName: params.nodeName,
      input: params.input,
      status: 'started',
      metadata: params.metadata,
    };

    this.logs.push(log);
    this.activeOperations.set(id, { startTime: Date.now(), log });
    this.writeLog(log);

    return id;
  }

  /**
   * 完成操作
   */
  completeOperation(operationId: string, output?: unknown): void {
    const active = this.activeOperations.get(operationId);
    if (!active) return;

    const { startTime, log } = active;
    log.status = 'completed';
    log.output = output;
    log.duration = Date.now() - startTime;

    this.activeOperations.delete(operationId);
    this.writeLog(log);
  }

  /**
   * 操作失败
   */
  failOperation(operationId: string, error: string): void {
    const active = this.activeOperations.get(operationId);
    if (!active) return;

    const { startTime, log } = active;
    log.status = 'failed';
    log.error = error;
    log.duration = Date.now() - startTime;

    this.activeOperations.delete(operationId);
    this.writeLog(log);
  }

  /**
   * 快速记录完整操作
   */
  logOperation(params: Omit<OperationLog, 'id' | 'timestamp'>): void {
    const log: OperationLog = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...params,
    };
    this.logs.push(log);
    this.writeLog(log);
  }

  /**
   * 注册工作流
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * 获取工作流
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * 获取 Agent 的操作历史
   */
  getAgentLogs(agentId: string, limit = 100): OperationLog[] {
    return this.logs
      .filter(log => log.agentId === agentId)
      .slice(-limit);
  }

  /**
   * 获取所有操作日志
   */
  getAllLogs(limit = 500): OperationLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * 获取工作流节点的执行历史
   */
  getNodeLogs(nodeId: string, limit = 50): OperationLog[] {
    return this.logs
      .filter(log => log.nodeId === nodeId)
      .slice(-limit);
  }

  /**
   * 写入日志文件
   */
  private writeLog(log: OperationLog): void {
    const date = new Date(log.timestamp);
    const filename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.jsonl`;
    const filepath = path.join(this.logDir, filename);

    const line = JSON.stringify(log) + '\n';
    appendFileSync(filepath, line, 'utf-8');
  }

  /**
   * 格式化日志为可读文本
   */
  formatLog(log: OperationLog): string {
    const time = new Date(log.timestamp).toISOString();
    const status = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '🔄';
    const duration = log.duration ? ` (${log.duration}ms)` : '';
    const node = log.nodeName ? ` [${log.nodeName}]` : '';

    return `${time} ${status} [${log.agentName}]${node} ${log.operation}${duration}`;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    completed: number;
    failed: number;
    byAgent: Record<string, number>;
    avgDuration: number;
  } {
    const completed = this.logs.filter(l => l.status === 'completed');
    const failed = this.logs.filter(l => l.status === 'failed');

    const byAgent: Record<string, number> = {};
    for (const log of this.logs) {
      byAgent[log.agentId] = (byAgent[log.agentId] || 0) + 1;
    }

    const durations = completed.filter(l => l.duration).map(l => l.duration!);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total: this.logs.length,
      completed: completed.length,
      failed: failed.length,
      byAgent,
      avgDuration: Math.round(avgDuration),
    };
  }
}

// 全局单例
let globalLogger: OperationLogger | null = null;

export function getOperationLogger(logDir?: string): OperationLogger {
  if (!globalLogger) {
    globalLogger = new OperationLogger(logDir);
  }
  return globalLogger;
}

export default OperationLogger;
