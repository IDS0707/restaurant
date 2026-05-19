import axios from 'axios'

const BASE_URL = 'http://109.123.253.238:8080/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

export const agentAPI = {
  getByCode: (code) => api.get(`/agents/code/${code}`),
  getHistory: (code) => api.get(`/agents/code/${code}/history`),
}

export const menuAPI = {
  getAll: () => api.get('/menu'),
}

export default api
