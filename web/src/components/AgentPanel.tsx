import { useAppStore } from '../stores/appStore'
import type { AgentType, Agent } from '../types'

const statusLabels: Record<Agent['status'], string> = {
  idle: '空闲中',
  thinking: '思考中...',
  working: '工作中...',
  done: '已完成',
}

const statusColors: Record<Agent['status'], string> = {
  idle: 'bg-gray-300',
  thinking: 'bg-amber-400 status-thinking',
  working: 'bg-green-400 animate-pulse',
  done: 'bg-blue-400',
}

const agentBgColors: Record<AgentType, string> = {
  claude: 'bg-ragdoll-50 border-ragdoll-200',
  codex: 'bg-maine-50 border-maine-200',
  gemini: 'bg-siamese-50 border-siamese-200',
}

function AgentCard({ agent }: { agent: Agent }) {
  const bgColor = agentBgColors[agent.id]

  return (
    <div className={`${bgColor} border rounded-xl p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-sm">
            {agent.avatar}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusColors[agent.status]}`}
            title={statusLabels[agent.status]}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-cafe-espresso truncate">{agent.name}</h3>
          <p className="text-xs text-gray-500">{agent.role}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">状态</span>
          <span className={`font-medium ${agent.status === 'idle' ? 'text-gray-400' : 'text-green-600'}`}>
            {statusLabels[agent.status]}
          </span>
        </div>

        {agent.currentTask && (
          <div className="text-xs bg-white/60 rounded-lg p-2 text-gray-600">
            {agent.currentTask}
          </div>
        )}

        <div className="text-xs text-gray-400">
          模型: {agent.model}
        </div>
      </div>
    </div>
  )
}

export default function AgentPanel() {
  const { agents, messages, tasks } = useAppStore()

  // 统计信息
  const stats = {
    totalMessages: messages.length,
    agentMessages: messages.filter((m) => m.agentId !== 'user' && m.agentId !== 'system').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    totalTasks: tasks.length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="p-4 border-b border-cafe-latte">
        <h2 className="font-semibold text-cafe-espresso flex items-center gap-2">
          <span>🐾</span> Agent 状态
        </h2>
      </div>

      {/* Agent 列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.values(agents).map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-t border-cafe-latte bg-cafe-cream/50">
        <h3 className="text-sm font-semibold text-cafe-espresso mb-3 flex items-center gap-2">
          <span>📊</span> 统计信息
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-cafe-mocha">{stats.totalMessages}</div>
            <div className="text-xs text-gray-500">总消息数</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-cafe-mocha">{stats.agentMessages}</div>
            <div className="text-xs text-gray-500">Agent 回复</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-500">{stats.completedTasks}</div>
            <div className="text-xs text-gray-500">已完成任务</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-500">{stats.totalTasks}</div>
            <div className="text-xs text-gray-500">总任务数</div>
          </div>
        </div>
      </div>
    </div>
  )
}
