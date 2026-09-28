/**
 * Faculty Availability Service for Web Application
 * Handles API calls for /api/availability endpoints.
 */

import { api } from './api.js';

/**
 * Fetch faculty availability entries
 * GET /api/availability
 */
export async function getAvailability(params = {}) {
  const query = new URLSearchParams();
  if (params.facultyId) query.append('facultyId', params.facultyId);
  if (params.day) query.append('day', params.day);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/availability${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Set faculty availability entry (upsert)
 * POST /api/availability
 */
export async function setAvailability(payload) {
  const response = await api.post('/availability', payload);
  return response?.data || response;
}

/**
 * Delete availability entry
 * DELETE /api/availability/:id
 */
export async function deleteAvailability(id) {
  const response = await api.delete(`/availability/${encodeURIComponent(id)}`);
  return response?.data || response;
}

export default {
  getAvailability,
  setAvailability,
  deleteAvailability,
};
