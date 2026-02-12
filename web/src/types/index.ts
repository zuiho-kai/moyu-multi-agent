export type AgentType = 'claude' | 'codex' | 'gemini'

export interface Agent {
  id: AgentType
  name: string
  avatar: string
  role: string
  workflow: string
  model: string
  color: string
  status: 'idle' | 'thinking' | 'working' | 'done'
  currentTask?: string
}

export interface Message {
  id: string
  agentId: AgentType | 'user' | 'system'
  content: string
  timestamp: Date
  mentions?: AgentType[]
  replyTo?: string
}

export interface Task {
  id: string
  title: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  assignedTo?: AgentType[]
  createdAt: Date
  completedAt?: Date
}

export interface AppState {
  agents: Record<AgentType, Agent>
  messages: Message[]
  tasks: Task[]
  currentTaskId: string | null
  settingsOpen: boolean

  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateAgent: (id: AgentType, updates: Partial<Agent>) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  setCurrentTask: (id: string | null) => void
  toggleSettings: () => void
  setAgentStatus: (id: AgentType, status: Agent['status'], currentTask?: string) => void
}
