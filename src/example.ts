/**
 * 示例：启动多 Agent 协作开发
 *
 * 演示如何使用 MultiAgentSystem 进行并发模块开发
 */

import MultiAgentSystem from './index.js';
import path from 'path';

const PROJECT_ROOT = process.cwd();

// 模块定义
const MODULES = [
  { name: 'web-api', description: '网页端 API 接口' },
  { name: 'discord-bot', description: 'Discord Bot 集成' },
  { name: 'log-system', description: '日志系统增强' },
  { name: 'agent-scheduler', description: 'Agent 调度优化' },
  { name: 'git-auto', description: 'Git 自动化工具' },
  { name: 'skill-manager', description: 'Skill 管理模块' },
];

async function main() {
  console.log('='.repeat(60));
  console.log('Cat Café Multi-Agent System - 多实例并发开发');
  console.log('='.repeat(60));

  // 创建系统实例
  const system = new MultiAgentSystem({
    projectRoot: PROJECT_ROOT,
    logDir: path.join(PROJECT_ROOT, 'agents', 'logs'),
    maxConcurrentAgents: 5,
    apiPort: 3000,
    gitAutoCommit: true,
  });

  // 注册默认 Agent（三猫）
  system.registerDefaultAgents();

  // 为每个模块创建任务
  console.log('\n📋 创建开发任务...');
  for (const mod of MODULES) {
    // 创建 Worktree
    const worktreePath = await system.createModuleWorktree(mod.name);

    // 添加任务
    const taskId = system.addTask({
      module: mod.name,
      description: mod.description,
      prompt: generateModulePrompt(mod.name, mod.description),
      worktreePath,
      gitBranch: `feature/${mod.name}`,
    });

    console.log(`  ✅ ${mod.name}: ${taskId}`);
  }

  // 启动系统
  console.log('\n🚀 启动多 Agent 系统...');
  await system.start();

  console.log('\n📊 系统状态:');
  console.log(`  API: http://localhost:3000/api/status`);
  console.log(`  日志: ${PROJECT_ROOT}/agents/logs/`);

  // 监听进度
  system.Scheduler.on('taskCompleted', (task) => {
    console.log(`  ✅ 完成: ${task.module}`);
  });

  system.Scheduler.on('taskFailed', (task, error) => {
    console.log(`  ❌ 失败: ${task.module} - ${error}`);
  });

  // 等待所有任务完成
  await waitForCompletion(system);

  // 汇总结果
  console.log('\n📝 开发总结:');
  const status = system.getStatus();
  console.log(`  总任务: ${status.progress.total}`);
  console.log(`  已完成: ${status.progress.completed}`);
  console.log(`  失败: ${status.progress.failed}`);

  // 合并所有分支
  console.log('\n🔀 合并分支到 dev...');
  for (const mod of MODULES) {
    try {
      const result = await system.Git.mergeBranch(`feature/${mod.name}`);
      if (result.success) {
        console.log(`  ✅ ${mod.name} 合并成功`);
      } else {
        console.log(`  ⚠️ ${mod.name} 有冲突: ${result.conflicts?.length} 个文件`);
      }
    } catch (e) {
      console.log(`  ❌ ${mod.name} 合并失败`);
    }
  }

  await system.stop();
  console.log('\n✨ 多实例开发完成!');
}

function generateModulePrompt(module: string, description: string): string {
  return `
你是多 Agent 协作系统的子代理，负责开发「${module}」模块。

## 任务描述
${description}

## 开发要求
1. 仅修改当前 Worktree 内的文件
2. 遵循项目现有的代码风格和架构
3. 每完成一个功能点，输出简要说明
4. 完成后输出模块测试用例

## Git 提交规则
- 格式: [${module}]-[agentId]：[功能描述]
- 每个功能点单独提交

开始开发吧！
`.trim();
}

async function waitForCompletion(system: MultiAgentSystem): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const status = system.getStatus();
      const pending = status.progress.pending + status.progress.inProgress;
      if (pending === 0) {
        resolve();
      } else {
        setTimeout(check, 5000);
      }
    };
    check();
  });
}

main().catch(console.error);
