import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Database, Bot } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { AgentType, Agent } from '../types'

const API_BASE = 'http://127.0.0.1:3000/api'

const avatarOptions = ['🐱', '🦁', '🐈', '🐯', '🐱‍👤', '😺', '😸', '🙀', '😻', '🐈‍⬛']

const modelOptions = [
  'claude-sonnet-4-5-20250929',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'codex',
  'gemini-pro',
  'gemini-ultra',
  'gpt-4',
  'gpt-4-turbo',
]

const providerOptions = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT/Codex)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'custom', label: '自定义 API' },
]

interface Resource {
  id: string
  name: string
  provider: string
  model: string
  apiKey: string | null
  apiBase: string | null
  isDefault: boolean
}

function AgentSettings({ agent, onUpdate }: { agent: Agent; onUpdate: (updates: Partial<Agent>) => Promise<void> }) {
  const [localAgent, setLocalAgent] = useState(agent)
  const [saving, setSaving] = useState(false)

  // 当 agent prop 变化时同步本地状态
  useEffect(() => {
    setLocalAgent(agent)
  }, [agent])

  const handleChange = <K extends keyof Agent>(key: K, value: Agent[K]) => {
    setLocalAgent((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(localAgent)
    } finally {
      setSaving(false)
    }
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
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-cafe-mocha text-white py-2 rounded-lg hover:bg-cafe-espresso transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  )
}

function ResourcePoolSettings() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newResource, setNewResource] = useState({
    name: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: '',
    apiBase: '',
    isDefault: false,
  })

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    try {
      const response = await fetch(`${API_BASE}/resources`)
      if (response.ok) {
        const data = await response.json()
        setResources(data)
      }
    } catch (error) {
      console.error('Failed to load resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddResource = async () => {
    if (!newResource.name || !newResource.model) return

    try {
      const response = await fetch(`${API_BASE}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResource),
      })
      if (response.ok) {
        await loadResources()
        setShowAddForm(false)
        setNewResource({
          name: '',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
          apiKey: '',
          apiBase: '',
          isDefault: false,
        })
      }
    } catch (error) {
      console.error('Failed to add resource:', error)
    }
  }

  const handleDeleteResource = async (id: string) => {
    if (!confirm('确定要删除这个资源吗？')) return

    try {
      const response = await fetch(`${API_BASE}/resources/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadResources()
      }
    } catch (error) {
      console.error('Failed to delete resource:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-cafe-espresso flex items-center gap-2">
          <Database size={18} />
          API 资源池
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 bg-cafe-mocha text-white rounded-lg hover:bg-cafe-espresso transition-colors text-sm"
        >
          <Plus size={16} />
          添加资源
        </button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="border-2 border-dashed border-cafe-latte rounded-xl p-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
              <input
                type="text"
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent"
                placeholder="例如：我的 Claude API"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">提供商</label>
              <select
                value={newResource.provider}
                onChange={(e) => setNewResource({ ...newResource, provider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent bg-white"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
              <select
                value={newResource.model}
                onChange={(e) => setNewResource({ ...newResource, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent bg-white"
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={newResource.apiKey}
                onChange={(e) => setNewResource({ ...newResource, apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent"
                placeholder="sk-..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL (可选)</label>
              <input
                type="text"
                value={newResource.apiBase}
                onChange={(e) => setNewResource({ ...newResource, apiBase: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cafe-mocha focus:border-transparent"
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={newResource.isDefault}
                onChange={(e) => setNewResource({ ...newResource, isDefault: e.target.checked })}
                className="rounded border-gray-300 text-cafe-mocha focus:ring-cafe-mocha"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                设为默认资源
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddResource}
              className="flex-1 flex items-center justify-center gap-2 bg-cafe-mocha text-white py-2 rounded-lg hover:bg-cafe-espresso transition-colors"
            >
              <Save size={18} />
              保存
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 资源列表 */}
      {resources.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-cafe-latte rounded-xl">
          <Database size={32} className="mx-auto mb-2 opacity-50" />
          <p>暂无 API 资源</p>
          <p className="text-sm mt-1">点击上方按钮添加</p>
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-cafe-latte"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cafe-cream flex items-center justify-center">
                  <Bot size={20} className="text-cafe-mocha" />
                </div>
                <div>
                  <div className="font-medium text-cafe-espresso flex items-center gap-2">
                    {resource.name}
                    {resource.isDefault && (
                      <span className="text-xs bg-cafe-mocha text-white px-2 py-0.5 rounded-full">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {resource.provider} / {resource.model}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteResource(resource.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettingsModal() {
  const { agents, updateAgent, toggleSettings, loadAgentSettings } = useAppStore()
  const [activeTab, setActiveTab] = useState<'agents' | 'resources'>('agents')
  const [activeAgent, setActiveAgent] = useState<AgentType>('claude')

  // 组件加载时从后端加载 Agent 设置
  useEffect(() => {
    loadAgentSettings()
  }, [loadAgentSettings])

  const handleUpdate = async (agentId: AgentType, updates: Partial<Agent>) => {
    await updateAgent(agentId, updates)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cafe-cream rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="bg-cafe-espresso text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>⚙️</span> 设置
          </h2>
          <button
            onClick={toggleSettings}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 主 Tab 切换 */}
        <div className="flex border-b border-cafe-latte bg-white">
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'agents'
                ? 'bg-cafe-latte border-b-2 border-cafe-mocha'
                : 'hover:bg-cafe-cream'
            }`}
          >
            <Bot size={18} />
            <span className="font-medium">Agent 设置</span>
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'resources'
                ? 'bg-cafe-latte border-b-2 border-cafe-mocha'
                : 'hover:bg-cafe-cream'
            }`}
          >
            <Database size={18} />
            <span className="font-medium">资源池</span>
          </button>
        </div>

        {/* 设置内容 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'agents' ? (
            <>
              {/* Agent Tab 切换 */}
              <div className="flex gap-2 mb-4">
                {Object.values(agents).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgent(agent.id)}
                    className={`flex-1 px-3 py-2 flex items-center justify-center gap-2 rounded-lg transition-colors ${
                      activeAgent === agent.id
                        ? 'bg-cafe-mocha text-white'
                        : 'bg-white hover:bg-cafe-latte border border-cafe-latte'
                    }`}
                  >
                    <span className="text-lg">{agent.avatar}</span>
                    <span className="font-medium hidden sm:inline">
                      {agent.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
              <AgentSettings
                agent={agents[activeAgent]}
                onUpdate={(updates) => handleUpdate(activeAgent, updates)}
              />
            </>
          ) : (
            <ResourcePoolSettings />
          )}
        </div>

        {/* 底部说明 */}
        <div className="px-6 py-4 bg-white/50 border-t border-cafe-latte text-center text-sm text-gray-500">
          {activeTab === 'agents'
            ? '设置会保存到数据库，刷新页面后仍然有效喵～'
            : 'API 资源会保存到数据库，可供所有 Agent 使用'}
        </div>
      </div>
    </div>
  )
}
