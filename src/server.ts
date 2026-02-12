/**
 * 启动 API 服务器
 * 访问 http://localhost:3000/api/status 查看系统状态
 */

import { ApiServer } from './api/index.js';
import { AgentScheduler, LogManager } from './core/index.js';

async function main() {
  console.log('🐱 Cat Café Multi-Agent System');
  console.log('================================\n');

  // 初始化日志
  const logManager = LogManager.getInstance('./logs');
  const logger = logManager.getGlobalLogger('main');

  // 初始化调度器
  const scheduler = new AgentScheduler({
    maxConcurrentAgents: 5,
  });

  // 注册示例 Agent
  scheduler.registerAgent({
    id: 'claude-main',
    type: 'claude',
    name: '布偶猫',
    model: 'claude-sonnet-4-5-20250929',
  });

  scheduler.registerAgent({
    id: 'codex-main',
    type: 'codex',
    name: '缅因猫',
  });

  scheduler.registerAgent({
    id: 'gemini-main',
    type: 'gemini',
    name: '暹罗猫',
  });

  // 添加示例任务
  scheduler.addTask({
    id: 'task-1',
    module: 'web-api',
    description: '开发 Web API 模块',
    prompt: '开发 Web API...',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  scheduler.addTask({
    id: 'task-2',
    module: 'discord-bot',
    description: '开发 Discord Bot',
    prompt: '开发 Discord Bot...',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 启动 API 服务器
  const api = new ApiServer({ port: 3000 });

  // 注册 Agent 和任务到 API
  for (const agent of scheduler.getAllAgents()) {
    api.registerAgent(agent);
  }
  for (const task of scheduler.getAllTasks()) {
    api.registerTask(task);
  }

  await api.start();

  console.log('\n✅ 系统已启动！');
  console.log('\n📊 API 端点:');
  console.log('   GET  http://localhost:3000/api/status  - 系统状态');
  console.log('   GET  http://localhost:3000/api/agents  - Agent 列表');
  console.log('   GET  http://localhost:3000/api/tasks   - 任务列表');
  console.log('\n按 Ctrl+C 停止服务器\n');

  logger.info('System started');
}

main().catch(console.error);
