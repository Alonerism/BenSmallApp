import React, { useState } from 'react'
import { LogIn, UserPlus, AlertCircle, CheckCircle } from 'lucide-react'
import api from '../utils/api'

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await api.login(username, password)
        if (result.token) {
          onLogin(result.token, result.user)
        }
      } else {
        // Signup
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        if (password.length < 4) {
          setError('Password must be at least 4 characters')
          setLoading(false)
          return
        }
        const result = await api.signup(username, password)
        if (result.success) {
          setSuccess('Account requested! Please wait for admin approval.')
          setMode('login')
          setUsername('')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-icon" style={{ width: 48, height: 48, margin: '0 auto 16px' }}>
            <LogIn size={24} color="white" />
          </div>
          <h1>Payroll Master</h1>
          <p>{mode === 'login' ? 'Sign in to your account' : 'Request an account'}</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20 }} />
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} />
                Sign In
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Request Account
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          {mode === 'login' ? (
            <p>
              Need an account?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('signup')
                  setError('')
                  setSuccess('')
                }}
              >
                Request access
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('login')
                  setError('')
                  setSuccess('')
                }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: 20px;
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 32px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-header h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .login-header p {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .login-footer {
          margin-top: 24px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .link-button {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }

        .link-button:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default LoginPage
