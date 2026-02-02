import React, { useState, useEffect, useRef } from 'react'
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import api from '../utils/api'

function FilesPanel() {
  const [storageStatus, setStorageStatus] = useState({ configured: false })
  const [templates, setTemplates] = useState([])
  const [outputs, setOutputs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [outputFilter, setOutputFilter] = useState(null)

  const fileInputRefs = useRef({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const status = await api.getStorageStatus()
      setStorageStatus(status)

      if (status.configured) {
        const templatesData = await api.listTemplates()
        setTemplates(templatesData.templates || [])

        const outputsData = await api.listOutputs(outputFilter)
        setOutputs(outputsData.outputs || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateUpload = async (category, file) => {
    try {
      await api.uploadTemplate(category, file)
      setMessage({ type: 'success', text: `${category} template uploaded successfully` })
      loadData()
    } catch (error) {
      setMessage({ type: 'error', text: `Upload failed: ${error.response?.data?.detail || error.message}` })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleTemplateDownload = async (template) => {
    try {
      await api.downloadTemplate(template.category, template.filename)
    } catch (error) {
      setMessage({ type: 'error', text: 'Download failed' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleTemplateDelete = async (category) => {
    if (!window.confirm('Delete this template?')) return
    try {
      await api.deleteTemplate(category)
      setMessage({ type: 'success', text: 'Template deleted' })
      loadData()
    } catch (error) {
      setMessage({ type: 'error', text: 'Delete failed' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleOutputDownload = async (output) => {
    try {
      await api.downloadOutput(output.id, output.filename)
    } catch (error) {
      setMessage({ type: 'error', text: 'Download failed' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleOutputDelete = async (outputId) => {
    if (!window.confirm('Delete this output file?')) return
    try {
      await api.deleteOutput(outputId)
      setMessage({ type: 'success', text: 'Output deleted' })
      loadData()
    } catch (error) {
      setMessage({ type: 'error', text: 'Delete failed' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const templateCategories = storageStatus.template_categories || {
    weekly_template: 'Weekly Timesheet Template',
    cash_template: 'Cash Template',
    payroll_template: 'Payroll Template',
    reimb_template: 'Reimb & Bonus Template',
    loans_template: 'Loans Template'
  }

  const getTemplateForCategory = (category) => {
    return templates.find(t => t.category === category)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (!storageStatus.configured) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">Files</h2>
          <p className="section-description">Template storage and output history</p>
        </div>

        <div className="card">
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Supabase Not Configured</strong>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                To enable file persistence, add your Supabase credentials to the backend .env file:
              </p>
              <pre style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
{`SUPABASE_URL=your-project-url
SUPABASE_KEY=your-anon-key`}
              </pre>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                You can still use all processing features - files will just download directly without storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Files</h2>
        <p className="section-description">Manage templates and view output history</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Templates Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FolderOpen size={20} />
            Template Files
          </h3>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Upload your template files once. They'll be used automatically when processing.
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          {Object.entries(templateCategories).map(([category, label]) => {
            const template = getTemplateForCategory(category)
            return (
              <div
                key={category}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{label}</div>
                  {template ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {template.filename} • {formatFileSize(template.size_bytes)} • {formatDate(template.uploaded_at)}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      No file uploaded
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {template && (
                    <>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px' }}
                        onClick={() => handleTemplateDownload(template)}
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '8px' }}
                        onClick={() => handleTemplateDelete(category)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  <input
                    ref={el => fileInputRefs.current[category] = el}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleTemplateUpload(category, e.target.files[0])
                        e.target.value = ''
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => fileInputRefs.current[category]?.click()}
                  >
                    <Upload size={16} />
                    <span style={{ marginLeft: '6px' }}>{template ? 'Replace' : 'Upload'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Output History Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Clock size={20} />
            Output History
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={outputFilter || ''}
              onChange={(e) => {
                setOutputFilter(e.target.value || null)
                setTimeout(loadData, 0)
              }}
            >
              <option value="">All Types</option>
              <option value="cash">Cash</option>
              <option value="payroll">Payroll</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        {outputs.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={48} />
            <p>No output files yet</p>
            <p style={{ fontSize: '13px' }}>Processed files will appear here when you enable "Save to History"</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Week Of</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outputs.map(output => (
                  <tr key={output.id}>
                    <td style={{ fontWeight: '500' }}>{output.filename}</td>
                    <td>
                      <span className={`badge badge-${output.output_type === 'cash' ? 'success' : output.output_type === 'payroll' ? 'warning' : 'error'}`}>
                        {output.output_type}
                      </span>
                    </td>
                    <td>{output.week_of || '-'}</td>
                    <td>{formatDate(output.created_at)}</td>
                    <td>{formatFileSize(output.size_bytes)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px' }}
                          onClick={() => handleOutputDownload(output)}
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px' }}
                          onClick={() => handleOutputDelete(output.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
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
    </div>
  )
}

export default FilesPanel
