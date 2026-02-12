import { useEffect } from 'react'
import { Hash, Settings, X } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { Task, AgentType } from '../types'

function ChannelItem({ task, isActive, onClick }: { task: Task; isActive: boolean; onClick: () => void }) {
  const { agents } = useAppStore()

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
        isActive
          ? 'bg-cafe-mocha/20 text-cafe-espresso'
          : 'text-gray-600 hover:bg-cafe-latte/50 hover:text-cafe-espresso'
      }`}
    >
      <Hash size={16} className={`flex-shrink-0 ${isActive ? 'text-cafe-mocha' : 'text-gray-400'}`} />
      <span className="flex-1 truncate text-sm">{task.title}</span>
      {task.assignedTo && task.assignedTo.length > 0 && (
        <div className="flex -space-x-1 flex-shrink-0">
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

interface SidebarProps {
  collapsed?: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const tasks = useAppStore((state) => state.tasks)
  const currentTaskId = useAppStore((state) => state.currentTaskId)
  const loadTasks = useAppStore((state) => state.loadTasks)
  const setCurrentTask = useAppStore((state) => state.setCurrentTask)
  const toggleSettings = useAppStore((state) => state.toggleSettings)
  const toggleLeftSidebar = useAppStore((state) => state.toggleLeftSidebar)

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

  // 点击任务后在移动端自动关闭侧栏
  const handleTaskClick = (taskId: string | null) => {
    setCurrentTask(taskId)
    // 在移动端关闭侧栏
    if (window.innerWidth < 768) {
      toggleLeftSidebar()
    }
  }

  if (collapsed) {
    return null
  }

  return (
    <div className="h-full flex flex-col bg-cafe-cream/30 w-full">
      {/* 服务器标题 */}
      <div className="p-3 sm:p-4 border-b border-cafe-latte flex items-center justify-between">
        <h1 className="font-bold text-cafe-espresso flex items-center gap-2">
          <span className="text-lg sm:text-xl">🐱</span>
          <span className="text-sm sm:text-base truncate">猫咖工作室</span>
        </h1>
        {/* 移动端关闭按钮 */}
        <button
          onClick={toggleLeftSidebar}
          className="p-1.5 hover:bg-cafe-latte rounded-lg transition-colors md:hidden"
          aria-label="关闭侧边栏"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* General 频道 */}
        <div className="mb-3 sm:mb-4">
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
            主频道
          </div>
          <button
            onClick={() => handleTaskClick(null)}
            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
              !currentTaskId
                ? 'bg-cafe-mocha/20 text-cafe-espresso'
                : 'text-gray-600 hover:bg-cafe-latte/50 hover:text-cafe-espresso'
            }`}
          >
            <Hash size={16} className={`flex-shrink-0 ${!currentTaskId ? 'text-cafe-mocha' : 'text-gray-400'}`} />
            <span className="text-sm font-medium">general</span>
          </button>
        </div>

        {/* 活跃任务 */}
        {activeTasks.length > 0 && (
          <div className="mb-3 sm:mb-4">
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
                  onClick={() => handleTaskClick(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 已完成任务 */}
        {completedTasks.length > 0 && (
          <div className="mb-3 sm:mb-4">
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
                  onClick={() => handleTaskClick(task.id)}
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
      <div className="p-2 sm:p-3 border-t border-cafe-latte bg-white/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cafe-mocha flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
              👤
            </div>
            <div className="text-sm min-w-0">
              <div className="font-medium text-cafe-espresso truncate">用户</div>
              <div className="text-xs text-gray-500">在线</div>
            </div>
          </div>
          <button
            onClick={toggleSettings}
            className="p-1.5 sm:p-2 hover:bg-cafe-latte rounded-lg transition-colors flex-shrink-0"
            title="设置"
          >
            <Settings size={16} className="sm:w-[18px] sm:h-[18px] text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
