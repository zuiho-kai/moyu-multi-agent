import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { AgentType, Agent } from '../types'

const avatarOptions = ['🐱', '🦁', '🐈', '🐯', '🐱‍👤', '😺', '😸', '🙀', '😻', '🐈‍⬛']

const modelOptions = [
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'codex-latest',
  'gemini-pro',
  'gemini-ultra',
  'gpt-4',
  'gpt-4-turbo',
]

function AgentSettings({ agent, onUpdate }: { agent: Agent; onUpdate: (updates: Partial<Agent>) => void }) {
  const [localAgent, setLocalAgent] = useState(agent)

  const handleChange = <K extends keyof Agent>(key: K, value: Agent[K]) => {
    setLocalAgent((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onUpdate(localAgent)
  }

  const agentColorMap: Record<AgentType, string> = {
    claude: 'border-ragdoll-300 bg-ragdoll-50',
    codex: 'border-maine-300 bg-maine-50',
    gemini: 'border-siamese-300 bg-siamese-50',
  }

  return (
    <div className={`border-2 rounded-xl p-4 ${agentColorMap[agent.id]}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">{localAgent.avatar}</div>
        <div className="flex-1">
          <input
            type="text"
            value={localAgent.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full font-semibold text-lg bg-transparent border-b border-gray-300 focus:border-cafe-mocha focus:outline-none pb-1"
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* 头像选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">头像</label>
          <div className="flex flex-wrap gap-2">
            {avatarOptions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleChange('avatar', emoji)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                  localAgent.avatar === emoji
                    ? 'bg-cafe-mocha text-white scale-110'
                    : 'bg-white hover:bg-cafe-latte'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 职责 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">职责</label>
          <input
            type="text"
            value={localAgent.role}
            onChange={(e) => handleChange('role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent"
            placeholder="例如：架构师 & 代码审查"
          />
        </div>

        {/* 工作流程 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">工作流程</label>
          <textarea
            value={localAgent.workflow}
            onChange={(e) => handleChange('workflow', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent resize-none"
            rows={2}
            placeholder="描述这个 Agent 的工作流程..."
          />
        </div>

        {/* 使用模型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">使用模型</label>
          <select
            value={localAgent.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent bg-white"
          >
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-cafe-mocha text-white py-2 rounded-lg hover:bg-cafe-espresso transition-colors"
        >
          <Save size={18} />
          保存设置
        </button>
      </div>
    </div>
  )
}

export default function SettingsModal() {
  const { agents, updateAgent, toggleSettings } = useAppStore()
  const [activeTab, setActiveTab] = useState<AgentType>('claude')

  const handleUpdate = (agentId: AgentType, updates: Partial<Agent>) => {
    updateAgent(agentId, updates)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cafe-cream rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="bg-cafe-espresso text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>⚙️</span> Agent 设置
          </h2>
          <button
            onClick={toggleSettings}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-cafe-latte bg-white">
          {Object.values(agents).map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveTab(agent.id)}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                activeTab === agent.id
                  ? 'bg-cafe-latte border-b-2 border-cafe-mocha'
                  : 'hover:bg-cafe-cream'
              }`}
            >
              <span className="text-xl">{agent.avatar}</span>
              <span className="font-medium text-cafe-espresso hidden sm:inline">
                {agent.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* 设置内容 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AgentSettings
            agent={agents[activeTab]}
            onUpdate={(updates) => handleUpdate(activeTab, updates)}
          />
        </div>

        {/* 底部说明 */}
        <div className="px-6 py-4 bg-white/50 border-t border-cafe-latte text-center text-sm text-gray-500">
          设置会自动保存到本地，刷新页面后仍然有效喵～
        </div>
      </div>
    </div>
  )
}
