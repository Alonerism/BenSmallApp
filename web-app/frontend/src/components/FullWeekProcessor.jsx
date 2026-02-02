import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Eye,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  User,
  Save
} from 'lucide-react'
import api from '../utils/api'

function FullWeekProcessor({ settings }) {
  const [timeDataFile, setTimeDataFile] = useState(null)
  const [templateFile, setTemplateFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saveToHistory, setSaveToHistory] = useState(false)

  const timeDataInputRef = useRef(null)
  const templateInputRef = useRef(null)

  const handleFileSelect = (setter, inputRef) => (e) => {
    const file = e.target.files[0]
    if (file) {
      setter(file)
      setPreview(null)
      setError(null)
      setSuccess(null)
    }
  }

  const handlePreview = async () => {
    if (!timeDataFile || !templateFile) {
      setError('Please select both files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.previewFullWeek(timeDataFile, templateFile)
      setPreview(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!timeDataFile || !templateFile) {
      setError('Please select both files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const filename = await api.processFullWeek(timeDataFile, templateFile, saveToHistory)
      setSuccess(`Downloaded: ${filename}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const getScoreBadge = (score) => {
    if (score >= 92) return <span className="badge badge-success">{score}</span>
    if (score >= 85) return <span className="badge badge-warning">{score}</span>
    return <span className="badge badge-error">{score}</span>
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Full Week Processing</h2>
        <p className="section-description">
          Process an entire week of time data at once from a CSV or Excel file
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FileSpreadsheet size={20} />
            Input Files
          </h3>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Upload a CSV or Excel file with the full week's time data. Supported formats:
          <br />• <strong>Long format:</strong> Employee, Date, Hours (one row per day)
          <br />• <strong>Wide format:</strong> Employee, Mon, Tue, Wed, ... (columns per day)
        </p>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Weekly Time Data (CSV/Excel)</label>
            <div
              className={`file-upload ${timeDataFile ? 'has-file' : ''}`}
              onClick={() => timeDataInputRef.current?.click()}
            >
              <input
                ref={timeDataInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect(setTimeDataFile, timeDataInputRef)}
                style={{ display: 'none' }}
              />
              <Upload className="file-upload-icon" />
              <p className="file-upload-text">
                <strong>Click to upload</strong> CSV or Excel
              </p>
              {timeDataFile && (
                <div className="file-name">
                  <CheckCircle size={14} />
                  {timeDataFile.name}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weekly Timesheet Template</label>
            <div
              className={`file-upload ${templateFile ? 'has-file' : ''}`}
              onClick={() => templateInputRef.current?.click()}
            >
              <input
                ref={templateInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect(setTemplateFile, templateInputRef)}
                style={{ display: 'none' }}
              />
              <Upload className="file-upload-icon" />
              <p className="file-upload-text">
                <strong>Click to upload</strong> template
              </p>
              {templateFile && (
                <div className="file-name">
                  <CheckCircle size={14} />
                  {templateFile.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="toggle-group" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <div className="toggle-label">Save to History</div>
            <div className="toggle-description">Store output in file history (requires Supabase)</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={saveToHistory}
              onChange={(e) => setSaveToHistory(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={loading || !timeDataFile || !templateFile}
          >
            {loading ? <div className="spinner" /> : <Eye size={18} />}
            Preview
          </button>
          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={loading || !timeDataFile || !templateFile}
          >
            {loading ? <div className="spinner" /> : <Download size={18} />}
            Process & Download
          </button>
        </div>
      </div>

      {preview && (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Calendar size={20} />
                Processing Summary
              </h3>
              <span className="badge badge-success">
                {preview.week_range}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {preview.employees_processed}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Employees</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                  {preview.days_in_data}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Days</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                  {preview.cells_filled}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Cells Filled</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: preview.unmatched.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {preview.unmatched.length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Unmatched</div>
              </div>
            </div>
          </div>

          {preview.anomalies.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <AlertTriangle size={20} />
                  Anomalies Detected
                </h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.anomalies.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>{a.date}</td>
                        <td>
                          <span className={`badge ${a.type === 'long_shift' ? 'badge-warning' : 'badge-error'}`}>
                            {a.type}
                          </span>
                        </td>
                        <td>{a.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <User size={20} />
                Employee Results
              </h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time Data Name</th>
                    <th>Template Match</th>
                    <th>Score</th>
                    <th>Total Hours</th>
                    <th>Days Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.match_results.map((m, i) => (
                    <tr key={i}>
                      <td>{m.time_name}</td>
                      <td>{m.weekly_name}</td>
                      <td>{getScoreBadge(m.score)}</td>
                      <td>{m.total_hours.toFixed(2)}</td>
                      <td>{m.days_worked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.unmatched.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title" style={{ color: 'var(--warning)' }}>
                  Unmatched Employees
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {preview.unmatched.map((name, i) => (
                  <span key={i} className="badge badge-warning">{name}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FullWeekProcessor
