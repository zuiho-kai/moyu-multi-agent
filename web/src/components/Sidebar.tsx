import { CheckCircle, Circle, Clock, AlertCircle, Plus } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import type { Task } from '../types'

const statusConfig = {
  pending: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100', label: '待处理' },
  'in-progress': { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: '进行中' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: '已完成' },
  failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: '失败' },
}

function TaskItem({ task }: { task: Task }) {
  const { currentTaskId, setCurrentTask, agents } = useAppStore()
  const config = statusConfig[task.status]
  const Icon = config.icon
  const isActive = currentTaskId === task.id

  return (
    <button
      onClick={() => setCurrentTask(task.id)}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isActive
          ? 'bg-cafe-mocha/20 border-l-4 border-cafe-mocha'
          : 'hover:bg-cafe-latte/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon size={18} className={`${config.color} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-cafe-espresso truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              {config.label}
            </span>
            {task.assignedTo && (
              <div className="flex -space-x-1">
                {task.assignedTo.map((agentId) => (
                  <span
                    key={agentId}
                    className="text-sm"
                    title={agents[agentId].name}
                  >
                    {agents[agentId].avatar}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export default function Sidebar() {
  const { tasks, addTask } = useAppStore()

  const handleAddTask = () => {
    const title = prompt('请输入任务标题：')
    if (title?.trim()) {
      addTask({ title: title.trim(), status: 'pending' })
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="p-4 border-b border-cafe-latte flex items-center justify-between">
        <h2 className="font-semibold text-cafe-espresso flex items-center gap-2">
          <span>📋</span> 任务列表
        </h2>
        <button
          onClick={handleAddTask}
          className="p-1.5 hover:bg-cafe-latte rounded-lg transition-colors"
          title="新建任务"
        >
          <Plus size={18} className="text-cafe-espresso" />
        </button>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* 进行中 */}
        {inProgressTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider px-2 mb-2">
              进行中 ({inProgressTasks.length})
            </h3>
            <div className="space-y-1">
              {inProgressTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* 待处理 */}
        {pendingTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
              待处理 ({pendingTasks.length})
            </h3>
            <div className="space-y-1">
              {pendingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* 已完成 */}
        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider px-2 mb-2">
              已完成 ({completedTasks.length})
            </h3>
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 统计 */}
      <div className="p-4 border-t border-cafe-latte bg-cafe-cream/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-lg font-bold text-amber-500">{inProgressTasks.length}</div>
            <div className="text-gray-500">进行中</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-400">{pendingTasks.length}</div>
            <div className="text-gray-500">待处理</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-500">{completedTasks.length}</div>
            <div className="text-gray-500">已完成</div>
          </div>
        </div>
      </div>
    </div>
  )
}
