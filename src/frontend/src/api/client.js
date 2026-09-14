const API_BASE = '/api';

const ADMIN_AUTH_STORAGE_KEY = 'admin_auth_credentials';

/**
 * Generic response handler — throws a normalized error for non-OK responses.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.message) {
        message = data.message;
      }
    } catch {
      // response body wasn't JSON — ignore and use default message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Card API (create + retrieve)
// ---------------------------------------------------------------------------

export async function createCard(formData) {
  const response = await fetch(`${API_BASE}/cards`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
}

export async function getCard(cardId) {
  const response = await fetch(`${API_BASE}/cards/${encodeURIComponent(cardId)}`);
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// Admin authentication helpers (Basic Auth, stored for the session only)
// ---------------------------------------------------------------------------

function encodeCredentials(username, password) {
  return btoa(`${username}:${password}`);
}

function getStoredAdminCredentials() {
  try {
    return sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAdminCredentials(encoded) {
  try {
    sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, encoded);
  } catch {
    // sessionStorage unavailable (e.g. private mode) — credentials just won't persist
  }
}

export function clearAdminCredentials() {
  try {
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function setAdminCredentials(username, password) {
  const encoded = encodeCredentials(username, password);
  storeAdminCredentials(encoded);
  return encoded;
}

export function hasAdminCredentials() {
  return Boolean(getStoredAdminCredentials());
}

/**
 * Prompts the user for admin username/password via a simple browser prompt
 * and stores the resulting Basic Auth credentials for subsequent requests.
 * Returns the encoded credentials, or null if the user cancelled.
 */
export function promptAdminLogin() {
  const username = window.prompt('Admin username:');
  if (!username) {
    return null;
  }
  const password = window.prompt('Admin password:');
  if (password === null) {
    return null;
  }
  return setAdminCredentials(username, password);
}

/**
 * Performs a fetch against an admin endpoint, attaching a Basic Auth header.
 * On a 401 response, clears any stored credentials, prompts the user to
 * re-login, and retries the request once with the new credentials.
 */
async function adminFetch(path, options = {}) {
  let encoded = getStoredAdminCredentials();

  if (!encoded) {
    encoded = promptAdminLogin();
    if (!encoded) {
      const error = new Error('Admin login is required.');
      error.status = 401;
      throw error;
    }
  }

  const doRequest = (authValue) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Basic ${authValue}`,
      },
    });

  let response = await doRequest(encoded);

  if (response.status === 401) {
    clearAdminCredentials();
    const reEncoded = promptAdminLogin();
    if (!reEncoded) {
      const error = new Error('Admin authentication failed.');
      error.status = 401;
      throw error;
    }
    response = await doRequest(reEncoded);

    if (response.status === 401) {
      clearAdminCredentials();
      const error = new Error('Admin authentication failed.');
      error.status = 401;
      throw error;
    }
  }

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// Admin API (stats)
// ---------------------------------------------------------------------------

export async function getAdminStats() {
  return adminFetch('/admin/stats');
}

export async function getAdminOverview() {
  return adminFetch('/admin/overview');
}

export async function getAdminCards(params = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : '';
  return adminFetch(`/admin/cards${suffix}`);
}