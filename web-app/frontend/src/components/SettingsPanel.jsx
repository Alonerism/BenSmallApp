import React, { useState, useRef } from 'react'
import {
  Save,
  RotateCcw,
  Download,
  Upload,
  Clock,
  Timer,
  Users,
  AlertTriangle,
  Gift,
  UserCheck,
  CreditCard,
  FileOutput,
  ChevronDown,
  CheckCircle,
  XCircle
} from 'lucide-react'
import api from '../utils/api'

function SettingsPanel({ settings, onUpdate, onReset }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    rounding: true,
    hours: true,
    hourCaps: false,
    matching: false,
    flagging: false,
    bonuses: false,
    employeeTypes: false,
    loans: false,
    output: false
  })

  const importRef = useRef(null)

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const updateNestedSetting = (section, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const success = await onUpdate(localSettings)

    if (success) {
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } else {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }

    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleReset = async () => {
    if (window.confirm('Reset all settings to defaults?')) {
      try {
        await api.resetSettings()
        await onReset()
        setLocalSettings(await api.getSettings())
        setMessage({ type: 'success', text: 'Settings reset to defaults' })
        setTimeout(() => setMessage(null), 3000)
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to reset settings' })
      }
    }
  }

  const handleExport = async () => {
    await api.exportSettings()
    setMessage({ type: 'success', text: 'Settings exported!' })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const imported = await api.importSettings(text)
      setLocalSettings(imported)
      setMessage({ type: 'success', text: 'Settings imported successfully!' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to import settings' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const Toggle = ({ checked, onChange }) => (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )

  const Section = ({ id, title, icon: Icon, children }) => (
    <div className="settings-section">
      <div
        className={`collapsible-header ${expandedSections[id] ? 'open' : ''}`}
        onClick={() => toggleSection(id)}
      >
        <h3 className="settings-section-title">
          <Icon size={18} />
          {title}
        </h3>
        <ChevronDown size={20} />
      </div>
      <div className={`collapsible-content ${expandedSections[id] ? 'open' : ''}`}>
        <div style={{ paddingTop: '16px' }}>
          {children}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Settings</h2>
        <p className="section-description">
          Configure processing rules, thresholds, and output formats
        </p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <Save size={18} />}
            Save Settings
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={18} />
            Reset to Defaults
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={18} />
            Export
          </button>
          <button className="btn btn-secondary" onClick={() => importRef.current?.click()}>
            <Upload size={18} />
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="settings-grid">
        {/* Rounding Settings */}
        <Section id="rounding" title="Hour Rounding" icon={Clock}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Round To (hours)</label>
              <select
                className="form-select"
                value={localSettings.rounding.round_to}
                onChange={(e) => updateNestedSetting('rounding', 'round_to', parseFloat(e.target.value))}
              >
                <option value={0.25}>15 minutes (0.25)</option>
                <option value={0.5}>30 minutes (0.5)</option>
                <option value={1}>1 hour</option>
              </select>
              <p className="form-hint">Round hours to the nearest increment</p>
            </div>

            <div className="form-group">
              <label className="form-label">Rounding Mode</label>
              <select
                className="form-select"
                value={localSettings.rounding.round_mode}
                onChange={(e) => updateNestedSetting('rounding', 'round_mode', e.target.value)}
              >
                <option value="nearest">Nearest</option>
                <option value="up">Always Round Up</option>
                <option value="down">Always Round Down</option>
              </select>
            </div>
          </div>

          <div className="toggle-group">
            <div>
              <div className="toggle-label">Enable Special Rounding Rules</div>
              <div className="toggle-description">E.g., 8:00-8:25 rounds to 8:00 instead of 8:30</div>
            </div>
            <Toggle
              checked={localSettings.rounding.special_rules}
              onChange={(v) => updateNestedSetting('rounding', 'special_rules', v)}
            />
          </div>

          {localSettings.rounding.special_rules && (
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Special Rule Threshold (minutes)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.rounding.special_threshold_minutes}
                onChange={(e) => updateNestedSetting('rounding', 'special_threshold_minutes', parseInt(e.target.value))}
                min={0}
                max={59}
              />
            </div>
          )}
        </Section>

        {/* Hours Processing (Trump Processor Settings) */}
        <Section id="hours" title="Hours Processing" icon={Timer}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Daily Regular Cap</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hours?.daily_reg_cap ?? 8.0}
                onChange={(e) => updateNestedSetting('hours', 'daily_reg_cap', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Max regular hours per day before overtime</p>
            </div>

            <div className="form-group">
              <label className="form-label">Daily Max Hours</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hours?.daily_max ?? 16.0}
                onChange={(e) => updateNestedSetting('hours', 'daily_max', parseFloat(e.target.value))}
                step={1}
              />
              <p className="form-hint">Maximum plausible hours per day (sanity check)</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Long Stint Flag (hours)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hours?.long_stint_flag ?? 10.0}
                onChange={(e) => updateNestedSetting('hours', 'long_stint_flag', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Flag single work stints longer than this</p>
            </div>

            <div className="form-group">
              <label className="form-label">Flag Low Weekday (hours)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hours?.flag_low_weekday ?? 2.0}
                onChange={(e) => updateNestedSetting('hours', 'flag_low_weekday', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Flag weekday shifts shorter than this</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Suggested Lunch Deduction (hours)</label>
            <input
              type="number"
              className="form-input"
              value={localSettings.hours?.suggest_lunch_deduct ?? 0.5}
              onChange={(e) => updateNestedSetting('hours', 'suggest_lunch_deduct', parseFloat(e.target.value))}
              step={0.25}
            />
            <p className="form-hint">Suggested deduction for long stints without breaks</p>
          </div>
        </Section>

        {/* Hour Caps */}
        <Section id="hourCaps" title="Hour Caps & Limits" icon={Timer}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Daily Regular Cap</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hour_caps.daily_regular_cap}
                onChange={(e) => updateNestedSetting('hour_caps', 'daily_regular_cap', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Max regular hours per day before overtime</p>
            </div>

            <div className="form-group">
              <label className="form-label">Weekly OT Threshold</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hour_caps.weekly_ot_threshold}
                onChange={(e) => updateNestedSetting('hour_caps', 'weekly_ot_threshold', parseFloat(e.target.value))}
                step={1}
              />
              <p className="form-hint">Weekly hours before overtime</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payroll Sick Ceiling</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hour_caps.payroll_sick_ceiling}
                onChange={(e) => updateNestedSetting('hour_caps', 'payroll_sick_ceiling', parseFloat(e.target.value))}
                step={1}
              />
              <p className="form-hint">Max hours payroll covers after sick time</p>
            </div>

            <div className="form-group">
              <label className="form-label">Daily Max (Sanity Check)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.hour_caps.daily_max_sanity}
                onChange={(e) => updateNestedSetting('hour_caps', 'daily_max_sanity', parseFloat(e.target.value))}
                step={1}
              />
              <p className="form-hint">Maximum plausible hours per day</p>
            </div>
          </div>
        </Section>

        {/* Name Matching */}
        <Section id="matching" title="Name Matching" icon={Users}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Strict Match Score</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.matching.strict_score}
                onChange={(e) => updateNestedSetting('matching', 'strict_score', parseInt(e.target.value))}
                min={50}
                max={100}
              />
              <p className="form-hint">Primary threshold (higher = stricter)</p>
            </div>

            <div className="form-group">
              <label className="form-label">Fallback Match Score</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.matching.fallback_score}
                onChange={(e) => updateNestedSetting('matching', 'fallback_score', parseInt(e.target.value))}
                min={50}
                max={100}
              />
              <p className="form-hint">For last-name matching fallback</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bonus Match Score</label>
            <input
              type="number"
              className="form-input"
              value={localSettings.matching.bonus_match_score}
              onChange={(e) => updateNestedSetting('matching', 'bonus_match_score', parseInt(e.target.value))}
              min={50}
              max={100}
            />
            <p className="form-hint">Threshold for matching bonus recipients</p>
          </div>
        </Section>

        {/* Anomaly Flagging */}
        <Section id="flagging" title="Anomaly Detection" icon={AlertTriangle}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Long Shift Threshold (hours)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.flagging.long_shift_hours}
                onChange={(e) => updateNestedSetting('flagging', 'long_shift_hours', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Flag shifts longer than this</p>
            </div>

            <div className="form-group">
              <label className="form-label">Short Weekday Threshold (hours)</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.flagging.short_weekday_hours}
                onChange={(e) => updateNestedSetting('flagging', 'short_weekday_hours', parseFloat(e.target.value))}
                step={0.5}
              />
              <p className="form-hint">Flag weekday shifts shorter than this</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Suggested Lunch Deduction (hours)</label>
            <input
              type="number"
              className="form-input"
              value={localSettings.flagging.suggest_lunch_deduct}
              onChange={(e) => updateNestedSetting('flagging', 'suggest_lunch_deduct', parseFloat(e.target.value))}
              step={0.25}
            />
          </div>
        </Section>

        {/* Bonus Settings */}
        <Section id="bonuses" title="Bonus Calculations" icon={Gift}>
          <div className="toggle-group">
            <div>
              <div className="toggle-label">Enable Foreman Bonus</div>
              <div className="toggle-description">Calculate bonuses for foreman positions</div>
            </div>
            <Toggle
              checked={localSettings.bonuses.foreman_enabled}
              onChange={(v) => updateNestedSetting('bonuses', 'foreman_enabled', v)}
            />
          </div>

          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">3x Multiplier</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.bonuses.triple_multiplier}
                onChange={(e) => updateNestedSetting('bonuses', 'triple_multiplier', parseFloat(e.target.value))}
                step={0.1}
              />
              <p className="form-hint">Multiplier for 3x bonus positions</p>
            </div>

            <div className="form-group">
              <label className="form-label">0.5x Multiplier</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.bonuses.half_multiplier}
                onChange={(e) => updateNestedSetting('bonuses', 'half_multiplier', parseFloat(e.target.value))}
                step={0.1}
              />
              <p className="form-hint">Multiplier for 0.5x bonus positions</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">1x Multiplier</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.bonuses.standard_multiplier}
                onChange={(e) => updateNestedSetting('bonuses', 'standard_multiplier', parseFloat(e.target.value))}
                step={0.1}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Uploads Score</label>
              <input
                type="number"
                className="form-input"
                value={localSettings.bonuses.uploads_max_score}
                onChange={(e) => updateNestedSetting('bonuses', 'uploads_max_score', parseInt(e.target.value))}
              />
              <p className="form-hint">Maximum foreman uploads score</p>
            </div>
          </div>
        </Section>

        {/* Employee Types */}
        <Section id="employeeTypes" title="Employee Type Rules" icon={UserCheck}>
          <div className="form-group">
            <label className="form-label">Type C Payroll Cap</label>
            <input
              type="number"
              className="form-input"
              value={localSettings.employee_types.type_c_payroll_cap}
              onChange={(e) => updateNestedSetting('employee_types', 'type_c_payroll_cap', parseFloat(e.target.value))}
              step={1}
            />
            <p className="form-hint">Payroll cap for Type C employees</p>
          </div>

          <div className="form-group">
            <label className="form-label">Type B Weekly Cap</label>
            <input
              type="number"
              className="form-input"
              value={localSettings.employee_types.type_b_weekly_cap}
              onChange={(e) => updateNestedSetting('employee_types', 'type_b_weekly_cap', parseFloat(e.target.value))}
              step={1}
            />
            <p className="form-hint">Weekly regular cap for Type B before OT</p>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Employee Type Descriptions</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              <strong>Type A:</strong> {localSettings.employee_types.type_a_description}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              <strong>Type B:</strong> {localSettings.employee_types.type_b_description}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              <strong>Type C:</strong> {localSettings.employee_types.type_c_description}
            </p>
          </div>
        </Section>

        {/* Loan Settings */}
        <Section id="loans" title="Loan Processing" icon={CreditCard}>
          <div className="toggle-group">
            <div>
              <div className="toggle-label">Enable Loan Processing</div>
              <div className="toggle-description">Process loans file and apply deductions</div>
            </div>
            <Toggle
              checked={localSettings.loans.enabled}
              onChange={(v) => updateNestedSetting('loans', 'enabled', v)}
            />
          </div>

          <div className="toggle-group">
            <div>
              <div className="toggle-label">Auto Deduct</div>
              <div className="toggle-description">Automatically deduct loan payments from cash</div>
            </div>
            <Toggle
              checked={localSettings.loans.auto_deduct}
              onChange={(v) => updateNestedSetting('loans', 'auto_deduct', v)}
            />
          </div>

          <div className="toggle-group">
            <div>
              <div className="toggle-label">Prevent Negative</div>
              <div className="toggle-description">Never deduct more than available cash</div>
            </div>
            <Toggle
              checked={localSettings.loans.prevent_negative}
              onChange={(v) => updateNestedSetting('loans', 'prevent_negative', v)}
            />
          </div>

          <div className="toggle-group">
            <div>
              <div className="toggle-label">Move Paid to History</div>
              <div className="toggle-description">Move fully-paid loans to history sheet</div>
            </div>
            <Toggle
              checked={localSettings.loans.move_paid_to_history}
              onChange={(v) => updateNestedSetting('loans', 'move_paid_to_history', v)}
            />
          </div>
        </Section>

        {/* Output Settings */}
        <Section id="output" title="Output Files" icon={FileOutput}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Format</label>
              <input
                type="text"
                className="form-input"
                value={localSettings.output.date_format}
                onChange={(e) => updateNestedSetting('output', 'date_format', e.target.value)}
              />
              <p className="form-hint">Format for file naming (Python strftime)</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cash File Prefix</label>
              <input
                type="text"
                className="form-input"
                value={localSettings.output.cash_prefix}
                onChange={(e) => updateNestedSetting('output', 'cash_prefix', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payroll File Prefix</label>
              <input
                type="text"
                className="form-input"
                value={localSettings.output.payroll_prefix}
                onChange={(e) => updateNestedSetting('output', 'payroll_prefix', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weekly File Prefix</label>
            <input
              type="text"
              className="form-input"
              value={localSettings.output.weekly_prefix}
              onChange={(e) => updateNestedSetting('output', 'weekly_prefix', e.target.value)}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}

export default SettingsPanel
