import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        
        if (!refreshToken) {
          useAuthStore.getState().logout();
          return Promise.reject(error);
        }

        // Try to refresh token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        // Retry original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API helpers
export const apiHelpers = {
  // Agents
  agents: {
    list: (params?: Record<string, any>) => api.get('/agents', { params }),
    get: (id: string) => api.get(`/agents/${id}`),
    create: (data: any) => api.post('/agents', data),
    update: (id: string, data: any) => api.patch(`/agents/${id}`, data),
    delete: (id: string) => api.delete(`/agents/${id}`),
    clone: (id: string, name?: string) => api.post(`/agents/${id}/clone`, { name }),
    versions: (id: string) => api.get(`/agents/${id}/versions`),
  },

  // Runs
  runs: {
    list: (params?: Record<string, any>) => api.get('/runs', { params }),
    get: (id: string) => api.get(`/runs/${id}`),
    start: (agentId: string, input: any) => api.post('/runs', { agentId, input }),
    cancel: (id: string) => api.post(`/runs/${id}/cancel`),
    messages: (id: string) => api.get(`/runs/${id}/messages`),
  },

  // Tools
  tools: {
    list: (params?: Record<string, any>) => api.get('/tools', { params }),
    get: (id: string) => api.get(`/tools/${id}`),
    create: (data: any) => api.post('/tools', data),
    update: (id: string, data: any) => api.patch(`/tools/${id}`, data),
    delete: (id: string) => api.delete(`/tools/${id}`),
    test: (id: string, input: any) => api.post(`/tools/${id}/test`, { input }),
  },

  // Users
  users: {
    list: (params?: Record<string, any>) => api.get('/users', { params }),
    get: (id: string) => api.get(`/users/${id}`),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
    delete: (id: string) => api.delete(`/users/${id}`),
    updateProfile: (data: any) => api.patch('/users/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post('/users/change-password', { currentPassword, newPassword }),
  },

  // Auth
  auth: {
    login: (email: string, password: string) =>
      api.post('/auth/login', { email, password }),
    register: (data: any) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    profile: () => api.get('/auth/profile'),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post('/auth/change-password', { currentPassword, newPassword }),
  },

  // Analytics
  analytics: {
    dashboard: () => api.get('/analytics/dashboard'),
    runs: (params?: Record<string, any>) => api.get('/analytics/runs', { params }),
    agents: (params?: Record<string, any>) => api.get('/analytics/agents', { params }),
    tokenUsage: (params?: Record<string, any>) =>
      api.get('/analytics/token-usage', { params }),
    systemMetrics: () => api.get('/analytics/system-metrics'),
  },

  // Audit
  audit: {
    list: (params?: Record<string, any>) => api.get('/audit', { params }),
    stats: () => api.get('/audit/stats'),
    export: (params?: Record<string, any>) =>
      api.get('/audit/export', { params, responseType: 'blob' }),
  },

  // LLM
  llm: {
    models: () => api.get('/llm/models'),
    providers: () => api.get('/llm/providers'),
    chat: (data: any) => api.post('/llm/chat', data),
  },
};

export default api;
