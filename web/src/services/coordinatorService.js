/**
 * Coordinator Service for Web Application
 * Handles API calls for TimeTable Coordinator workflows:
 * - Candidate faculty handlers (/api/course-faculty-handlers)
 * - Timetable generation / drafts (/api/timetable)
 * - Academic contexts (/api/academic-contexts)
 */

import { api } from './api.js';

/**
 * Fetch candidate faculty handlers for all courses
 * GET /api/course-faculty-handlers
 */
export async function getCourseFacultyHandlers() {
  const response = await api.get('/course-faculty-handlers');
  return response?.data || response;
}

/**
 * Fetch candidate handlers for a specific course
 * GET /api/course-faculty-handlers/:courseCode
 */
export async function getCourseFacultyHandlerByCourse(courseCode) {
  if (!courseCode) return null;
  const response = await api.get(`/course-faculty-handlers/${encodeURIComponent(courseCode)}`);
  return response?.data || response;
}

/**
 * Submit candidate faculty pool for a course (AC Input)
 * POST /api/course-faculty-handlers
 */
export async function createCourseFacultyHandler(payload) {
  const response = await api.post('/course-faculty-handlers', payload);
  return response?.data || response;
}

/**
 * Update candidate faculty pool for a course
 * PUT /api/course-faculty-handlers/:courseCode
 */
export async function updateCourseFacultyHandler(courseCode, payload) {
  const response = await api.put(`/course-faculty-handlers/${encodeURIComponent(courseCode)}`, payload);
  return response?.data || response;
}

/**
 * Delete candidate faculty pool for a course
 * DELETE /api/course-faculty-handlers/:courseCode
 */
export async function deleteCourseFacultyHandler(courseCode) {
  const response = await api.delete(`/course-faculty-handlers/${encodeURIComponent(courseCode)}`);
  return response?.data || response;
}

/**
 * Create candidate timetable version
 * POST /api/timetable/version
 */
export async function createTimetableVersion(payload) {
  const response = await api.post('/timetable/version', payload);
  return response?.data || response;
}

/**
 * Schedule a slot session
 * POST /api/timetable/session
 */
export async function createTimetableSession(payload) {
  const response = await api.post('/timetable/session', payload);
  return response?.data || response;
}

/**
 * Delete a scheduled session
 * DELETE /api/timetable/session/:id
 */
export async function deleteTimetableSession(sessionId) {
  const response = await api.delete(`/timetable/session/${encodeURIComponent(sessionId)}`);
  return response?.data || response;
}

/**
 * Submit timetable version for HOD Approval
 * PATCH /api/timetable/version/:id/status
 */
export async function submitTimetableForApproval(versionId) {
  const response = await api.patch(`/timetable/version/${encodeURIComponent(versionId)}/status`, {
    status: 'PENDING_HOD_APPROVAL',
  });
  return response?.data || response;
}

export default {
  getCourseFacultyHandlers,
  getCourseFacultyHandlerByCourse,
  createCourseFacultyHandler,
  updateCourseFacultyHandler,
  deleteCourseFacultyHandler,
  createTimetableVersion,
  createTimetableSession,
  deleteTimetableSession,
  submitTimetableForApproval,
};


