const API_BASE = 'https://url-shortener-j5z1.onrender.com/api';
// Helper to get auth headers
function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper to handle response errors
async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = 'Something went wrong';
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // response wasn't json or lacked message
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export const api = {
  // Auth API
  auth: {
    async register(name, email, password, role = 'user', country = 'India') {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, email, password, role, country })
      });
      return handleResponse(res);
    },
    async login(email, password) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password })
      });
      return handleResponse(res);
    },
    async getMe() {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async forgotPassword(email) {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      return handleResponse(res);
    },
    async resetPassword(token, newPassword) {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      return handleResponse(res);
    },
    async updateProfile(name, email, password, country) {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name, email, password, country })
      });
      return handleResponse(res);
    }
  },

  // URLs API
  urls: {
    async create({ originalUrl, customAlias, password, expiresAt }) {
      const res = await fetch(`${API_BASE}/urls`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ originalUrl, customAlias, password, expiresAt })
      });
      return handleResponse(res);
    },
    async getUrls() {
      const res = await fetch(`${API_BASE}/urls`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async edit(id, { originalUrl, password, expiresAt }) {
      const res = await fetch(`${API_BASE}/urls/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ originalUrl, password, expiresAt })
      });
      return handleResponse(res);
    },
    async delete(id) {
      const res = await fetch(`${API_BASE}/urls/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async bulkCreate(urlArray) {
      const res = await fetch(`${API_BASE}/urls/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ urls: urlArray })
      });
      return handleResponse(res);
    },
    async verifyPassword(shortCode, password) {
      const res = await fetch(`${API_BASE}/urls/verify-password/${shortCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      return handleResponse(res);
    }
  },

  // Analytics API
  analytics: {
    async getUrlAnalytics(urlId) {
      const res = await fetch(`${API_BASE}/analytics/${urlId}`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async getGlobalAnalytics() {
      const res = await fetch(`${API_BASE}/analytics/global`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async getUserOverviewAnalytics() {
      const res = await fetch(`${API_BASE}/analytics`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  },

  // Notifications API
  notifications: {
    async getNotifications() {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'GET',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async markAsRead(id) {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async markAllAsRead() {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  },

  // Reports Links
  reports: {
    getCSVUrl(urlId) {
      const token = localStorage.getItem('token');
      return `${API_BASE}/reports/csv/${urlId}?token=${token}`;
    },
    getExcelUrl(urlId) {
      const token = localStorage.getItem('token');
      return `${API_BASE}/reports/excel/${urlId}?token=${token}`;
    },
    getPDFUrl(urlId) {
      const token = localStorage.getItem('token');
      return `${API_BASE}/reports/pdf/${urlId}?token=${token}`;
    }
  }
};
