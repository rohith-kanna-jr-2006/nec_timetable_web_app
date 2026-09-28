/**
 * Workload Service for Web Application
 * Handles API calls for /api/workload endpoints.
 */

import { api } from './api.js';

/**
 * Fetch all faculty workload records
 * GET /api/workload
 */
export async function getWorkloadList(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.status) query.append('status', params.status);
  if (params.role) query.append('role', params.role);
  if (params.category) query.append('category', params.category);
  if (params.facultyId) query.append('facultyId', params.facultyId);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const qs = query.toString();
  const endpoint = `/workload${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch dynamic aggregation metrics computed live
 * GET /api/workload/summary
 */
export async function getWorkloadSummary() {
  const response = await api.get('/workload/summary');
  return response?.data || response;
}

/**
 * Fetch records requiring arithmetic review
 * GET /api/workload/discrepancies
 */
export async function getWorkloadDiscrepancies() {
  const response = await api.get('/workload/discrepancies');
  return response?.data || response;
}

/**
 * Fetch records with incomplete source totals
 * GET /api/workload/incomplete
 */
export async function getWorkloadIncomplete() {
  const response = await api.get('/workload/incomplete');
  return response?.data || response;
}

/**
 * Retrieve full breakdown for a specific faculty member
 * GET /api/workload/:facultyId
 */
export async function getWorkloadByFaculty(facultyId) {
  if (!facultyId) return null;
  const response = await api.get(`/workload/${encodeURIComponent(facultyId)}`);
  return response?.data || response;
}

/**
 * Retrieve categorized teaching allocations and responsibilities
 * GET /api/workload/:facultyId/allocations
 */
export async function getWorkloadAllocations(facultyId, params = {}) {
  if (!facultyId) return null;
  const query = new URLSearchParams(params).toString();
  const endpoint = `/workload/${encodeURIComponent(facultyId)}/allocations${query ? `?${query}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

export default {
  getWorkloadList,
  getWorkloadSummary,
  getWorkloadDiscrepancies,
  getWorkloadIncomplete,
  getWorkloadByFaculty,
  getWorkloadAllocations,
};
