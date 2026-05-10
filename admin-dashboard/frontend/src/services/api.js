import axios from 'axios';

const API_BASE_URL = '/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Auth APIs
export const authAPI = {
  login: (credentials) => 
    axios.post(`${API_BASE_URL}/auth/login`, credentials),
  logout: () => 
    axios.post(`${API_BASE_URL}/auth/logout`, {}, { headers: getAuthHeader() }),
  register: (userData) => 
    axios.post(`${API_BASE_URL}/auth/register`, userData),
};

// User APIs
export const userAPI = {
  getAllUsers: (limit = 20, offset = 0, search = '') =>
    axios.get(`${API_BASE_URL}/admin/users`, {
      params: { limit, offset, search },
      headers: getAuthHeader(),
    }),
  getUserById: (id) =>
    axios.get(`${API_BASE_URL}/admin/users/${id}`, { headers: getAuthHeader() }),
  getUserByEmail: (email) =>
    axios.get(`${API_BASE_URL}/admin/users/email/${email}`, { headers: getAuthHeader() }),
  banUser: (id) =>
    axios.patch(`${API_BASE_URL}/admin/users/${id}/ban`, {}, { headers: getAuthHeader() }),
  unbanUser: (id) =>
    axios.patch(`${API_BASE_URL}/admin/users/${id}/unban`, {}, { headers: getAuthHeader() }),
  changeRole: (id, role) =>
    axios.patch(`${API_BASE_URL}/admin/users/${id}/role`, { role }, { headers: getAuthHeader() }),
  updateStorageLimit: (id, storageLimit) =>
    axios.patch(`${API_BASE_URL}/admin/users/${id}/storage`, { storageLimit }, { headers: getAuthHeader() }),
  loginAsUser: (userId) =>
    axios.patch(`${API_BASE_URL}/admin/users/${userId}/login-as`, {}, { headers: getAuthHeader() }),
  deleteUser: (id) =>
    axios.delete(`${API_BASE_URL}/admin/users/${id}`, { headers: getAuthHeader() }),
};

// File APIs
export const fileAPI = {
  getAllFiles: (limit = 50, offset = 0) =>
    axios.get(`${API_BASE_URL}/admin/files`, {
      params: { limit, offset },
      headers: getAuthHeader(),
    }),
  getUserFiles: (userId, limit = 50, offset = 0) =>
    axios.get(`${API_BASE_URL}/admin/files/user/${userId}`, {
      params: { limit, offset },
      headers: getAuthHeader(),
    }),
  deleteFile: (fileId) =>
    axios.delete(`${API_BASE_URL}/admin/files/${fileId}`, { headers: getAuthHeader() }),
};

// Analytics APIs
export const analyticsAPI = {
  getStats: () =>
    axios.get(`${API_BASE_URL}/admin/analytics/stats`, { headers: getAuthHeader() }),
  getDashboardMetrics: () =>
    axios.get(`${API_BASE_URL}/admin/analytics/metrics`, { headers: getAuthHeader() }),
};

// Settings APIs
export const settingsAPI = {
  getSettings: () =>
    axios.get(`${API_BASE_URL}/admin/settings`, { headers: getAuthHeader() }),
  getSetting: (key) =>
    axios.get(`${API_BASE_URL}/admin/settings/${key}`, { headers: getAuthHeader() }),
  updateSettings: (settings) =>
    axios.patch(`${API_BASE_URL}/admin/settings`, { settings }, { headers: getAuthHeader() }),
};

// Activity APIs
export const activityAPI = {
  getActivityLogs: (limit = 50, offset = 0, action = null) =>
    axios.get(`${API_BASE_URL}/admin/activity`, {
      params: { limit, offset, action },
      headers: getAuthHeader(),
    }),
  getUserActivityLogs: (userId, limit = 50, offset = 0) =>
    axios.get(`${API_BASE_URL}/admin/activity/user/${userId}`, {
      params: { limit, offset },
      headers: getAuthHeader(),
    }),
};

export default {
  authAPI,
  userAPI,
  fileAPI,
  analyticsAPI,
  settingsAPI,
  activityAPI,
};
