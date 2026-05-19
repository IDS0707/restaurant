import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('eco_taomlar_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('eco_taomlar_token')
      window.location.href = '/admin'
    }
    return Promise.reject(err)
  }
)

export const menuAPI = {
  getAll: () => api.get('/menu'),
  create: (data) => api.post('/admin/menu', data),
  update: (id, data) => api.put(`/admin/menu/${id}`, data),
  delete: (id) => api.delete(`/admin/menu/${id}`),
  toggleAvailability: (id, available) => api.patch(`/admin/menu/${id}/availability`, { available }),
  // Detail + recipe
  getDetail: (id) => api.get(`/admin/menu/${id}/detail`),
  updateMarkup: (id, markup_percent) => api.patch(`/admin/menu/${id}/markup`, { markup_percent }),
  addRecipeItem: (id, data) => api.post(`/admin/menu/${id}/recipe`, data),
  deleteRecipeItem: (recipeItemId) => api.delete(`/admin/recipe/${recipeItemId}`),
}

export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getAll: (status) => api.get('/orders', { params: { status } }),
  getByCode: (code) => api.get(`/orders/${code}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
}

export const agentsAPI = {
  getAll: () => api.get('/admin/agents'),
  create: (data) => api.post('/admin/agents', data),
  update: (id, data) => api.put(`/admin/agents/${id}`, data),
  delete: (id) => api.delete(`/admin/agents/${id}`),
  getById: (id) => api.get(`/admin/agents/${id}`),
  getByCode: (code) => api.get(`/agents/code/${code}`),
  getBonuses: (id) => api.get(`/admin/agents/${id}/bonuses`),
  getHistory: (code) => api.get(`/agents/code/${code}/history`),
  scanCard: (data) => api.post('/cards/scan', data),
}

export const analyticsAPI = {
  get: (period, date) => api.get('/admin/analytics', { params: { period, date } }),
  createExpense: (data) => api.post('/admin/expenses', data),
  getExpenses: () => api.get('/admin/expenses'),
}

export const inventoryAPI = {
  getAll: () => api.get('/admin/ingredients'),
  create: (data) => api.post('/admin/ingredients', data),
  update: (id, data) => api.put(`/admin/ingredients/${id}`, data),
  restock: (id, data) => api.post(`/admin/ingredients/${id}/restock`, data),
  delete: (id) => api.delete(`/admin/ingredients/${id}`),
  getLogs: () => api.get('/admin/inventory/logs'),
}

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
}

export default api
