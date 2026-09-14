const API_BASE = '/api/admin';

const TOKEN_KEY = 'admin_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function redirectToLogin() {
  clearToken();
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    const isAlreadyOnLogin = window.location.pathname === '/admin/login';
    if (!isAlreadyOnLogin) {
      const redirectParam = encodeURIComponent(currentPath);
      window.location.href = `/admin/login?redirect=${redirectParam}`;
    }
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkErr) {
    throw new Error('Network error — please check your connection and try again.');
  }

  if (response.status === 401 || response.status === 403) {
    redirectToLogin();
    throw new Error('Session expired. Please log in again.');
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function adminLogin(username, password) {
  const data = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (data && data.token) {
    setToken(data.token);
  }

  return data;
}

export async function adminLogout() {
  try {
    await request('/logout', {
      method: 'POST',
    });
  } finally {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  }
}

export async function getAdminStats({ period = 'daily', startDate, endDate } = {}) {
  const params = new URLSearchParams();
  params.set('period', period);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  return request(`/stats?${params.toString()}`, {
    method: 'GET',
  });
}

export function isAdminAuthenticated() {
  return Boolean(getToken());
}

export default {
  adminLogin,
  adminLogout,
  getAdminStats,
  isAdminAuthenticated,
};