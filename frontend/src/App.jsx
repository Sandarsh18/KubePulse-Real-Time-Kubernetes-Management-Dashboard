import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Logs from './pages/Logs'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './context/ThemeContext'
import './index.css'

export default function App() {
  const { theme } = useTheme()
  
  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500`}>
      <nav className={`${theme.nav} shadow-lg sticky top-0 z-50 border-b ${theme.border} transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow} transform hover:scale-110 transition-transform`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                  K8s Dashboard
                </h1>
                <p className={`text-xs ${theme.textMuted}`}>Real-time Cluster Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <NavLink 
                  to="/"
                  className={({isActive})=> `px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                    isActive 
                      ? theme.navActive + ' shadow-md' 
                      : theme.navText + ' hover:bg-opacity-10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Dashboard</span>
                  </div>
                </NavLink>
                <NavLink 
                  to="/logs"
                  className={({isActive})=> `px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                    isActive 
                      ? theme.navActive + ' shadow-md' 
                      : theme.navText + ' hover:bg-opacity-10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Logs</span>
                  </div>
                </NavLink>
                <NavLink 
                  to="/chat"
                  className={({isActive})=> `px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                    isActive 
                      ? theme.navActive + ' shadow-md' 
                      : theme.navText + ' hover:bg-opacity-10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Chat</span>
                  </div>
                </NavLink>
              </div>
              <div className={`border-l ${theme.border} pl-4`}>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard/>} />
          <Route path="/logs" element={<Logs/>} />
          <Route path="/chat" element={<Chat/>} />
        </Routes>
      </main>
    </div>
  )
}
