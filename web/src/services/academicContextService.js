/**
 * Academic Context Service for Web Application
 * Handles API calls for /api/academic-contexts endpoints.
 */

import { api } from './api.js';

/**
 * Fetch all academic contexts
 * GET /api/academic-contexts
 */
export async function getAcademicContexts(params = {}) {
  const query = new URLSearchParams();
  if (params.department) query.append('department', params.department);
  if (params.semester) query.append('semester', params.semester);
  if (params.academicYear) query.append('academicYear', params.academicYear);
  if (params.year) query.append('year', params.year);
  if (params.section) query.append('section', params.section);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/academic-contexts${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch single academic context by ID
 * GET /api/academic-contexts/:id
 */
export async function getAcademicContextById(id) {
  if (!id) return null;
  const response = await api.get(`/academic-contexts/${encodeURIComponent(id)}`);
  return response?.data || response;
}

/**
 * Create new academic context
 * POST /api/academic-contexts
 */
export async function createAcademicContext(payload) {
  const response = await api.post('/academic-contexts', payload);
  return response?.data || response;
}

/**
 * Update academic context
 * PUT /api/academic-contexts/:id
 */
export async function updateAcademicContext(id, payload) {
  const response = await api.put(`/academic-contexts/${encodeURIComponent(id)}`, payload);
  return response?.data || response;
}

/**
 * Delete academic context
 * DELETE /api/academic-contexts/:id
 */
export async function deleteAcademicContext(id) {
  const response = await api.delete(`/academic-contexts/${encodeURIComponent(id)}`);
  return response?.data || response;
}

export default {
  getAcademicContexts,
  getAcademicContextById,
  createAcademicContext,
  updateAcademicContext,
  deleteAcademicContext,
};
