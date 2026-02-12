/**
 * 日志系统模块
 * 支持多 Agent 日志汇总与全局日志管理
 */

import winston from 'winston';
import path from 'path';
import type { LogEntry } from './types.js';

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

// 日志目录配置
const LOG_DIR = process.env.LOG_DIR || 'logs';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

// 自定义日志格式
const logFormat = printf(({ level, message, timestamp, agentId, module }) => {
  const agent = agentId ? `[${agentId}]` : '[system]';
  return `${timestamp} ${level.toUpperCase().padEnd(5)} ${agent} [${module}] ${message}`;
});

// 日志级别映射
type LogLevel = LogEntry['level'];

/**
 * Agent 专用日志器
 */
class AgentLogger {
  private logger: winston.Logger;
  private agentId: string;
  private moduleName: string;

  constructor(agentId: string, moduleName: string, globalLogger: winston.Logger) {
    this.agentId = agentId;
    this.moduleName = moduleName;

    // 创建 Agent 专用日志器
    this.logger = createLogger({
      level: 'debug',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      ),
      defaultMeta: { agentId, module: moduleName },
      transports: [
        // Agent 独立日志文件（按大小轮转）
        new transports.File({
          filename: path.join(LOG_DIR, 'agents', `${agentId}.log`),
          maxsize: MAX_FILE_SIZE,
          maxFiles: MAX_FILES,
          tailable: true,
        }),
        // Agent 错误日志
        new transports.File({
          filename: path.join(LOG_DIR, 'agents', `${agentId}.error.log`),
          level: 'error',
          maxsize: MAX_FILE_SIZE,
          maxFiles: MAX_FILES,
        }),
      ],
    });

    // 同时写入全局日志
    this.logger.on('data', (info) => {
      globalLogger.log(info);
    });
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const meta = data ? { data } : {};
    this.logger.log(level, message, meta);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * 创建子模块日志器
   */
  child(subModule: string): AgentLogger {
    const newLogger = Object.create(this) as AgentLogger;
    newLogger.moduleName = `${this.moduleName}:${subModule}`;
    return newLogger;
  }

  /**
   * 转换为 LogEntry 格式
   */
  toLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      agentId: this.agentId,
      module: this.moduleName,
      message,
      data,
    };
  }
}

/**
 * 日志管理器
 * 管理所有日志实例，支持多 Agent 日志汇总
 */
export class LogManager {
  private static instance: LogManager;
  private globalLogger: winston.Logger;
  private agentLoggers: Map<string, AgentLogger> = new Map();
  private logDir: string;

  private constructor(logDir: string = LOG_DIR) {
    this.logDir = logDir;

    // 创建全局日志器
    this.globalLogger = createLogger({
      level: 'debug',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      ),
      defaultMeta: { module: 'global' },
      transports: [
        // 全局日志文件（按日期轮转）
        new transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: MAX_FILE_SIZE,
          maxFiles: MAX_FILES,
          tailable: true,
        }),
        // 全局错误日志
        new transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: MAX_FILE_SIZE,
          maxFiles: MAX_FILES,
        }),
        // 控制台输出（开发环境）
        new transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp({ format: 'HH:mm:ss.SSS' }),
            logFormat
          ),
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        }),
      ],
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(logDir?: string): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager(logDir);
    }
    return LogManager.instance;
  }

  /**
   * 获取或创建 Agent 日志器
   */
  getAgentLogger(agentId: string, moduleName: string = 'agent'): AgentLogger {
    const key = `${agentId}:${moduleName}`;

    if (!this.agentLoggers.has(key)) {
      const logger = new AgentLogger(agentId, moduleName, this.globalLogger);
      this.agentLoggers.set(key, logger);
    }

    return this.agentLoggers.get(key)!;
  }

  /**
   * 获取全局日志器（用于系统级日志）
   */
  getGlobalLogger(moduleName: string = 'system'): winston.Logger {
    return this.globalLogger.child({ module: moduleName });
  }

  /**
   * 记录系统日志
   */
  log(level: LogLevel, module: string, message: string, data?: unknown): void {
    const meta: Record<string, unknown> = { module };
    if (data) meta.data = data;
    this.globalLogger.log(level, message, meta);
  }

  /**
   * 获取所有已注册的 Agent ID
   */
  getRegisteredAgents(): string[] {
    const agents = new Set<string>();
    for (const key of this.agentLoggers.keys()) {
      agents.add(key.split(':')[0]);
    }
    return Array.from(agents);
  }

  /**
   * 移除 Agent 日志器
   */
  removeAgentLogger(agentId: string): void {
    for (const key of this.agentLoggers.keys()) {
      if (key.startsWith(`${agentId}:`)) {
        this.agentLoggers.delete(key);
      }
    }
  }

  /**
   * 关闭所有日志器
   */
  async close(): Promise<void> {
    this.agentLoggers.clear();
    await new Promise<void>((resolve) => {
      this.globalLogger.on('finish', resolve);
      this.globalLogger.end();
    });
  }

  /**
   * 获取日志目录路径
   */
  getLogDir(): string {
    return this.logDir;
  }
}

// 导出便捷函数
export const getLogManager = LogManager.getInstance;

export function createAgentLogger(agentId: string, moduleName?: string): AgentLogger {
  return LogManager.getInstance().getAgentLogger(agentId, moduleName);
}

export function systemLog(level: LogLevel, module: string, message: string, data?: unknown): void {
  LogManager.getInstance().log(level, module, message, data);
}
