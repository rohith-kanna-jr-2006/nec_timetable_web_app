/**
 * Course Service for Web Application
 * Handles API calls for /api/courses endpoints.
 */

import { api } from './api.js';

/**
 * Fetch courses list
 * GET /api/courses
 */
export async function getCourses(params = {}) {
  const query = new URLSearchParams();
  if (params.department) query.append('department', params.department);
  if (params.regulation) query.append('regulation', params.regulation);
  if (params.semester) query.append('semester', params.semester);
  if (params.type) query.append('type', params.type);
  if (params.limit) query.append('limit', params.limit);

  const qs = query.toString();
  const endpoint = `/courses${qs ? `?${qs}` : ''}`;
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch course by code
 * GET /api/courses/:courseCode
 */
export async function getCourseByCode(courseCode) {
  if (!courseCode) return null;
  const response = await api.get(`/courses/${encodeURIComponent(courseCode)}`);
  return response?.data || response;
}

/**
 * Create new course
 * POST /api/courses
 */
export async function createCourse(payload) {
  const response = await api.post('/courses', payload);
  return response?.data || response;
}

/**
 * Update course
 * PUT /api/courses/:courseCode
 */
export async function updateCourse(courseCode, payload) {
  const response = await api.put(`/courses/${encodeURIComponent(courseCode)}`, payload);
  return response?.data || response;
}

/**
 * Delete course
 * DELETE /api/courses/:courseCode
 */
export async function deleteCourse(courseCode) {
  const response = await api.delete(`/courses/${encodeURIComponent(courseCode)}`);
  return response?.data || response;
}

export default {
  getCourses,
  getCourseByCode,
  createCourse,
  updateCourse,
  deleteCourse,
};
