import { Settings } from 'lucide-react'
import { useAppStore } from './stores/appStore'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import AgentPanel from './components/AgentPanel'
import SettingsModal from './components/SettingsModal'

function App() {
  const { toggleSettings, settingsOpen } = useAppStore()

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-cafe-espresso text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐱</span>
          <h1 className="text-xl font-cafe font-semibold">Cat Cafe Multi-Agent</h1>
          <span className="text-cafe-mocha text-sm">三猫工作室</span>
        </div>
        <button
          onClick={toggleSettings}
          className="p-2 hover:bg-cafe-mocha/30 rounded-lg transition-colors"
          aria-label="设置"
        >
          <Settings size={22} />
        </button>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 - 任务列表 */}
        <aside className="w-64 bg-white/80 backdrop-blur border-r border-cafe-latte flex-shrink-0 hidden md:block">
          <Sidebar />
        </aside>

        {/* 中间聊天区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatArea />
        </main>

        {/* 右侧边栏 - Agent 状态 */}
        <aside className="w-72 bg-white/80 backdrop-blur border-l border-cafe-latte flex-shrink-0 hidden lg:block">
          <AgentPanel />
        </aside>
      </div>

      {/* 设置弹窗 */}
      {settingsOpen && <SettingsModal />}
    </div>
  )
}

export default App
