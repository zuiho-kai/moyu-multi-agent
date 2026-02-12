/**
 * 启动 API 服务器
 * 访问 http://localhost:3000/api/status 查看系统状态
 */

import { ApiServer } from './api/index.js';

async function main() {
  console.log('🐱 Cat Café Multi-Agent System');
  console.log('================================\n');

  // 启动 API 服务器（使用数据库持久化）
  const api = new ApiServer({
    port: 3000,
    host: '127.0.0.1',
    dbPath: './data/catcafe.db',
    workdir: process.cwd(),
  });

  await api.start();

  console.log('\n✅ 系统已启动！');
  console.log('\n📊 API 端点:');
  console.log('   GET  http://127.0.0.1:3000/api/status     - 系统状态');
  console.log('   GET  http://127.0.0.1:3000/api/tasks      - 任务列表');
  console.log('   POST http://127.0.0.1:3000/api/tasks      - 创建任务');
  console.log('   GET  http://127.0.0.1:3000/api/chat/:id   - 聊天记录');
  console.log('   POST http://127.0.0.1:3000/api/chat/:id/execute - 执行 Agent');
  console.log('   GET  http://127.0.0.1:3000/api/resources  - 资源池');
  console.log('   GET  http://127.0.0.1:3000/api/executions - 执行历史');
  console.log('\n按 Ctrl+C 停止服务器\n');

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭...');
    api.close();
    process.exit(0);
  });
}

main().catch(console.error);
