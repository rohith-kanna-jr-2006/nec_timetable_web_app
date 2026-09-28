/**
 * Authentication Service for Web Frontend
 * Manages JWT tokens, credentials validation, and role-based redirects.
 */

import api, { setAuthToken, clearAuthSession, getAuthToken } from './api.js';

export { getAuthToken as getStoredToken };

const USER_STORAGE_KEY = 'nec_user_profile';

/**
 * Maps role to its default authorized dashboard route
 */
export function getDefaultDashboard(role) {
  switch (role) {
    case 'HOD':
      return '/hod/dashboard';
    case 'AC':
      return '/coordinator/dashboard';
    case 'ADMIN':
      return '/hod/dashboard';
    case 'FACULTY':
    default:
      return '/faculty/dashboard';
  }
}

/**
 * Retrieve saved user profile from localStorage
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist user profile in localStorage
 */
export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[authService] Could not persist user profile:', err);
  }
}

/**
 * Authenticate with backend API: POST /api/auth/login
 */
export async function login(email, password) {
  const response = await api.post('/auth/login', { email, password });

  if (!response || !response.success || !response.data) {
    throw new Error(response?.message || 'Authentication failed. Please check credentials.');
  }

  const token = response.data.token;
  const user = response.data.user ? { ...response.data.user } : { ...response.data };

  // Guarantee role and facultyId are preserved without loss
  if (response.data.role && !user.role) {
    user.role = response.data.role;
  }
  if (response.data.facultyId && !user.facultyId) {
    user.facultyId = response.data.facultyId;
  }

  // Persist token and user in client storage
  setAuthToken(token);
  setStoredUser(user);

  return {
    token,
    user,
    redirectPath: getDefaultDashboard(user.role),
  };
}

/**
 * Retrieve active user profile: GET /api/auth/me
 */
export async function getMe() {
  const response = await api.get('/auth/me');

  if (!response || !response.success || !response.data) {
    throw new Error('Failed to retrieve user profile.');
  }

  const rawUser = response.data.user || response.data;
  const user = { ...rawUser };

  if (response.data.role && !user.role) {
    user.role = response.data.role;
  }
  if (response.data.facultyId && !user.facultyId) {
    user.facultyId = response.data.facultyId;
  }

  setStoredUser(user);
  return user;
}

/**
 * Terminate user session and clear storage
 */
export function logout() {
  clearAuthSession();
  setStoredUser(null);
}

export const authService = {
  login,
  getMe,
  logout,
  getStoredUser,
  getStoredToken: getAuthToken,
  getDefaultDashboard,
};

export default authService;
