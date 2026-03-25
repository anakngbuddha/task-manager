import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
})  

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)