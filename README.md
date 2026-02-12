# 🐱 Cat Café Multi-Agent System

多 Agent 协作系统，支持 Claude/Codex/Gemini 三猫协作开发。

## ✨ 特性

- **三猫协作**: 布偶猫(Claude)、缅因猫(Codex)、暹罗猫(Gemini) 各司其职
- **四层记忆系统**: 工作记忆、短期记忆、长期记忆、外部记忆
- **任务调度**: 依赖管理、并发控制、健康检查
- **流式执行**: 实时事件推送，支持 SSE
- **操作日志**: 工作流节点追踪，完整审计
- **Git 集成**: Worktree 多分支并行开发
- **Web UI**: React 18 + TailwindCSS 现代界面

## 🚀 快速开始

```bash
# 安装依赖
npm install
cd web && npm install && cd ..

# 构建
npm run build

# 启动后端 (http://127.0.0.1:3000)
node dist/server.js

# 启动前端 (http://127.0.0.1:5173)
cd web && npx vite
```

## 🐱 三猫 Agent

| Agent | 名称 | 角色 | 模型 |
|-------|------|------|------|
| claude | 布偶猫 🐱 | 主架构师，核心开发 | claude-sonnet-4-5-20250929 |
| codex | 缅因猫 🐈 | Code Review，安全审查 | codex |
| gemini | 暹罗猫 😺 | 视觉设计，创意 | gemini-pro |

## 📦 项目结构

```
cat-cafe-multi-agent/
├── src/                    # 后端 (TypeScript + Express)
│   ├── core/               # 核心模块
│   │   ├── scheduler.ts    # Agent 调度器
│   │   ├── agent-executor.ts # Agent 执行器
│   │   ├── database.ts     # SQLite 数据库
│   │   └── git-manager.ts  # Git 操作
│   ├── agents/             # Agent 实现
│   └── api/                # REST API
├── web/                    # 前端 (React 18 + Vite)
├── tests/                  # 测试套件 (55 tests)
└── CLAUDE.md               # 项目文档
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行 E2E 测试
cd web && npx playwright test
```

## 📝 API 端点

- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 任务列表
- `POST /api/chat/:taskId` - 发送消息
- `POST /api/chat/:taskId/execute` - 执行 Agent
- `GET /api/memory/:agentId` - 获取 Agent 记忆
- `GET /api/status` - 系统状态

## 📄 License

MIT
