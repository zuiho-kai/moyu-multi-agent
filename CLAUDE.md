# Cat Café Multi-Agent 项目文档

> 多 Agent 协作系统，支持 Claude/Codex/Gemini 三猫协作开发

## 项目架构

```
cat-cafe-multi-agent/
├── src/                          # 后端源代码 (TypeScript + Express)
│   ├── core/                     # 核心模块
│   │   ├── types.ts              # 统一类型定义
│   │   ├── scheduler.ts          # Agent 调度器（任务队列、并发控制、依赖解析）
│   │   ├── agent-executor.ts     # Agent 执行器（调用 CLI、流式输出）
│   │   ├── database.ts           # SQLite 数据库（任务、聊天、记忆、执行历史）
│   │   ├── git-manager.ts        # Git 操作（Worktree、自动提交、冲突检测）
│   │   ├── operation-logger.ts   # 操作日志（工作流节点追踪）
│   │   └── logger.ts             # 日志管理
│   ├── agents/                   # Agent 实现
│   │   ├── claude-agent.ts       # Claude Agent
│   │   ├── codex-agent.ts        # Codex Agent
│   │   └── gemini-agent.ts       # Gemini Agent
│   ├── api/                      # API 服务
│   │   └── server.ts             # Express 路由（REST + SSE）
│   ├── utils/                    # 工具函数
│   │   └── cli-spawn.ts          # CLI 子进程管理
│   ├── index.ts                  # 主入口（MultiAgentSystem 类）
│   └── server.ts                 # 服务器启动脚本
├── tests/                        # 测试套件 (Vitest)
│   ├── scheduler.test.ts         # 调度器单元测试 (12 tests)
│   ├── api.integration.test.ts   # API 集成测试 (17 tests)
│   ├── e2e.test.ts               # 端到端测试 (14 tests)
│   ├── git-manager.test.ts       # Git 管理器测试 (12 tests)
│   └── cli-spawn.test.ts         # CLI 生成测试
├── web/                          # 前端应用 (React 18 + Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/           # React 组件
│   │   │   ├── ChatArea.tsx      # 聊天区域
│   │   │   ├── Sidebar.tsx       # 侧边栏（频道列表）
│   │   │   ├── AgentPanel.tsx    # Agent 状态面板
│   │   │   └── SettingsModal.tsx # 设置模态框
│   │   ├── stores/appStore.ts    # Zustand 状态管理
│   │   ├── types/index.ts        # 前端类型定义
│   │   ├── App.tsx               # 主应用组件
│   │   └── main.tsx              # 前端入口
│   ├── e2e/                      # Playwright E2E 测试
│   └── playwright.config.ts      # Playwright 配置
├── data/catcafe.db               # SQLite 数据库
├── logs/operations/              # 操作日志目录
├── dist/                         # 编译输出
├── package.json                  # 后端依赖
├── tsconfig.json                 # TypeScript 配置
└── vitest.config.ts              # Vitest 配置
```

## 三猫 Agent

| Agent | 名称 | 角色 | 模型 | 长期记忆 |
|-------|------|------|------|----------|
| claude | 布偶猫 🐱 | 主架构师，核心开发 | claude-sonnet-4-5-20250929 | ✅ 支持 |
| codex | 缅因猫 🐈 | Code Review，安全审查 | codex | ✅ 支持 |
| gemini | 暹罗猫 😺 | 视觉设计，创意 | gemini-pro | ✅ 支持 |

## 四层记忆系统

每个 Agent 都有独立的四层记忆系统，存储在 SQLite 数据库中：

| 类型 | 说明 | 过期时间 |
|------|------|----------|
| `working` | 工作记忆，当前任务上下文 | 任务结束后清理 |
| `short_term` | 短期记忆，最近对话摘要 | 可配置（默认 24h） |
| `long_term` | 长期记忆，重要知识和经验 | 永久保存 |
| `external` | 外部记忆，文档和参考资料 | 永久保存 |

**API 端点**:
- `GET /api/memory/:agentId` - 获取 Agent 记忆
- `POST /api/memory/:agentId` - 保存记忆

## 启动命令

```bash
# 构建后端
npm run build

# 启动后端 API (http://127.0.0.1:3000)
node dist/server.js

# 启动前端 (http://127.0.0.1:5173)
cd web && npx vite --host 127.0.0.1 --port 5173

# 运行测试
npm test

# 运行 E2E 测试
cd web && npx playwright test
```

## API 端点

### 任务管理
- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 任务列表
- `GET /api/tasks/:id` - 获取任务
- `PATCH /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 聊天与执行
- `GET /api/chat/:taskId` - 获取聊天历史
- `POST /api/chat/:taskId` - 发送消息
- `POST /api/chat/:taskId/execute` - 执行 Agent（触发 CLI 调用）
- `GET /api/chat/:taskId/stream/:streamId` - SSE 流式响应

### Agent 设置
- `GET /api/settings/agents` - 获取所有 Agent 设置
- `GET /api/settings/agents/:id` - 获取单个 Agent
- `PUT /api/settings/agents/:id` - 更新 Agent 设置

### 系统状态
- `GET /api/status` - 系统状态（Agent 列表、任务统计、执行历史）
- `GET /api/executions` - 执行历史
- `GET /api/logs/operations` - 操作日志

### 资源池
- `GET /api/resources` - 获取资源池
- `POST /api/resources` - 创建资源
- `DELETE /api/resources/:id` - 删除资源

## 测试覆盖

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| scheduler.test.ts | 12 | 任务队列、并发控制、依赖解析、健康检查 |
| api.integration.test.ts | 17 | 任务 CRUD、聊天消息、Agent 执行 |
| e2e.test.ts | 14 | 完整用户流程、前端数据格式验证 |
| git-manager.test.ts | 12 | Worktree 操作、分支管理、冲突检测 |
| **总计** | **55** | 全部通过 ✅ |

运行测试: `npm test`

## 开发规范

### 代码提交流程
1. 修改代码
2. 运行测试: `npm test` (必须全部通过)
3. 代码 Review (缅因猫负责)
4. Review 通过后才能合入 Git
5. 提交格式: `[模块]-[agentId]: [描述]`

### 操作日志
所有 Agent 操作都会记录到 `logs/operations/` 目录和数据库中：
- 任务创建/更新/删除
- Agent 执行开始/完成/失败
- 工作流节点追踪

### 安全规范
- 使用 `spawn` + `stdin` 传递 prompt（避免命令注入）
- 不在命令行参数中传递敏感信息
- API 输入验证

## Git 管理

- 主分支: `dev`
- 提交格式: `[模块]-[agentId]: [描述]`
- 支持 Worktree 多分支并行开发
- 自动提交功能（可配置）

## 已知问题

- Agent 执行超时默认 5 分钟，可在 `agent-executor.ts` 中配置
- Windows 上需要通过 stdin 传递 prompt（已修复）

## 更新日志

### 2026-02-12
- 修复 Windows 上 Agent 执行卡住问题（改用 stdin 传递 prompt）
- 完善项目文档
- 测试全部通过 (55 tests)
