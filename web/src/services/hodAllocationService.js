/**
 * HOD Allocation & Governance Service for Web Application
 * Handles API calls for:
 * - HOD Faculty Allocations (/api/hod-allocations)
 * - Class Advisors (/api/class-advisors)
 * - Timetable Status Ratification (/api/timetable/version/:id/status)
 */

import { api } from './api.js';

/**
 * Fetch HOD faculty allocations
 * GET /api/hod-allocations
 */
export async function getHODAllocations(params = {}) {
  const query = new URLSearchParams();
  if (params.academicContextId) query.append('academicContextId', params.academicContextId);
  if (params.facultyId) query.append('facultyId', params.facultyId);
  if (params.courseCode) query.append('courseCode', params.courseCode);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/hod-allocations${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Create HOD allocation (draft by AC or approved by HOD)
 * POST /api/hod-allocations
 */
export async function createHODAllocation(payload) {
  const response = await api.post('/hod-allocations', payload);
  return response?.data || response;
}

/**
 * Approve or reject allocation
 * PATCH /api/hod-allocations/:id/status
 */
export async function updateHODAllocationStatus(id, status, rejectionReason = null) {
  const response = await api.patch(`/hod-allocations/${encodeURIComponent(id)}/status`, {
    status,
    ...(rejectionReason ? { rejectionReason } : {}),
  });
  return response?.data || response;
}

/**
 * Update HOD allocation (reassign faculty, allocationType, etc.)
 * PUT /api/hod-allocations/:id
 */
export async function updateHODAllocation(id, payload) {
  const response = await api.put(`/hod-allocations/${encodeURIComponent(id)}`, payload);
  return response?.data || response;
}

/**
 * Delete allocation
 * DELETE /api/hod-allocations/:id
 */
export async function deleteHODAllocation(id) {
  const response = await api.delete(`/hod-allocations/${encodeURIComponent(id)}`);
  return response?.data || response;
}

/**
 * Fetch class advisor assignments
 * GET /api/class-advisors
 */
export async function getClassAdvisors(params = {}) {
  const query = new URLSearchParams();
  if (params.academicContextId) query.append('academicContextId', params.academicContextId);
  if (params.facultyId) query.append('facultyId', params.facultyId);
  if (params.status) query.append('status', params.status);

  const qs = query.toString();
  const endpoint = `/class-advisors${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Assign class advisor (HOD Authority)
 * POST /api/class-advisors
 */
export async function assignClassAdvisor(payload) {
  const response = await api.post('/class-advisors', payload);
  return response?.data || response;
}

/**
 * Deactivate class advisor assignment
 * PATCH /api/class-advisors/:id/deactivate
 */
export async function deactivateClassAdvisor(id) {
  const response = await api.patch(`/class-advisors/${encodeURIComponent(id)}/deactivate`, {});
  return response?.data || response;
}

/**
 * Transition timetable version status (APPROVE / REJECT / PUBLISH)
 * PATCH /api/timetable/version/:id/status
 */
export async function transitionTimetableVersion(id, status, rejectionReason = null) {
  const response = await api.patch(`/timetable/version/${encodeURIComponent(id)}/status`, {
    status,
    ...(rejectionReason ? { rejectionReason } : {}),
  });
  return response?.data || response;
}

export default {
  getHODAllocations,
  createHODAllocation,
  updateHODAllocationStatus,
  deleteHODAllocation,
  getClassAdvisors,
  assignClassAdvisor,
  deactivateClassAdvisor,
  transitionTimetableVersion,
};
