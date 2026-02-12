import { useEffect } from 'react'
import { Settings, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Menu } from 'lucide-react'
import { useAppStore } from './stores/appStore'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import AgentPanel from './components/AgentPanel'
import SettingsModal from './components/SettingsModal'

function App() {
  const {
    toggleSettings,
    settingsOpen,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    toggleLeftSidebar,
    toggleRightSidebar,
    loadAgentSettings
  } = useAppStore()

  // 应用启动时加载 Agent 设置
  useEffect(() => {
    loadAgentSettings()
  }, [loadAgentSettings])

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-cafe-espresso text-white px-3 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 移动端菜单按钮 */}
          <button
            onClick={toggleLeftSidebar}
            className="p-1.5 sm:p-2 hover:bg-cafe-mocha/30 rounded-lg transition-colors md:hidden"
            aria-label="切换侧边栏"
          >
            <Menu size={20} />
          </button>
          <span className="text-xl sm:text-2xl">🐱</span>
          <h1 className="text-base sm:text-lg md:text-xl font-cafe font-semibold truncate">
            <span className="hidden sm:inline">Cat Cafe Multi-Agent</span>
            <span className="sm:hidden">Cat Cafe</span>
          </h1>
          <span className="text-cafe-mocha text-xs sm:text-sm hidden md:inline">三猫工作室</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 桌面端侧栏切换按钮 */}
          <button
            onClick={toggleLeftSidebar}
            className="p-1.5 sm:p-2 hover:bg-cafe-mocha/30 rounded-lg transition-colors hidden md:flex"
            aria-label={leftSidebarCollapsed ? '展开左侧栏' : '收起左侧栏'}
            title={leftSidebarCollapsed ? '展开任务列表' : '收起任务列表'}
          >
            {leftSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button
            onClick={toggleRightSidebar}
            className="p-1.5 sm:p-2 hover:bg-cafe-mocha/30 rounded-lg transition-colors hidden lg:flex"
            aria-label={rightSidebarCollapsed ? '展开右侧栏' : '收起右侧栏'}
            title={rightSidebarCollapsed ? '展开 Agent 面板' : '收起 Agent 面板'}
          >
            {rightSidebarCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
          </button>
          <button
            onClick={toggleSettings}
            className="p-1.5 sm:p-2 hover:bg-cafe-mocha/30 rounded-lg transition-colors"
            aria-label="设置"
          >
            <Settings size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 移动端遮罩层 */}
        {!leftSidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={toggleLeftSidebar}
          />
        )}

        {/* 左侧边栏 - 任务列表 */}
        <aside
          className={`
            bg-white/80 backdrop-blur border-r border-cafe-latte flex-shrink-0
            transition-all duration-300 ease-in-out
            ${/* 移动端：固定定位，滑入滑出 */''}
            fixed md:relative z-30 md:z-auto
            h-[calc(100vh-48px)] sm:h-[calc(100vh-52px)] md:h-auto
            ${leftSidebarCollapsed
              ? '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'
              : 'translate-x-0 w-64 sm:w-56 md:w-48 lg:w-56 xl:w-64 2xl:w-72'
            }
          `}
        >
          <Sidebar collapsed={leftSidebarCollapsed} />
        </aside>

        {/* 中间聊天区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatArea />
        </main>

        {/* 右侧边栏 - Agent 状态 */}
        <aside
          className={`
            bg-white/80 backdrop-blur border-l border-cafe-latte flex-shrink-0
            transition-all duration-300 ease-in-out
            hidden lg:block
            ${rightSidebarCollapsed
              ? 'w-0 opacity-0 overflow-hidden'
              : 'w-56 xl:w-64 2xl:w-80'
            }
          `}
        >
          <AgentPanel collapsed={rightSidebarCollapsed} />
        </aside>
      </div>

      {/* 设置弹窗 */}
      {settingsOpen && <SettingsModal />}
    </div>
  )
}

export default App
