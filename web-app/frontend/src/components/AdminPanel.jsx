import React, { useState, useEffect } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import api from '../utils/api'

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.listUsers()
      setUsers(result.users || [])
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleApprove = async (userId) => {
    setActionLoading(userId)
    try {
      await api.approveUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to approve user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove "${username}"? They will lose access immediately.`)) {
      return
    }

    setActionLoading(userId)
    try {
      await api.deleteUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingUsers = users.filter(u => !u.approved && u.role !== 'admin')
  const approvedUsers = users.filter(u => u.approved || u.role === 'admin')

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">User Management</h2>
        <p className="section-description">
          Approve new users and manage access to Payroll Master
        </p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Clock size={20} />
            Pending Approval ({pendingUsers.length})
          </h3>
          <button className="btn btn-secondary" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <UserCheck size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No pending requests</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(user.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-success"
                          style={{ padding: '6px 12px', fontSize: 13 }}
                          onClick={() => handleApprove(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <div className="spinner" style={{ width: 14, height: 14 }} />
                          ) : (
                            <>
                              <UserCheck size={14} />
                              Approve
                            </>
                          )}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: 13 }}
                          onClick={() => handleDelete(user.id, user.username)}
                          disabled={actionLoading === user.id}
                        >
                          <UserX size={14} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Users size={20} />
            Active Users ({approvedUsers.length})
          </h3>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div className="spinner" />
            <p style={{ marginTop: 12 }}>Loading users...</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>
                      {user.role === 'admin' ? (
                        <span className="badge badge-success">
                          <Shield size={12} style={{ marginRight: 4 }} />
                          Admin
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          User
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(user.created_at)}
                    </td>
                    <td>
                      {user.role !== 'admin' ? (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: 13 }}
                          onClick={() => handleDelete(user.id, user.username)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <div className="spinner" style={{ width: 14, height: 14 }} />
                          ) : (
                            <>
                              <Trash2 size={14} />
                              Remove
                            </>
                          )}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          Cannot remove admin
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
