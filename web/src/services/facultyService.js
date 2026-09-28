/**
 * Faculty Management & Workload Allocation Service
 * Wraps centralized API client for /api/faculty endpoints.
 */

import { api } from './api';

/**
 * Fetch paginated or filtered list of faculty members.
 * GET /api/faculty
 */
export async function getFacultyList(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.department) query.append('department', params.department);
  if (params.role) query.append('role', params.role);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const qs = query.toString();
  const endpoint = `/faculty${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch single faculty member by ID.
 * GET /api/faculty/:facultyId
 */
export async function getFacultyById(facultyId) {
  const response = await api.get(`/faculty/${encodeURIComponent(facultyId)}`);
  return response?.data || response;
}

/**
 * Fetch structured allocations and workload summary for a faculty member.
 * GET /api/faculty/:facultyId/allocations
 */
export async function getFacultyAllocations(facultyId, filters = {}) {
  const query = new URLSearchParams();
  if (filters.category) query.append('category', filters.category);
  if (filters.year) query.append('year', filters.year);
  if (filters.section) query.append('section', filters.section);

  const qs = query.toString();
  const endpoint = `/faculty/${encodeURIComponent(facultyId)}/allocations${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Submit new CSE faculty creation and workload allocation.
 * POST /api/faculty
 *
 * Senders: HOD, ADMIN
 * Backend calculates authoritative workload totals and returns 201 Created.
 */
export async function createFaculty(payload) {
  const response = await api.post('/faculty', payload);
  return response?.data || response;
}

/**
 * Update existing faculty profile.
 * PUT /api/faculty/:facultyId
 */
export async function updateFaculty(facultyId, payload) {
  const response = await api.put(`/faculty/${encodeURIComponent(facultyId)}`, payload);
  return response?.data || response;
}

/**
 * Delete a faculty profile.
 * DELETE /api/faculty/:facultyId
 */
export async function deleteFaculty(facultyId) {
  const response = await api.delete(`/faculty/${encodeURIComponent(facultyId)}`);
  return response?.data || response;
}

export default {
  getFacultyList,
  getFacultyById,
  getFacultyAllocations,
  createFaculty,
  updateFaculty,
  deleteFaculty,
};
