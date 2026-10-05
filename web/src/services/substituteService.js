/**
 * Substitute & Free-Slot Mapping Service
 * Wraps centralized API client for /api/substitutes endpoints.
 */

import { api } from './api.js';

/**
 * Fetch substitute allocations
 * GET /api/substitutes
 */
export async function getSubstitutes(params = {}) {
  const query = new URLSearchParams();
  if (params.absenceId) query.append('absenceId', params.absenceId);
  if (params.originalFacultyId) query.append('originalFacultyId', params.originalFacultyId);
  if (params.substituteFacultyId) query.append('substituteFacultyId', params.substituteFacultyId);
  if (params.date) query.append('date', params.date);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/substitutes${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Assign substitute teacher
 * POST /api/substitutes
 */
export async function assignSubstitute(payload) {
  const response = await api.post('/substitutes', payload);
  return response?.data || response;
}

/**
 * Update substitute status (Accept / Reject / Cancel)
 * PATCH /api/substitutes/:id/status
 */
export async function updateSubstituteStatus(id, status) {
  const response = await api.patch(`/substitutes/${encodeURIComponent(id)}/status`, { status });
  return response?.data || response;
}

/**
 * Fetch affected timetable sessions for an absence
 * GET /api/substitutes/affected-sessions
 */
export async function getAffectedSessions(params = {}) {
  const query = new URLSearchParams();
  if (params.absenceId) query.append('absenceId', params.absenceId);
  if (params.academicContextId) query.append('academicContextId', params.academicContextId);
  if (params.date) query.append('date', params.date);

  const qs = query.toString();
  const endpoint = `/substitutes/affected-sessions${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch authoritative eligible faculty for a timetable session absence
 * GET /api/substitutes/eligible-faculty
 */
export async function getEligibleFaculty(params = {}) {
  const query = new URLSearchParams();
  if (params.timetableSessionId) query.append('timetableSessionId', params.timetableSessionId);
  if (params.absenceId) query.append('absenceId', params.absenceId);
  if (params.academicContextId) query.append('academicContextId', params.academicContextId);

  const qs = query.toString();
  const endpoint = `/substitutes/eligible-faculty${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

export default {
  getSubstitutes,
  getAffectedSessions,
  getEligibleFaculty,
  assignSubstitute,
  updateSubstituteStatus,
};
