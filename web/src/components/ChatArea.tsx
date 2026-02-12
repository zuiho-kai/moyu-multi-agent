import { useState, useRef, useEffect } from 'react'
import { Send, AtSign } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { AgentType, Message } from '../types'

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
      <div className="flex justify-center my-4">
        <div className="bg-cafe-latte/50 text-cafe-espresso/70 text-sm px-4 py-2 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.agentId === 'user') {
    return (
      <div className="flex justify-end mb-4 message-bubble">
        <div className="max-w-[70%] bg-cafe-mocha text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <div className="text-xs text-white/60 mt-1 text-right">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    )
  }

  const agent = agents[message.agentId as AgentType]
  const colorClass = agentColors[message.agentId as AgentType]
  const textColorClass = agentTextColors[message.agentId as AgentType]

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
    <div className="flex gap-3 mb-4 message-bubble">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cafe-cream flex items-center justify-center text-xl shadow-sm">
        {agent.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium ${textColorClass}`}>{agent.name}</span>
          <span className="text-xs text-gray-400">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={`${colorClass} border px-4 py-3 rounded-2xl rounded-tl-md shadow-sm`}>
          <p className="whitespace-pre-wrap text-gray-800">{renderContent(message.content)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatArea() {
  const { messages, agents, addMessage, setAgentStatus } = useAppStore()
  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
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

  const simulateAgentResponse = (mentionedAgents: AgentType[]) => {
    // 模拟 Agent 响应
    mentionedAgents.forEach((agentId, index) => {
      // 设置思考状态
      setTimeout(() => {
        setAgentStatus(agentId, 'thinking', '正在思考...')
      }, index * 500)

      // 设置工作状态
      setTimeout(() => {
        setAgentStatus(agentId, 'working', '正在处理您的请求...')
      }, index * 500 + 1000)

      // 发送响应
      setTimeout(() => {
        const responses: Record<AgentType, string[]> = {
          claude: [
            '好的，让我来分析一下这个问题...',
            '从架构角度来看，我建议我们可以这样处理...',
            '我已经审查了代码，有几点建议想和大家分享。',
          ],
          codex: [
            '收到！我这就开始写代码 💻',
            '代码已经写好了，@gemini 可以帮忙测试一下吗？',
            '这个功能我来实现，预计需要 30 分钟。',
          ],
          gemini: [
            '喵～我来写测试用例吧！',
            '测试通过了！覆盖率达到 85%。',
            '文档已经更新完毕，请查收～',
          ],
        }
        const randomResponse = responses[agentId][Math.floor(Math.random() * responses[agentId].length)]
        addMessage({ agentId, content: randomResponse })
        setAgentStatus(agentId, 'idle')
      }, index * 500 + 2500)
    })
  }

  const handleSend = () => {
    if (!input.trim()) return

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

    addMessage({
      agentId: 'user',
      content: input,
      mentions: mentions.length > 0 ? mentions : undefined,
    })

    setInput('')

    // 如果有 mention，模拟 Agent 响应
    if (mentions.length > 0) {
      simulateAgentResponse(mentions)
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

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 paw-pattern">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-cafe-latte bg-white/90 backdrop-blur p-4">
        <div className="relative">
          {/* @ 提及下拉菜单 */}
          {showMentions && filteredAgents.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-cafe-latte overflow-hidden">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => insertMention(agent.id)}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-cafe-cream transition-colors"
                >
                  <span className="text-xl">{agent.avatar}</span>
                  <div className="text-left">
                    <div className="font-medium text-cafe-espresso">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <button
              onClick={() => setShowMentions(!showMentions)}
              className="p-2 text-cafe-mocha hover:bg-cafe-latte rounded-lg transition-colors"
              title="提及 Agent"
            >
              <AtSign size={20} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，使用 @agent 唤起特定猫咪..."
              className="flex-1 resize-none border border-cafe-latte rounded-xl px-4 py-3 chat-input bg-white/80 max-h-32"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-3 bg-cafe-mocha text-white rounded-xl hover:bg-cafe-espresso transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400 text-center">
          按 Enter 发送，Shift + Enter 换行 | 使用 @claude @codex @gemini 唤起猫咪
        </div>
      </div>
    </div>
  )
}
