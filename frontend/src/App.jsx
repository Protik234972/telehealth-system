import { useState, useEffect } from 'react'
import { Moon, Sun, Bell, Check, Trash2, Zap, AlertTriangle } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import PatientDashboard from './components/PatientDashboard'
import Analytics from './components/Analytics'
import Login from './components/Login'
import { WS_URL } from './config'

function App() {
  const [currentView, setCurrentView] = useState('landing')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  
  // Real-time Notification Center State
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'system',
      title: '🟢 System Online',
      message: 'Connected to TeleTriage real-time WebSocket cluster.',
      time: 'Just now',
      unread: false
    }
  ])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (event.data === 'emergency_preemption') {
          setNotifications(prev => [
            {
              id: Date.now(),
              type: 'emergency',
              title: '⚡ Emergency Preemption Dispatched',
              message: 'An emergency case required schedule preemption. Notifications sent to impacted patient.',
              time: timeStr,
              unread: true
            },
            ...prev
          ]);
        } else if (event.data === 'update') {
          setNotifications(prev => [
            {
              id: Date.now(),
              type: 'update',
              title: '🔄 Live Queue Updated',
              message: 'A patient triage intake, priority override, or assignment was recorded.',
              time: timeStr,
              unread: true
            },
            ...prev
          ]);
        }
      };
      return () => ws.close();
    } catch (e) {
      console.warn('WS notification init error', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    if (token && role) {
      setIsAuthenticated(true)
      setUserRole(role)
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
    }
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('username')
    setIsAuthenticated(false)
    setUserRole(null)
    setCurrentView('landing')
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    const role = localStorage.getItem('role')
    setUserRole(role)
    setCurrentView('dashboard') // Auto route after login
  }

  const renderDashboardArea = () => {
    if (!isAuthenticated) {
      return <Login onLoginSuccess={handleLoginSuccess} />
    }
    
    if (currentView === 'analytics' && userRole === 'admin') {
      return <Analytics onLogout={handleLogout} />
    }
    
    if (userRole === 'patient') {
      return <PatientDashboard onLogout={handleLogout} />
    }
    
    return <Dashboard onLogout={handleLogout} />
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-gray-800'}`}>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' } }} />
      {currentView !== 'landing' && (
        <nav className="bg-white/70 dark:bg-gray-800/80 backdrop-blur-lg shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('landing')}>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 dark:shadow-none">
                    AI
                  </div>
                  <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                    TeleTriage
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Real-time Notification Center */}
                {isAuthenticated && (
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition relative"
                      title="Real-time Clinical Notifications"
                    >
                      <Bell className="w-5 h-5" />
                      {notifications.filter(n => n.unread).length > 0 && (
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-3 z-50">
                        <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800 dark:text-white">Live Clinical Feed</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              {notifications.filter(n => n.unread).length} new
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))}
                              className="text-[11px] text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium px-1.5 py-0.5 rounded transition"
                              title="Mark all as read"
                            >
                              Read all
                            </button>
                            <button
                              onClick={() => setNotifications([])}
                              className="text-[11px] text-gray-400 hover:text-red-500 p-1 rounded transition"
                              title="Clear all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                          {notifications.length === 0 ? (
                            <p className="p-4 text-center text-xs text-gray-400">No notifications yet.</p>
                          ) : (
                            notifications.map(n => (
                              <div
                                key={n.id}
                                className={`p-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                                  n.unread ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-gray-800 dark:text-white leading-tight">
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] text-gray-400 shrink-0">{n.time}</span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-snug">
                                  {n.message}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isAuthenticated && (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition"
                  >
                    Sign In
                  </button>
                )}

                {isAuthenticated && (
                  <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
                    <button
                      onClick={() => setCurrentView('dashboard')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        currentView === 'dashboard' || (currentView === 'portal' && userRole === 'patient')
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      {userRole === 'patient' ? 'My Dashboard' : userRole === 'staff' ? 'Clinical Workspace' : 'Triage Operations'}
                    </button>

                    {userRole === 'admin' && (
                      <button
                        onClick={() => setCurrentView('analytics')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          currentView === 'analytics' 
                          ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' 
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                      >
                        Analytics
                      </button>
                    )}
                    
                    <button 
                      onClick={handleLogout}
                      className="px-3 py-1 ml-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-md transition"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="pb-12">
        {currentView === 'landing' ? (
          <LandingPage onEnter={() => {
            if (isAuthenticated) setCurrentView('dashboard')
            else setCurrentView('dashboard') // Will show login
          }} />
        ) : null}
        
        {currentView !== 'landing' ? renderDashboardArea() : null}
      </main>
    </div>
  )
}

export default App
