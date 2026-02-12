import { useState, useRef, useEffect } from 'react'
import { Send, AtSign, Loader2, Hash } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { AgentType, Message } from '../types'

const API_BASE = 'http://127.0.0.1:3000/api'

const agentColors: Record<AgentType, string> = {
  claude: 'bg-ragdoll-100 border-ragdoll-300',
  codex: 'bg-maine-100 border-maine-300',
  gemini: 'bg-siamese-100 border-siamese-300',
}

const agentTextColors: Record<AgentType, string> = {
  claude: 'text-ragdoll-700',
  codex: 'text-maine-700',
  gemini: 'text-siamese-700',
}

function MessageBubble({ message }: { message: Message }) {
  const { agents } = useAppStore()

  if (message.agentId === 'system') {
    return (
      <div className="flex justify-center my-3 sm:my-4">
        <div className="bg-cafe-latte/50 text-cafe-espresso/70 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full max-w-[90%] text-center">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.agentId === 'user') {
    return (
      <div className="flex justify-end mb-3 sm:mb-4 message-bubble">
        <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] bg-cafe-mocha text-white px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-br-md shadow-sm">
          <p className="whitespace-pre-wrap text-sm sm:text-base break-words">{message.content}</p>
          <div className="text-xs text-white/60 mt-1 text-right">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    )
  }

  const agent = agents[message.agentId as AgentType]
  const colorClass = agentColors[message.agentId as AgentType] || 'bg-gray-100 border-gray-300'
  const textColorClass = agentTextColors[message.agentId as AgentType] || 'text-gray-700'

  // 解析 @mentions
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const mentionName = part.slice(1).toLowerCase()
        const mentionedAgent = Object.values(agents).find(
          (a) => a.id === mentionName || a.name.toLowerCase().includes(mentionName)
        )
        if (mentionedAgent) {
          return (
            <span key={i} className="mention">
              {part}
            </span>
          )
        }
      }
      return part
    })
  }

  return (
    <div className="flex gap-2 sm:gap-3 mb-3 sm:mb-4 message-bubble">
      <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-cafe-cream flex items-center justify-center text-lg sm:text-xl shadow-sm">
        {agent?.avatar || '🤖'}
      </div>
      <div className="flex-1 min-w-0 max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium text-sm sm:text-base ${textColorClass}`}>{agent?.name || message.agentId}</span>
          <span className="text-xs text-gray-400">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={`${colorClass} border px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-tl-md shadow-sm`}>
          <p className="whitespace-pre-wrap text-gray-800 text-sm sm:text-base break-words">{renderContent(message.content)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatArea() {
  const { messages, agents, currentTaskId, tasks, addMessage, setAgentStatus, setCurrentTask, loadTasks } = useAppStore()
  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    // 检测 @ 符号
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1)
      if (!afterAt.includes(' ')) {
        setShowMentions(true)
        setMentionFilter(afterAt.toLowerCase())
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (agentId: AgentType) => {
    const lastAtIndex = input.lastIndexOf('@')
    const newInput = input.slice(0, lastAtIndex) + `@${agentId} `
    setInput(newInput)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  /**
   * 从消息中提取任务名称
   */
  const extractTaskName = (content: string): string => {
    // 移除 @mentions
    const withoutMentions = content.replace(/@\w+/g, '').trim()
    // 取前 30 个字符作为任务名
    const name = withoutMentions.slice(0, 30)
    return name || `任务-${Date.now()}`
  }

  /**
   * 创建任务并执行 Agent
   */
  const createTaskAndExecute = async (agentId: AgentType, prompt: string) => {
    setAgentStatus(agentId, 'thinking', '正在创建任务...')
    setIsExecuting(true)

    try {
      // 1. 创建任务
      const taskName = extractTaskName(prompt)
      const taskResponse = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: taskName,
          description: prompt,
          prompt: prompt,
        }),
      })

      if (!taskResponse.ok) {
        throw new Error('创建任务失败')
      }

      const task = await taskResponse.json()
      console.log('[ChatArea] Task created:', task)

      // 2. 刷新任务列表
      await loadTasks()

      // 3. 切换到新任务
      setCurrentTask(task.id)

      // 4. 添加系统消息
      addMessage({
        agentId: 'system',
        content: `已创建任务频道: #${taskName}`,
      })

      setAgentStatus(agentId, 'working', '正在执行...')

      // 5. 执行 Agent
      const execResponse = await fetch(`${API_BASE}/chat/${task.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          prompt,
        }),
      })

      if (!execResponse.ok) {
        const error = await execResponse.json()
        throw new Error(error.error || '执行失败')
      }

      const result = await execResponse.json()

      // 6. 添加 Agent 响应
      if (result.execution?.response) {
        addMessage({
          agentId,
          content: result.execution.response,
        })
      }

      setAgentStatus(agentId, 'idle')

    } catch (error) {
      console.error('[ChatArea] Error:', error)
      addMessage({
        agentId: 'system',
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
      setAgentStatus(agentId, 'idle')
    } finally {
      setIsExecuting(false)
    }
  }

  /**
   * 在当前任务中执行 Agent
   */
  const executeInCurrentTask = async (agentId: AgentType, prompt: string) => {
    if (!currentTaskId) {
      // 没有当前任务，创建新任务
      await createTaskAndExecute(agentId, prompt)
      return
    }

    setAgentStatus(agentId, 'thinking', '正在思考...')
    setIsExecuting(true)

    try {
      const response = await fetch(`${API_BASE}/chat/${currentTaskId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          prompt,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '执行失败')
      }

      const result = await response.json()

      setAgentStatus(agentId, 'working', '正在处理...')

      if (result.execution?.response) {
        addMessage({
          agentId,
          content: result.execution.response,
        })
      }

      setAgentStatus(agentId, 'idle')

    } catch (error) {
      console.error('[ChatArea] Execution error:', error)
      addMessage({
        agentId: 'system',
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
      setAgentStatus(agentId, 'idle')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isExecuting) return

    // 解析 mentions
    const mentionRegex = /@(\w+)/g
    const mentions: AgentType[] = []
    let match
    while ((match = mentionRegex.exec(input)) !== null) {
      const agentId = match[1].toLowerCase() as AgentType
      if (agents[agentId]) {
        mentions.push(agentId)
      }
    }

    // 添加用户消息
    addMessage({
      agentId: 'user',
      content: input,
      mentions: mentions.length > 0 ? mentions : undefined,
    })

    const prompt = input
    setInput('')

    // 如果有 @mention，执行 Agent
    if (mentions.length > 0) {
      for (const agentId of mentions) {
        // 如果在 #general（没有选中任务），创建新任务
        // 如果在任务频道中，在当前任务执行
        if (!currentTaskId) {
          await createTaskAndExecute(agentId, prompt)
        } else {
          await executeInCurrentTask(agentId, prompt)
        }
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const filteredAgents = Object.values(agents).filter(
    (agent) =>
      agent.id.includes(mentionFilter) ||
      agent.name.toLowerCase().includes(mentionFilter)
  )

  // 获取当前频道名称
  const currentChannel = currentTaskId
    ? tasks.find(t => t.id === currentTaskId)?.title || '任务'
    : 'general'

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 频道标题 */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-cafe-latte bg-white/80 flex items-center gap-2">
        <Hash size={18} className="sm:w-5 sm:h-5 text-cafe-mocha flex-shrink-0" />
        <span className="font-semibold text-cafe-espresso text-sm sm:text-base truncate">{currentChannel}</span>
        {currentTaskId && (
          <button
            onClick={() => setCurrentTask(null)}
            className="ml-auto text-xs sm:text-sm text-gray-500 hover:text-cafe-mocha whitespace-nowrap"
          >
            返回 #general
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 paw-pattern">
        {!currentTaskId && messages.length === 1 && (
          <div className="text-center text-gray-400 py-6 sm:py-8">
            <p className="text-base sm:text-lg mb-2">欢迎来到 #general</p>
            <p className="text-xs sm:text-sm">使用 @claude @codex @gemini 下发任务</p>
            <p className="text-xs sm:text-sm">例如: @claude 帮我写一个登录页面</p>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-cafe-latte bg-white/90 backdrop-blur p-2 sm:p-4">
        <div className="relative">
          {/* @ 提及下拉菜单 */}
          {showMentions && filteredAgents.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-cafe-latte overflow-hidden max-w-[280px] sm:max-w-none">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => insertMention(agent.id)}
                  className="w-full px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 hover:bg-cafe-cream transition-colors"
                >
                  <span className="text-lg sm:text-xl">{agent.avatar}</span>
                  <div className="text-left min-w-0">
                    <div className="font-medium text-cafe-espresso text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 sm:gap-3">
            <button
              onClick={() => setShowMentions(!showMentions)}
              className="p-1.5 sm:p-2 text-cafe-mocha hover:bg-cafe-latte rounded-lg transition-colors flex-shrink-0"
              title="提及 Agent"
            >
              <AtSign size={18} className="sm:w-5 sm:h-5" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`在 #${currentChannel} 发送消息...`}
              className="flex-1 resize-none border border-cafe-latte rounded-xl px-3 sm:px-4 py-2 sm:py-3 chat-input bg-white/80 max-h-24 sm:max-h-32 text-sm sm:text-base min-w-0"
              rows={1}
              disabled={isExecuting}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isExecuting}
              className="p-2 sm:p-3 bg-cafe-mocha text-white rounded-xl hover:bg-cafe-espresso transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {isExecuting ? (
                <Loader2 size={18} className="sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send size={18} className="sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 text-xs text-gray-400 text-center hidden sm:block">
          按 Enter 发送 | @claude @codex @gemini 下发任务，自动创建频道跟踪
        </div>
      </div>
    </div>
  )
}
