/**
 * Faculty Absence & Leave Service for Web Application
 * Handles API calls for /api/absences endpoints.
 */

import { api } from './api.js';

/**
 * Fetch faculty absences
 * GET /api/absences
 */
export async function getAbsences(params = {}) {
  const query = new URLSearchParams();
  if (params.facultyId) query.append('facultyId', params.facultyId);
  if (params.date) query.append('date', params.date);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/absences${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Report a faculty absence / leave
 * POST /api/absences
 */
export async function reportAbsence(payload) {
  const response = await api.post('/absences', payload);
  return response?.data || response;
}

/**
 * Update absence status (HOD approve/reject)
 * PATCH /api/absences/:id/status
 */
export async function updateAbsenceStatus(id, status) {
  const response = await api.patch(`/absences/${encodeURIComponent(id)}/status`, { status });
  return response?.data || response;
}

export default {
  getAbsences,
  reportAbsence,
  updateAbsenceStatus,
};
