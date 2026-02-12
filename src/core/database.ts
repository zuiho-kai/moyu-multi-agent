/**
 * 数据库管理器
 * 使用 SQLite 持久化存储
 */

import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

export interface DbConfig {
  dbPath: string;
}

export interface ChatMessageRow {
  id: string;
  task_id: string;
  role: string;
  agent_id: string | null;
  agent_name: string | null;
  content: string;
  mentions: string | null;
  timestamp: number;
}

export interface TaskRow {
  id: string;
  module: string;
  description: string;
  prompt: string;
  status: string;
  assigned_agent: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface AgentSettingsRow {
  id: string;
  name: string;
  avatar: string;
  role: string;
  model: string;
  workflow: string | null;
  color: string;
  api_key: string | null;
  api_base: string | null;
}

export interface MemoryRow {
  id: string;
  agent_id: string;
  type: string;  // working, short_term, long_term, external
  content: string;
  metadata: string | null;
  created_at: number;
  expires_at: number | null;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor(config: DbConfig = { dbPath: './data/catcafe.db' }) {
    // 确保目录存在
    const dir = path.dirname(config.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    // 聊天消息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        role TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        content TEXT NOT NULL,
        mentions TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_task ON chat_messages(task_id);
      CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
    `);

    // 任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        module TEXT NOT NULL,
        description TEXT,
        prompt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_agent TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status);
    `);

    // Agent 设置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_settings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '🤖',
        role TEXT,
        model TEXT,
        workflow TEXT,
        color TEXT NOT NULL DEFAULT '#6B7280',
        api_key TEXT,
        api_base TEXT
      );
    `);

    // 记忆表（四层记忆）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_memory_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memories(type);
    `);

    // 执行历史表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT,
        tool_calls TEXT,
        status TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_exec_agent ON executions(agent_type);
      CREATE INDEX IF NOT EXISTS idx_exec_time ON executions(start_time);
    `);

    // 资源池表（API 配置）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resource_pool (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key TEXT,
        api_base TEXT,
        is_default INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // 初始化默认 Agent 设置
    this.initDefaultAgents();
  }

  private initDefaultAgents(): void {
    const defaults = [
      { id: 'claude', name: '布偶猫', avatar: '🐱', role: '主架构师，核心开发', model: 'claude-sonnet-4-5-20250929', color: '#8B5CF6' },
      { id: 'codex', name: '缅因猫', avatar: '🐈', role: 'Code Review，安全审查', model: 'codex', color: '#10B981' },
      { id: 'gemini', name: '暹罗猫', avatar: '😺', role: '视觉设计，创意', model: 'gemini-pro', color: '#F59E0B' },
    ];

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO agent_settings (id, name, avatar, role, model, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const agent of defaults) {
      stmt.run(agent.id, agent.name, agent.avatar, agent.role, agent.model, agent.color);
    }
  }

  // ==================== 聊天消息 ====================

  saveMessage(message: {
    id: string;
    taskId: string;
    role: string;
    agentId?: string;
    agentName?: string;
    content: string;
    mentions?: string[];
    timestamp: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, task_id, role, agent_id, agent_name, content, mentions, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.taskId,
      message.role,
      message.agentId || null,
      message.agentName || null,
      message.content,
      message.mentions ? JSON.stringify(message.mentions) : null,
      message.timestamp
    );
  }

  getMessages(taskId: string, limit = 100): ChatMessageRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(taskId, limit) as ChatMessageRow[];
  }

  getRecentMessages(limit = 50): ChatMessageRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(limit) as ChatMessageRow[];
  }

  // ==================== 任务 ====================

  saveTask(task: {
    id: string;
    module: string;
    description?: string;
    prompt?: string;
    status: string;
    assignedAgent?: string;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, module, description, prompt, status, assigned_agent, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      task.id,
      task.module,
      task.description || '',
      task.prompt || '',
      task.status,
      task.assignedAgent || null,
      task.createdAt,
      task.updatedAt,
      task.completedAt || null
    );
  }

  getTask(id: string): TaskRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id) as TaskRow | undefined;
  }

  getAllTasks(): TaskRow[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
    return stmt.all() as TaskRow[];
  }

  updateTaskStatus(id: string, status: string): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET status = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `);
    const completedAt = status === 'completed' ? Date.now() : null;
    stmt.run(status, Date.now(), completedAt, id);
  }

  // ==================== Agent 设置 ====================

  saveAgentSettings(settings: {
    id: string;
    name: string;
    avatar: string;
    role?: string;
    model?: string;
    workflow?: string;
    color: string;
    apiKey?: string;
    apiBase?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_settings (id, name, avatar, role, model, workflow, color, api_key, api_base)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      settings.id,
      settings.name,
      settings.avatar,
      settings.role || null,
      settings.model || null,
      settings.workflow || null,
      settings.color,
      settings.apiKey || null,
      settings.apiBase || null
    );
  }

  getAgentSettings(id: string): AgentSettingsRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_settings WHERE id = ?');
    return stmt.get(id) as AgentSettingsRow | undefined;
  }

  getAllAgentSettings(): AgentSettingsRow[] {
    const stmt = this.db.prepare('SELECT * FROM agent_settings');
    return stmt.all() as AgentSettingsRow[];
  }

  // ==================== 记忆系统 ====================

  saveMemory(memory: {
    id: string;
    agentId: string;
    type: 'working' | 'short_term' | 'long_term' | 'external';
    content: string;
    metadata?: Record<string, unknown>;
    expiresAt?: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, agent_id, type, content, metadata, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      memory.id,
      memory.agentId,
      memory.type,
      memory.content,
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      Date.now(),
      memory.expiresAt || null
    );
  }

  getMemories(agentId: string, type?: string, limit = 100): MemoryRow[] {
    if (type) {
      const stmt = this.db.prepare(`
        SELECT * FROM memories WHERE agent_id = ? AND type = ?
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY created_at DESC LIMIT ?
      `);
      return stmt.all(agentId, type, Date.now(), limit) as MemoryRow[];
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM memories WHERE agent_id = ?
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY created_at DESC LIMIT ?
      `);
      return stmt.all(agentId, Date.now(), limit) as MemoryRow[];
    }
  }

  clearExpiredMemories(): number {
    const stmt = this.db.prepare('DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?');
    const result = stmt.run(Date.now());
    return result.changes;
  }

  // ==================== 资源池 ====================

  saveResource(resource: {
    id: string;
    name: string;
    provider: string;
    model: string;
    apiKey?: string;
    apiBase?: string;
    isDefault?: boolean;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO resource_pool (id, name, provider, model, api_key, api_base, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      resource.id,
      resource.name,
      resource.provider,
      resource.model,
      resource.apiKey || null,
      resource.apiBase || null,
      resource.isDefault ? 1 : 0,
      Date.now()
    );
  }

  getResources(): Array<{
    id: string;
    name: string;
    provider: string;
    model: string;
    apiKey: string | null;
    apiBase: string | null;
    isDefault: boolean;
  }> {
    const stmt = this.db.prepare('SELECT * FROM resource_pool ORDER BY created_at DESC');
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      provider: string;
      model: string;
      api_key: string | null;
      api_base: string | null;
      is_default: number;
      created_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      apiBase: row.api_base,
      isDefault: row.is_default === 1,
    }));
  }

  deleteResource(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM resource_pool WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==================== 执行历史 ====================

  saveExecution(execution: {
    id: string;
    agentType: string;
    prompt: string;
    response?: string;
    toolCalls?: unknown[];
    status: string;
    startTime: number;
    endTime?: number;
    error?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO executions (id, agent_type, prompt, response, tool_calls, status, start_time, end_time, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      execution.id,
      execution.agentType,
      execution.prompt,
      execution.response || null,
      execution.toolCalls ? JSON.stringify(execution.toolCalls) : null,
      execution.status,
      execution.startTime,
      execution.endTime || null,
      execution.error || null
    );
  }

  getExecutions(limit = 100): Array<{
    id: string;
    agentType: string;
    prompt: string;
    response: string | null;
    toolCalls: unknown[] | null;
    status: string;
    startTime: number;
    endTime: number | null;
    error: string | null;
  }> {
    const stmt = this.db.prepare('SELECT * FROM executions ORDER BY start_time DESC LIMIT ?');
    const rows = stmt.all(limit) as Array<{
      id: string;
      agent_type: string;
      prompt: string;
      response: string | null;
      tool_calls: string | null;
      status: string;
      start_time: number;
      end_time: number | null;
      error: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      agentType: row.agent_type,
      prompt: row.prompt,
      response: row.response,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      error: row.error,
    }));
  }

  close(): void {
    this.db.close();
  }
}

// 全局单例
let dbInstance: DatabaseManager | null = null;

export function getDatabase(config?: DbConfig): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager(config);
  }
  return dbInstance;
}

export default DatabaseManager;
