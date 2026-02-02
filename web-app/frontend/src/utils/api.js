import axios from 'axios'

const BASE_URL = '/api'

// Create axios instance
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000 // 60 seconds for file processing
})

// Add auth token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.reload()
    }
    throw error.response?.data || error
  }
)

// API functions
const api = {
  // Auth
  login: async (username, password) => {
    const response = await client.post('/auth/login', { username, password })
    const { token, user } = response.data
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    return response.data
  },

  signup: async (username, password) => {
    const response = await client.post('/auth/signup', { username, password })
    return response.data
  },

  logout: async () => {
    try {
      await client.post('/auth/logout')
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  },

  getStoredUser: () => {
    const user = localStorage.getItem('auth_user')
    return user ? JSON.parse(user) : null
  },

  getStoredToken: () => {
    return localStorage.getItem('auth_token')
  },

  // Admin - User Management
  listUsers: async () => {
    const response = await client.get('/admin/users')
    return response.data
  },

  approveUser: async (userId) => {
    const response = await client.post(`/admin/users/${userId}/approve`)
    return response.data
  },

  deleteUser: async (userId) => {
    const response = await client.delete(`/admin/users/${userId}`)
    return response.data
  },

  // Settings
  getSettings: async () => {
    const response = await client.get('/settings')
    return response.data
  },

  updateSettings: async (settings) => {
    const response = await client.put('/settings', settings)
    return response.data
  },

  resetSettings: async () => {
    const response = await client.post('/settings/reset')
    return response.data
  },

  exportSettings: async () => {
    const response = await client.get('/settings/export', {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'payroll_settings.json')
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  importSettings: async (jsonString) => {
    const response = await client.post('/settings/import', {
      settings_json: jsonString
    })
    return response.data
  },

  // Storage Status
  getStorageStatus: async () => {
    const response = await client.get('/storage/status')
    return response.data
  },

  // Templates
  listTemplates: async () => {
    const response = await client.get('/templates')
    return response.data
  },

  uploadTemplate: async (category, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await client.post(`/templates/${category}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  downloadTemplate: async (category, filename) => {
    const response = await client.get(`/templates/${category}`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  deleteTemplate: async (category) => {
    const response = await client.delete(`/templates/${category}`)
    return response.data
  },

  // Output History
  listOutputs: async (outputType = null, limit = 50, offset = 0) => {
    const params = { limit, offset }
    if (outputType) params.output_type = outputType
    const response = await client.get('/outputs', { params })
    return response.data
  },

  downloadOutput: async (outputId, filename) => {
    const response = await client.get(`/outputs/${outputId}`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  deleteOutput: async (outputId) => {
    const response = await client.delete(`/outputs/${outputId}`)
    return response.data
  },

  // Daily Processing
  previewDaily: async (tarFile, weeklyFile) => {
    const formData = new FormData()
    formData.append('tar_file', tarFile)
    formData.append('weekly_file', weeklyFile)

    const response = await client.post('/daily/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  processDaily: async (tarFile, weeklyFile, saveToHistory = false) => {
    const formData = new FormData()
    formData.append('tar_file', tarFile)
    formData.append('weekly_file', weeklyFile)

    const response = await client.post(`/daily/process?save_to_history=${saveToHistory}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob'
    })

    const contentDisposition = response.headers['content-disposition']
    let filename = 'Weekly_Updated.xlsx'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/)
      if (match) filename = match[1]
    }

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()

    return filename
  },

  // Full Week Processing
  previewFullWeek: async (timeDataFile, weeklyTemplateFile) => {
    const formData = new FormData()
    formData.append('time_data_file', timeDataFile)
    formData.append('weekly_template_file', weeklyTemplateFile)

    const response = await client.post('/fullweek/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  processFullWeek: async (timeDataFile, weeklyTemplateFile, saveToHistory = false) => {
    const formData = new FormData()
    formData.append('time_data_file', timeDataFile)
    formData.append('weekly_template_file', weeklyTemplateFile)

    const response = await client.post(`/fullweek/process?save_to_history=${saveToHistory}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob'
    })

    const contentDisposition = response.headers['content-disposition']
    let filename = 'Weekly_Filled.xlsx'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/)
      if (match) filename = match[1]
    }

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()

    return filename
  },

  // Weekly Processing
  previewWeekly: async (weeklyFile, cashFile, payrollFile, reimbFile, loansFile) => {
    const formData = new FormData()
    formData.append('weekly_file', weeklyFile)
    formData.append('cash_file', cashFile)
    formData.append('payroll_file', payrollFile)
    formData.append('reimb_file', reimbFile)
    if (loansFile) {
      formData.append('loans_file', loansFile)
    }

    const response = await client.post('/weekly/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  processWeekly: async (weeklyFile, cashFile, payrollFile, reimbFile, loansFile) => {
    const formData = new FormData()
    formData.append('weekly_file', weeklyFile)
    formData.append('cash_file', cashFile)
    formData.append('payroll_file', payrollFile)
    formData.append('reimb_file', reimbFile)
    if (loansFile) {
      formData.append('loans_file', loansFile)
    }

    const response = await client.post('/weekly/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    // Decode and download both files
    const { cash_filename, payroll_filename, cash_base64, payroll_base64 } = response.data

    // Download cash file
    const cashBlob = new Blob([Uint8Array.from(atob(cash_base64), c => c.charCodeAt(0))], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const cashUrl = window.URL.createObjectURL(cashBlob)
    const cashLink = document.createElement('a')
    cashLink.href = cashUrl
    cashLink.setAttribute('download', cash_filename)
    document.body.appendChild(cashLink)
    cashLink.click()
    cashLink.remove()

    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 500))

    // Download payroll file
    const payrollBlob = new Blob([Uint8Array.from(atob(payroll_base64), c => c.charCodeAt(0))], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const payrollUrl = window.URL.createObjectURL(payrollBlob)
    const payrollLink = document.createElement('a')
    payrollLink.href = payrollUrl
    payrollLink.setAttribute('download', payroll_filename)
    document.body.appendChild(payrollLink)
    payrollLink.click()
    payrollLink.remove()

    return { cash_filename, payroll_filename }
  },

  // Health check
  healthCheck: async () => {
    const response = await client.get('/health')
    return response.data
  }
}

export default api
