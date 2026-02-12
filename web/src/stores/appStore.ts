import { create } from 'zustand'
import type { AppState, AgentType, Agent, Message, Task } from '../types'

const API_BASE = 'http://127.0.0.1:3000/api'

const defaultAgents: Record<AgentType, Agent> = {
  claude: {
    id: 'claude',
    name: '布偶猫',
    avatar: '🐱',
    role: '主架构师，核心开发',
    workflow: '分析需求 → 设计架构 → 编写代码 → 审查',
    model: 'claude-sonnet-4-5-20250929',
    color: 'ragdoll',
    status: 'idle',
  },
  codex: {
    id: 'codex',
    name: '缅因猫',
    avatar: '🐈',
    role: 'Code Review，安全审查',
    workflow: '代码审查 → 安全检查 → 性能分析 → 建议',
    model: 'codex',
    color: 'maine',
    status: 'idle',
  },
  gemini: {
    id: 'gemini',
    name: '暹罗猫',
    avatar: '😺',
    role: '视觉设计，创意',
    workflow: '设计方案 → 原型制作 → 测试 → 文档',
    model: 'gemini-pro',
    color: 'siamese',
    status: 'idle',
  },
}

const initialMessages: Message[] = [
  {
    id: '1',
    agentId: 'system',
    content: '欢迎来到猫咖工作室！三只猫咪已经准备好为您服务了喵～ 使用 @claude @codex @gemini 唤起猫咪执行任务',
    timestamp: new Date(),
  },
]

interface ExtendedAppState extends AppState {
  currentTask: Task | null
  loadTasks: () => Promise<void>
  createTask: (module: string, description: string) => Promise<Task | null>
  loadChatHistory: (taskId: string) => Promise<void>
}

export const useAppStore = create<ExtendedAppState>((set, get) => ({
  agents: defaultAgents,
  messages: initialMessages,
  tasks: [],
  currentTaskId: null,
  settingsOpen: false,

  // 计算属性：当前任务
  get currentTask() {
    const state = get()
    if (!state.currentTaskId) return null
    return state.tasks.find(t => t.id === state.currentTaskId) || null
  },

  // 从 API 加载任务列表
  loadTasks: async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`)
      if (response.ok) {
        const tasks = await response.json()
        set({
          tasks: tasks.map((t: { id: string; module: string; status: string; createdAt: number }) => ({
            id: t.id,
            title: t.module,
            status: t.status === 'pending' ? 'pending' : t.status === 'in_progress' ? 'in-progress' : 'completed',
            assignedTo: [],
            createdAt: new Date(t.createdAt),
          })),
        })
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  },

  // 创建新任务
  createTask: async (module: string, description: string) => {
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, description }),
      })
      if (response.ok) {
        const task = await response.json()
        const newTask: Task = {
          id: task.id,
          title: task.module,
          status: 'pending',
          assignedTo: [],
          createdAt: new Date(task.createdAt),
        }
        set((state) => ({
          tasks: [...state.tasks, newTask],
          currentTaskId: task.id,
        }))
        return newTask
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
    return null
  },

  // 加载聊天历史
  loadChatHistory: async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE}/chat/${taskId}`)
      if (response.ok) {
        const messages = await response.json()
        set({
          messages: messages.map((m: { id: string; role: string; agentId?: string; content: string; timestamp: number }) => ({
            id: m.id,
            agentId: m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : (m.agentId || 'claude'),
            content: m.content,
            timestamp: new Date(m.timestamp),
          })),
        })
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  },

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

  setCurrentTask: (id) => {
    set({ currentTaskId: id })
    // 加载该任务的聊天历史
    if (id) {
      get().loadChatHistory(id)
    }
  },

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setAgentStatus: (id, status, currentTask) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: { ...state.agents[id], status, currentTask },
      },
    })),
}))
