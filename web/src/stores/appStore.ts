import { create } from 'zustand'
import type { AppState, AgentType, Agent, Message, Task } from '../types'

const defaultAgents: Record<AgentType, Agent> = {
  claude: {
    id: 'claude',
    name: '小布 (Claude)',
    avatar: '🐱',
    role: '架构师 & 代码审查',
    workflow: '分析需求 → 设计架构 → 审查代码 → 提供建议',
    model: 'claude-3-opus',
    color: 'ragdoll',
    status: 'idle',
  },
  codex: {
    id: 'codex',
    name: '大毛 (Codex)',
    avatar: '🦁',
    role: '全栈开发',
    workflow: '接收任务 → 编写代码 → 单元测试 → 提交审查',
    model: 'codex-latest',
    color: 'maine',
    status: 'idle',
  },
  gemini: {
    id: 'gemini',
    name: '暹暹 (Gemini)',
    avatar: '🐈',
    role: '测试 & 文档',
    workflow: '编写测试 → 执行测试 → 生成文档 → 质量报告',
    model: 'gemini-pro',
    color: 'siamese',
    status: 'idle',
  },
}

const initialMessages: Message[] = [
  {
    id: '1',
    agentId: 'system',
    content: '欢迎来到猫咖工作室！三只猫咪已经准备好为您服务了喵～',
    timestamp: new Date(),
  },
  {
    id: '2',
    agentId: 'claude',
    content: '大家好，我是小布，一只布偶猫。我负责架构设计和代码审查，有什么需要帮忙的吗？',
    timestamp: new Date(),
  },
  {
    id: '3',
    agentId: 'codex',
    content: '嗨！我是大毛，缅因猫一枚。写代码找我就对了！💪',
    timestamp: new Date(),
  },
  {
    id: '4',
    agentId: 'gemini',
    content: '喵～我是暹暹，优雅的暹罗猫。测试和文档是我的专长哦。',
    timestamp: new Date(),
  },
]

const initialTasks: Task[] = [
  {
    id: 't1',
    title: '项目初始化',
    status: 'completed',
    assignedTo: ['claude'],
    createdAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3000000),
  },
  {
    id: 't2',
    title: '前端界面开发',
    status: 'in-progress',
    assignedTo: ['codex', 'claude'],
    createdAt: new Date(Date.now() - 1800000),
  },
  {
    id: 't3',
    title: '编写单元测试',
    status: 'pending',
    assignedTo: ['gemini'],
    createdAt: new Date(),
  },
]

export const useAppStore = create<AppState>((set) => ({
  agents: defaultAgents,
  messages: initialMessages,
  tasks: initialTasks,
  currentTaskId: 't2',
  settingsOpen: false,

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: new Date(),
        },
      ],
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: { ...state.agents[id], ...updates },
      },
    })),

  addTask: (task) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: new Date(),
        },
      ],
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  setCurrentTask: (id) => set({ currentTaskId: id }),

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setAgentStatus: (id, status, currentTask) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: { ...state.agents[id], status, currentTask },
      },
    })),
}))
