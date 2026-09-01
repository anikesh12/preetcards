/**
 * API client for the Birthday Wishes Card app.
 * Handles card creation (multipart/form-data upload) and card retrieval.
 */

const API_BASE = '/api';

/**
 * Custom error class carrying HTTP status and optional field-level errors
 * returned by the backend, so UI components can show inline validation.
 */
export class ApiError extends Error {
  constructor(message, status, fieldErrors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Attempts to parse an error response body as JSON to extract a friendly
 * message and any field-level validation errors. Falls back gracefully.
 */
async function buildApiErrorFromResponse(response, fallbackMessage) {
  let message = fallbackMessage;
  let fieldErrors = null;

  try {
    const data = await response.json();
    if (data) {
      if (typeof data.message === 'string' && data.message.trim()) {
        message = data.message;
      } else if (typeof data.error === 'string' && data.error.trim()) {
        message = data.error;
      }
      if (data.fieldErrors && typeof data.fieldErrors === 'object') {
        fieldErrors = data.fieldErrors;
      }
    }
  } catch {
    // Response body wasn't JSON (or was empty) — stick with fallbackMessage.
  }

  return new ApiError(message, response.status, fieldErrors);
}

/**
 * Creates a new birthday card.
 *
 * @param {Object} params
 * @param {string} params.recipientName - Name of the birthday person.
 * @param {string} params.message - Birthday message text.
 * @param {File[]} [params.photos] - Array of image File objects (max 6 recommended).
 * @param {(progress: number) => void} [onProgress] - Optional upload progress callback (0-100).
 * @returns {Promise<{id: string, [key: string]: any}>} The created card record, including its id/slug.
 * @throws {ApiError} On validation failure or network/server error.
 */
export function createCard({ recipientName, message, photos = [] }, onProgress) {
  const formData = new FormData();
  formData.append('recipientName', recipientName ?? '');
  formData.append('message', message ?? '');

  photos.forEach((file) => {
    formData.append('photos', file);
  });

  // Use XHR when progress reporting is requested, since fetch lacks
  // native upload progress events. Otherwise, use fetch for simplicity.
  if (typeof onProgress === 'function') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/cards`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const message =
            (data && (data.message || data.error)) ||
            'Something went wrong while creating your card. Please try again.';
          const fieldErrors = (data && data.fieldErrors) || null;
          reject(new ApiError(message, xhr.status, fieldErrors));
        }
      };

      xhr.onerror = () => {
        reject(new ApiError('Network error. Please check your connection and try again.', 0));
      };

      xhr.send(formData);
    });
  }

  return fetch(`${API_BASE}/cards`, {
    method: 'POST',
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      throw await buildApiErrorFromResponse(
        response,
        'Something went wrong while creating your card. Please try again.'
      );
    }
    return response.json();
  }).catch((err) => {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  });
}

/**
 * Fetches a card by its id (short slug).
 *
 * @param {string} id - The card's short slug id.
 * @returns {Promise<Object>} The card record, including recipientName, message, and photos.
 * @throws {ApiError} With status 404 if the card doesn't exist, or other status on server error.
 */
export async function getCard(id) {
  if (!id) {
    throw new ApiError('No card id provided.', 400);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}`);
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  }

  if (!response.ok) {
    const fallbackMessage =
      response.status === 404
        ? 'Card not found.'
        : 'Something went wrong while loading this card. Please try again.';
    throw await buildApiErrorFromResponse(response, fallbackMessage);
  }

  return response.json();
}