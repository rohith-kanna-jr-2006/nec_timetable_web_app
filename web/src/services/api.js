/**
 * NEC Faculty Timetable & Workload System — Web API Client Foundation
 * Centralized HTTP request client with token injection and standardized error normalization.
 */

const DEFAULT_API_URL = 'http://localhost:5000/api';

const API_BASE_URL = (
  typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL
    : DEFAULT_API_URL
).replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'nec_auth_token';
const USER_STORAGE_KEY = 'nec_user_profile';

/**
 * Retrieve saved auth token from localStorage
 */
export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist auth token in localStorage
 */
export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[API Client] Could not access localStorage:', err);
  }
}

/**
 * Clear all authentication tokens and user sessions
 */
export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (err) {
    console.warn('[API Client] Could not clear auth session:', err);
  }
}

/**
 * Centralized Fetch Request Handler
 */
async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    let data = null;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errorMessage =
        (data && data.message) ||
        (data && data.error) ||
        `HTTP Error ${response.status}: ${response.statusText}`;

      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = data?.code || 'API_ERROR';
      error.details = data?.details || null;
      error.data = data;

      // Handle 401 Unauthorized / Token Expired automatically
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        console.warn('[API Client] Session expired or invalid token (401). Clearing session.');
        clearAuthSession();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=true';
        }
      }

      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const netError = new Error(
        `Unable to reach backend service at ${API_BASE_URL}. Ensure the server is running on port 5000.`
      );
      netError.status = 0;
      netError.code = 'NETWORK_ERROR';
      throw netError;
    }
    throw error;
  }
}

export const api = {
  get: (endpoint, options = {}) =>
    request(endpoint, { method: 'GET', ...options }),

  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  put: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  patch: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    }),

  delete: (endpoint, options = {}) =>
    request(endpoint, { method: 'DELETE', ...options }),

  getBaseUrl: () => API_BASE_URL,
};

export default api;
