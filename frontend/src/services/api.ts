import axios from 'axios';

function clearTokens() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = sessionStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          sessionStorage.setItem('accessToken', res.data.accessToken);
          sessionStorage.setItem('refreshToken', res.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(originalRequest);
        } catch {
          clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        clearTokens();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
