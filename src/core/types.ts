/**
 * 核心类型定义
 * 多 Agent 协作系统的统一接口
 */

export type AgentType = 'claude' | 'codex' | 'gemini';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'aborted';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AgentMessage {
  type: 'session_init' | 'text' | 'tool_use' | 'tool_result' | 'error' | 'done';
  agentId: string;
  agentType: AgentType;
  sessionId?: string;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  timestamp: number;
}

export interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  model?: string;
  workdir?: string;
  allowedTools?: string[];
  permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'plan';
  timeout?: number;
}

export interface TaskDefinition {
  id: string;
  module: string;
  description: string;
  prompt: string;
  dependencies?: string[];
  assignedAgent?: string;
  status: TaskStatus;
  gitBranch?: string;
  worktreePath?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  commits?: string[];
  logs?: string[];
}

export interface AgentInstance {
  config: AgentConfig;
  status: AgentStatus;
  pid?: number;
  sessionId?: string;
  currentTask?: string;
  startedAt?: number;
  lastActivity?: number;
  logFile?: string;
  worktreePath?: string;
}

export interface SchedulerConfig {
  maxConcurrentAgents: number;
  taskQueueSize: number;
  healthCheckInterval: number;
  logSyncInterval: number;
  gitAutoCommit: boolean;
}

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  agentId?: string;
  module: string;
  message: string;
  data?: unknown;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
  branch: string;
  files: string[];
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  module: string;
  agentId?: string;
  createdAt: number;
}
