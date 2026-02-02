import React, { useState, useEffect } from 'react'
import {
  Clock,
  Calendar,
  Settings,
  FolderOpen,
  Briefcase,
  CalendarRange,
  Users,
  LogOut,
  Shield
} from 'lucide-react'
import DailyProcessor from './components/DailyProcessor'
import WeeklyProcessor from './components/WeeklyProcessor'
import FullWeekProcessor from './components/FullWeekProcessor'
import SettingsPanel from './components/SettingsPanel'
import FilesPanel from './components/FilesPanel'
import LoginPage from './components/LoginPage'
import AdminPanel from './components/AdminPanel'
import api from './utils/api'

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('fullweek')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const storedUser = api.getStoredUser()
    const storedToken = api.getStoredToken()

    if (storedUser && storedToken) {
      setUser(storedUser)
      loadSettings()
    } else {
      setLoading(false)
    }
  }, [])

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (token, userData) => {
    setUser(userData)
    loadSettings()
  }

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    setSettings(null)
  }

  const handleSettingsUpdate = async (newSettings) => {
    try {
      const updated = await api.updateSettings(newSettings)
      setSettings(updated)
      return true
    } catch (error) {
      console.error('Failed to update settings:', error)
      return false
    }
  }

  // Show login if not authenticated
  if (!user) {
    if (loading) {
      return (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        </div>
      )
    }
    return <LoginPage onLogin={handleLogin} />
  }

  // Show loading while fetching settings
  if (loading || !settings) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="spinner" />
          <p>Loading Payroll Master...</p>
        </div>
      </div>
    )
  }

  const isAdmin = user.role === 'admin'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            <Briefcase size={18} color="white" />
          </div>
          <h1>Payroll Master</h1>
        </div>

        <nav className="nav">
          <div
            className={`nav-item ${activeTab === 'fullweek' ? 'active' : ''}`}
            onClick={() => setActiveTab('fullweek')}
          >
            <CalendarRange size={18} />
            <span>Full Week</span>
          </div>
          <div
            className={`nav-item ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            <Clock size={18} />
            <span>Daily</span>
          </div>
          <div
            className={`nav-item ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            <Calendar size={18} />
            <span>Cash/Payroll</span>
          </div>
          <div
            className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FolderOpen size={18} />
            <span>Files</span>
          </div>
          <div
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </div>

          {isAdmin && (
            <div
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Users size={18} />
              <span>Users</span>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-badge">
              {isAdmin && <Shield size={12} style={{ marginRight: 4 }} />}
              {user.username}
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
          <p className="version-info">Payroll Master v2.0.0</p>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'fullweek' && (
          <FullWeekProcessor settings={settings} />
        )}
        {activeTab === 'daily' && (
          <DailyProcessor settings={settings} />
        )}
        {activeTab === 'weekly' && (
          <WeeklyProcessor settings={settings} />
        )}
        {activeTab === 'files' && (
          <FilesPanel />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onUpdate={handleSettingsUpdate}
            onReset={loadSettings}
          />
        )}
        {activeTab === 'admin' && isAdmin && (
          <AdminPanel />
        )}
      </main>

      <style>{`
        .user-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .user-badge {
          display: flex;
          align-items: center;
          font-size: 13px;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: 4px 10px;
          border-radius: 12px;
        }

        .logout-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          color: var(--error);
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  )
}

export default App
