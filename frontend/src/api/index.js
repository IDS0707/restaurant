import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use(config => {
  // Customer scope routes always send the customer token.
  // The cashier/admin app uses the admin token.
  // POST /orders ham mijoz token'i bilan keladi (agar bor bo'lsa) — backend customer_id ni biriktiradi.
  const isCustomerRoute = (config.url || '').startsWith('/customer/') ||
                          (config.url || '') === '/customer/register' ||
                          (config.url || '') === '/customer/login' ||
                          (config.url || '') === '/orders'
  if (isCustomerRoute) {
    const ct = localStorage.getItem('eco_customer_token')
    if (ct) config.headers.Authorization = `Bearer ${ct}`
  } else {
    const token = localStorage.getItem('eco_taomlar_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || ''
    const isCustomer = url.startsWith('/customer/')
    if (err.response?.status === 401) {
      if (isCustomer) {
        localStorage.removeItem('eco_customer_token')
        // Don't redirect — let the shop UI re-show registration screen
      } else if (!url.startsWith('/orders') && !url.startsWith('/menu')) {
        localStorage.removeItem('eco_taomlar_token')
        window.location.href = '/admin'
      }
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

export const promoAPI = {
  getAll: () => api.get('/admin/promo'),
  create: (data) => api.post('/admin/promo', data),
  update: (id, data) => api.put(`/admin/promo/${id}`, data),
  delete: (id) => api.delete(`/admin/promo/${id}`),
  check: (code, order_total) => api.post('/promo/check', { code, order_total }),
}

export const customerAPI = {
  register: (data) => api.post('/customer/register', data),
  login: (data) => api.post('/customer/login', data),
  me: () => api.get('/customer/me'),
  updateMe: (data) => api.put('/customer/me', data),
  orders: () => api.get('/customer/orders'),
  addresses: () => api.get('/customer/addresses'),
  addAddress: (data) => api.post('/customer/addresses', data),
  deleteAddress: (id) => api.delete(`/customer/addresses/${id}`),
  cancelOrder: (code, reason) => api.post(`/customer/orders/${code}/cancel`, { reason }),
}

export const vipAPI = {
  getAll: () => api.get('/admin/vip'),
  create: (data) => api.post('/admin/vip', data),
  update: (id, data) => api.put(`/admin/vip/${id}`, data),
  delete: (id) => api.delete(`/admin/vip/${id}`),
}

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
}

export default api
