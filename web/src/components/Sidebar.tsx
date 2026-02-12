import { useEffect, useCallback } from 'react'
import { Hash, CheckCircle, Circle, Clock, Settings } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { Task, AgentType } from '../types'

const statusConfig = {
  pending: { icon: Circle, color: 'text-gray-400', label: '待处理' },
  'in-progress': { icon: Clock, color: 'text-amber-500', label: '进行中' },
  completed: { icon: CheckCircle, color: 'text-green-500', label: '已完成' },
}

function ChannelItem({ task, isActive, onClick }: { task: Task; isActive: boolean; onClick: () => void }) {
  const { agents } = useAppStore()
  const config = statusConfig[task.status] || statusConfig.pending

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
        isActive
          ? 'bg-cafe-mocha/20 text-cafe-espresso'
          : 'text-gray-600 hover:bg-cafe-latte/50 hover:text-cafe-espresso'
      }`}
    >
      <Hash size={16} className={isActive ? 'text-cafe-mocha' : 'text-gray-400'} />
      <span className="flex-1 truncate text-sm">{task.title}</span>
      {task.assignedTo && task.assignedTo.length > 0 && (
        <div className="flex -space-x-1">
          {task.assignedTo.slice(0, 2).map((agentId) => (
            <span key={agentId} className="text-xs">
              {agents[agentId as AgentType]?.avatar || '🤖'}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

export default function Sidebar() {
  const tasks = useAppStore((state) => state.tasks)
  const currentTaskId = useAppStore((state) => state.currentTaskId)
  const loadTasks = useAppStore((state) => state.loadTasks)
  const setCurrentTask = useAppStore((state) => state.setCurrentTask)
  const toggleSettings = useAppStore((state) => state.toggleSettings)

  // 初始加载任务
  useEffect(() => {
    console.log('[Sidebar] Loading tasks...')
    loadTasks().then(() => {
      console.log('[Sidebar] Tasks loaded:', tasks.length)
    }).catch((err) => {
      console.error('[Sidebar] Failed to load tasks:', err)
    })
  }, [])

  const activeTasks = tasks.filter((t) => t.status === 'in-progress' || t.status === 'pending')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="h-full flex flex-col bg-cafe-cream/30">
      {/* 服务器标题 */}
      <div className="p-4 border-b border-cafe-latte">
        <h1 className="font-bold text-cafe-espresso flex items-center gap-2">
          <span className="text-xl">🐱</span>
          <span>猫咖工作室</span>
        </h1>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* General 频道 */}
        <div className="mb-4">
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
            主频道
          </div>
          <button
            onClick={() => setCurrentTask(null)}
            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
              !currentTaskId
                ? 'bg-cafe-mocha/20 text-cafe-espresso'
                : 'text-gray-600 hover:bg-cafe-latte/50 hover:text-cafe-espresso'
            }`}
          >
            <Hash size={16} className={!currentTaskId ? 'text-cafe-mocha' : 'text-gray-400'} />
            <span className="text-sm font-medium">general</span>
          </button>
        </div>

        {/* 活跃任务 */}
        {activeTasks.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
              <span>任务频道</span>
              <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-xs">
                {activeTasks.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {activeTasks.map((task) => (
                <ChannelItem
                  key={task.id}
                  task={task}
                  isActive={currentTaskId === task.id}
                  onClick={() => setCurrentTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 已完成任务 */}
        {completedTasks.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
              <span>已完成</span>
              <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-xs">
                {completedTasks.length}
              </span>
            </div>
            <div className="space-y-0.5 opacity-60">
              {completedTasks.slice(0, 5).map((task) => (
                <ChannelItem
                  key={task.id}
                  task={task}
                  isActive={currentTaskId === task.id}
                  onClick={() => setCurrentTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center text-gray-400 py-4 text-sm">
            <p>暂无任务</p>
            <p className="mt-1 text-xs">在 #general 发送消息</p>
            <p className="text-xs">@claude 下发任务</p>
          </div>
        )}
      </div>

      {/* 底部用户区 */}
      <div className="p-3 border-t border-cafe-latte bg-white/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cafe-mocha flex items-center justify-center text-white text-sm">
              👤
            </div>
            <div className="text-sm">
              <div className="font-medium text-cafe-espresso">用户</div>
              <div className="text-xs text-gray-500">在线</div>
            </div>
          </div>
          <button
            onClick={toggleSettings}
            className="p-2 hover:bg-cafe-latte rounded-lg transition-colors"
            title="设置"
          >
            <Settings size={18} className="text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
