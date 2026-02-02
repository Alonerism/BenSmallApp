import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  CreditCard,
  Gift
} from 'lucide-react'
import api from '../utils/api'

function WeeklyProcessor({ settings }) {
  const [files, setFiles] = useState({
    weekly: null,
    cash: null,
    payroll: null,
    reimb: null,
    loans: null
  })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const inputRefs = {
    weekly: useRef(null),
    cash: useRef(null),
    payroll: useRef(null),
    reimb: useRef(null),
    loans: useRef(null)
  }

  const handleFileSelect = (key) => (e) => {
    const file = e.target.files[0]
    if (file) {
      setFiles(prev => ({ ...prev, [key]: file }))
      setPreview(null)
      setError(null)
      setSuccess(null)
    }
  }

  const requiredFilesReady = files.weekly && files.cash && files.payroll && files.reimb

  const handlePreview = async () => {
    if (!requiredFilesReady) {
      setError('Please select all required files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.previewWeekly(
        files.weekly,
        files.cash,
        files.payroll,
        files.reimb,
        files.loans
      )
      setPreview(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!requiredFilesReady) {
      setError('Please select all required files')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.processWeekly(
        files.weekly,
        files.cash,
        files.payroll,
        files.reimb,
        files.loans
      )
      setSuccess(`Downloaded: ${result.cash_filename} and ${result.payroll_filename}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process files')
    } finally {
      setLoading(false)
    }
  }

  const FileUpload = ({ fileKey, label, required = true }) => (
    <div className="form-group" style={{ marginBottom: '12px' }}>
      <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>
        {label} {!required && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>(Opt)</span>}
      </label>
      <div
        className={`file-upload ${files[fileKey] ? 'has-file' : ''}`}
        onClick={() => inputRefs[fileKey].current?.click()}
        style={{ padding: '12px 8px', minHeight: '80px' }}
      >
        <input
          ref={inputRefs[fileKey]}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect(fileKey)}
          style={{ display: 'none' }}
        />
        {files[fileKey] ? (
          <div className="file-name" style={{ fontSize: '11px', padding: '4px 8px', wordBreak: 'break-all' }}>
            <CheckCircle size={12} />
            {files[fileKey].name.length > 15 ? files[fileKey].name.slice(0, 15) + '...' : files[fileKey].name}
          </div>
        ) : (
          <>
            <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
            <p className="file-upload-text" style={{ fontSize: '11px' }}>
              Click to upload
            </p>
          </>
        )}
      </div>
    </div>
  )

  const getScoreBadge = (score) => {
    if (score >= 92) return <span className="badge badge-success">{score}</span>
    if (score >= 85) return <span className="badge badge-warning">{score}</span>
    return <span className="badge badge-error">{score}</span>
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Weekly Reports</h2>
        <p className="section-description">
          Generate Cash and Payroll reports from weekly hours
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

        <div className="file-upload-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          <FileUpload fileKey="weekly" label="Weekly Hours" />
          <FileUpload fileKey="cash" label="Cash Template" />
          <FileUpload fileKey="payroll" label="Payroll Template" />
          <FileUpload fileKey="reimb" label="Reimb & Bonus" />
          <FileUpload fileKey="loans" label="Loans" required={false} />
        </div>

        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={loading || !requiredFilesReady}
          >
            {loading ? <div className="spinner" /> : <Eye size={18} />}
            Preview
          </button>
          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={loading || !requiredFilesReady}
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
                <DollarSign size={20} />
                Processing Summary
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {preview.total_yards.toFixed(0)}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Yards</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                  {preview.cash_preview.length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Cash Entries</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                  {preview.payroll_preview.length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Payroll Entries</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: preview.unmatched.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {preview.unmatched.length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Unmatched</div>
              </div>
            </div>
          </div>

          {preview.bonus_summary.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Gift size={20} />
                  Bonuses
                </h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Position</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.bonus_summary.map((b, i) => (
                      <tr key={i}>
                        <td>{b.name}</td>
                        <td>{b.position}</td>
                        <td style={{ color: 'var(--success)', fontWeight: '600' }}>
                          ${b.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.loan_notes.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <CreditCard size={20} />
                  Loan Deductions
                </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {preview.loan_notes.map((note, i) => (
                  <li key={i} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-secondary)'
                  }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Users size={20} />
                Name Matching Results
              </h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Weekly Name</th>
                    <th>Cash Match</th>
                    <th>Score</th>
                    <th>Payroll Match</th>
                    <th>Score</th>
                    <th>Regular</th>
                    <th>OT</th>
                    <th>Sick</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.match_results.map((m, i) => (
                    <tr key={i}>
                      <td>{m.weekly_name}</td>
                      <td>{m.cash_name}</td>
                      <td>{getScoreBadge(m.cash_score)}</td>
                      <td>{m.payroll_name}</td>
                      <td>{getScoreBadge(m.payroll_score)}</td>
                      <td>{m.regular.toFixed(2)}</td>
                      <td>{m.overtime.toFixed(2)}</td>
                      <td>{m.sick.toFixed(2)}</td>
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

export default WeeklyProcessor
