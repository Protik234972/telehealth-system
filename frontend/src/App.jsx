import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import PatientDashboard from './components/PatientDashboard'
import Analytics from './components/Analytics'
import Login from './components/Login'

function App() {
  const [currentView, setCurrentView] = useState('landing')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [darkMode, setDarkMode] = useState(false)

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
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

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
                      {userRole === 'patient' ? 'My Dashboard' : 'Staff Dashboard'}
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
