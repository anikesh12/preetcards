const API_BASE = '/api';

/**
 * Handles a fetch Response, parsing JSON and throwing on error status.
 */
async function handleResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const message = (data && data.error) || (data && data.message) || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetches app configuration (e.g. available templates, limits) from the backend.
 * GET /api/config
 */
export async function getConfig() {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  return handleResponse(response);
}

/**
 * Submits a new birthday card creation request.
 * Builds a multipart/form-data payload including recipient name, message,
 * selected template, and any attached photo files.
 *
 * @param {Object} params
 * @param {string} params.recipientName
 * @param {string} params.message
 * @param {string} [params.template] - Selected card template identifier.
 * @param {File[]} [params.photos] - Array of File objects to upload.
 * @returns {Promise<Object>} The created card data (including its shareable id/url).
 */
export async function createCard({ recipientName, message, template, photos = [] }) {
  const formData = new FormData();
  formData.append('recipientName', recipientName);
  formData.append('message', message);

  if (template) {
    formData.append('template', template);
  }

  photos.forEach((photo) => {
    formData.append('photos', photo);
  });

  const response = await fetch(`${API_BASE}/cards`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse(response);
}

/**
 * Fetches a single card by its shareable id.
 * GET /api/cards/:id
 */
export async function getCard(cardId) {
  const response = await fetch(`${API_BASE}/cards/${encodeURIComponent(cardId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  return handleResponse(response);
}

export default {
  getConfig,
  createCard,
  getCard,
};