import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Eye,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  User
} from 'lucide-react'
import api from '../utils/api'

function DailyProcessor({ settings }) {
  const [tarFile, setTarFile] = useState(null)
  const [weeklyFile, setWeeklyFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const tarInputRef = useRef(null)
  const weeklyInputRef = useRef(null)

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
    if (!tarFile || !weeklyFile) {
      setError('Please select both files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.previewDaily(tarFile, weeklyFile)
      setPreview(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!tarFile || !weeklyFile) {
      setError('Please select both files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const filename = await api.processDaily(tarFile, weeklyFile)
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
        <h2 className="section-title">Daily Time Processing</h2>
        <p className="section-description">
          Convert Time Activity Reports into Weekly Timesheets
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

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Time Activity Report</label>
            <div
              className={`file-upload ${tarFile ? 'has-file' : ''}`}
              onClick={() => tarInputRef.current?.click()}
            >
              <input
                ref={tarInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect(setTarFile, tarInputRef)}
                style={{ display: 'none' }}
              />
              <Upload className="file-upload-icon" />
              <p className="file-upload-text">
                <strong>Click to upload</strong> or drag and drop
              </p>
              {tarFile && (
                <div className="file-name">
                  <CheckCircle size={14} />
                  {tarFile.name}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weekly Timesheet</label>
            <div
              className={`file-upload ${weeklyFile ? 'has-file' : ''}`}
              onClick={() => weeklyInputRef.current?.click()}
            >
              <input
                ref={weeklyInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect(setWeeklyFile, weeklyInputRef)}
                style={{ display: 'none' }}
              />
              <Upload className="file-upload-icon" />
              <p className="file-upload-text">
                <strong>Click to upload</strong> or drag and drop
              </p>
              {weeklyFile && (
                <div className="file-name">
                  <CheckCircle size={14} />
                  {weeklyFile.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={loading || !tarFile || !weeklyFile}
          >
            {loading ? <div className="spinner" /> : <Eye size={18} />}
            Preview
          </button>
          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={loading || !tarFile || !weeklyFile}
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
                <Clock size={20} />
                Processing Summary
              </h3>
              <span className="badge badge-success">
                {preview.date} - {preview.day_of_week}
              </span>
            </div>

            <div className="form-row">
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {preview.processed_count}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Employees Matched</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: preview.unmatched.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {preview.unmatched.length}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Unmatched</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: preview.anomalies.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {preview.anomalies.length}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Anomalies</div>
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
                      <th>Day</th>
                      <th>Type</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.anomalies.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>{a.day}</td>
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
                Name Matching Results
              </h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>TAR Name</th>
                    <th>Weekly Name</th>
                    <th>Score</th>
                    <th>Raw Hours</th>
                    <th>Rounded</th>
                    <th>Regular</th>
                    <th>Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.match_results.map((m, i) => (
                    <tr key={i}>
                      <td>{m.tar_name}</td>
                      <td>{m.weekly_name}</td>
                      <td>{getScoreBadge(m.score)}</td>
                      <td>{m.raw_hours.toFixed(2)}</td>
                      <td>{m.rounded_hours.toFixed(2)}</td>
                      <td>{m.regular.toFixed(2)}</td>
                      <td>{m.overtime.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DailyProcessor
