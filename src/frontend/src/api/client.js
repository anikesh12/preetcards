import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
});

// ---------------------------------------------------------------------------
// Public card endpoints
// ---------------------------------------------------------------------------

export async function createCard(formData) {
  const response = await client.post('/cards', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getCard(cardId) {
  const response = await client.get(`/cards/${encodeURIComponent(cardId)}`);
  return response.data;
}

// ---------------------------------------------------------------------------
// Admin authentication
//
// Security note: we never store the admin username/password (or a Basic Auth
// token derived from them) in any client-accessible storage. Instead, the
// admin client logs in against a server-side session endpoint. The server
// validates the credentials once and issues an HttpOnly, Secure session
// cookie. All subsequent admin requests rely on that cookie (sent
// automatically by the browser via `withCredentials`) — the frontend never
// re-sends or persists the password, and JavaScript has no access to the
// cookie's contents.
// ---------------------------------------------------------------------------

const ADMIN_SESSION_FLAG_KEY = 'adminSessionActive';

// Simple pub/sub so UI components (e.g. an admin login modal) can react
// when a session expires or a request comes back unauthorized, without this
// module needing to know about React state/routing.
const authListeners = new Set();

export function onAdminAuthRequired(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAdminAuthRequired(reason) {
  clearAdminSessionFlag();
  authListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch (err) {
      // Never let a listener error break the auth flow.
      console.error('admin auth listener error', err);
    }
  });
}

function setAdminSessionFlag() {
  try {
    sessionStorage.setItem(ADMIN_SESSION_FLAG_KEY, 'true');
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing); non-fatal.
  }
}

function clearAdminSessionFlag() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_FLAG_KEY);
  } catch {
    // ignore
  }
}

// Best-effort hint for the UI to decide whether to show a login prompt on
// mount. The real source of truth is always the server (via the HttpOnly
// cookie), so this flag is only ever used optimistically.
export function hasActiveAdminSessionHint() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Log in as admin. Credentials are sent once, over HTTPS, directly to the
 * login endpoint and are never persisted client-side. On success the server
 * sets an HttpOnly session cookie; the browser will attach it automatically
 * on subsequent admin requests.
 */
export async function adminLogin(username, password) {
  try {
    const response = await client.post(
      '/admin/login',
      { username, password },
      { withCredentials: true }
    );
    setAdminSessionFlag();
    return response.data;
  } catch (error) {
    clearAdminSessionFlag();
    throw normalizeAdminError(error);
  }
}

export async function adminLogout() {
  try {
    await client.post('/admin/logout', null, { withCredentials: true });
  } finally {
    clearAdminSessionFlag();
  }
}

/**
 * Internal helper for authenticated admin requests. Relies on the HttpOnly
 * session cookie (withCredentials: true) rather than any header built from
 * stored credentials. On a 401 response, clears local session hints and
 * notifies listeners so the UI can prompt the user to re-authenticate.
 */
async function adminRequest(config) {
  try {
    const response = await client.request({
      ...config,
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      notifyAdminAuthRequired('session_expired');
    }
    throw normalizeAdminError(error);
  }
}

function normalizeAdminError(error) {
  if (error.response) {
    const message =
      (error.response.data && error.response.data.message) ||
      `Request failed with status ${error.response.status}`;
    const normalized = new Error(message);
    normalized.status = error.response.status;
    return normalized;
  }
  return error;
}

// ---------------------------------------------------------------------------
// Admin stats endpoints
// ---------------------------------------------------------------------------

export async function fetchAdminOverviewStats() {
  return adminRequest({ method: 'get', url: '/admin/stats/overview' });
}

export async function fetchAdminCardStats({ page = 1, pageSize = 20 } = {}) {
  return adminRequest({
    method: 'get',
    url: '/admin/stats/cards',
    params: { page, pageSize },
  });
}

export async function fetchAdminStorageStats() {
  return adminRequest({ method: 'get', url: '/admin/stats/storage' });
}

export default client;