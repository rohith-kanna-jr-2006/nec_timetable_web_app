/**
 * Timetable Service for Web Application
 * Handles API calls and schedule matrix transformations for Faculty & Class Timetables.
 */

import api from './api.js';
import { WEEK_DAYS, PERIOD_TIMINGS } from '../constants/schedule';

/**
 * Fetch scheduled sessions for a specific faculty member
 * GET /api/timetable/faculty/:facultyId
 */
export async function getFacultyTimetable(facultyId, versionId = null) {
  if (!facultyId) return { facultyId: null, sessionCount: 0, sessions: [] };
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
  const response = await api.get(`/timetable/faculty/${facultyId}${query}`);
  return response?.data || { facultyId, sessionCount: 0, sessions: [] };
}

/**
 * Fetch scheduled sessions for an academic context (Class)
 * GET /api/timetable/class/:academicContextId
 */
export async function getClassTimetable(academicContextId, versionId = null) {
  if (!academicContextId) return { academicContextId: null, sessionCount: 0, sessions: [] };
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
  const response = await api.get(`/timetable/class/${academicContextId}${query}`);
  return response?.data || { academicContextId, sessionCount: 0, sessions: [] };
}

/**
 * Fetch published-only scheduled sessions for an academic context
 * GET /api/timetable/published/:academicContextId
 */
export async function getPublishedClassTimetable(academicContextId) {
  if (!academicContextId) return { academicContextId: null, isPublished: false, sessionCount: 0, sessions: [] };
  const response = await api.get(`/timetable/published/${academicContextId}`);
  return response?.data || { academicContextId, isPublished: false, sessionCount: 0, sessions: [] };
}

/**
 * Fetch TC Design Context bundle for a cohort
 * GET /api/timetable/design-context/:academicContextId
 */
export async function getDesignContext(academicContextId) {
  if (!academicContextId) return null;
  const response = await api.get(`/timetable/design-context/${academicContextId}`);
  return response?.data || response;
}

/**
 * Fetch authoritative workflow status for an academic context
 * GET /api/timetable/context-status/:academicContextId
 */
export async function getContextStatus(academicContextId) {
  if (!academicContextId) return null;
  const response = await api.get(`/timetable/context-status/${academicContextId}`);
  return response?.data || response;
}

/**
 * Authoritative TC generation from context
 * POST /api/timetable/generate-from-context
 */
export async function generateFromContext(academicContextId) {
  const response = await api.post('/timetable/generate-from-context', { academicContextId });
  return response?.data || response;
}

/**
 * Fetch review matrix summary and sessions
 * GET /api/timetable/review-matrix
 */
export async function getReviewMatrix(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/timetable/review-matrix?${query}` : '/timetable/review-matrix';
  const response = await api.get(endpoint);
  return response?.data || response;
}

/**
 * Fetch all available timetable versions
 * GET /api/timetable/versions
 */
export async function getTimetableVersions(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/timetable/versions?${query}` : '/timetable/versions';
  const response = await api.get(endpoint);
  return response?.data || [];
}

/**
 * Solve and generate timetable automatically using backend CSP engine (legacy)
 * POST /api/timetable/solve
 */
export async function solveTimetable(payload) {
  const response = await api.post('/timetable/solve', payload);
  return response?.data || response;
}


/**
 * Get current system day identifier ('MON', 'TUE', 'WED', 'THU', 'FRI')
 * Defaults to 'MON' if accessed on weekends
 */
export function getCurrentDayId() {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const map = {
    1: 'MON',
    2: 'TUE',
    3: 'WED',
    4: 'THU',
    5: 'FRI',
  };
  return map[dayIndex] || 'MON';
}

/**
 * Detect current period based on current local clock time
 */
export function getCurrentPeriodStatus(currentTime = null) {
  const now = currentTime || new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  for (const item of PERIOD_TIMINGS) {
    const start = toMinutes(item.startTime);
    let end;

    // Handle 12-hour or afternoon timings in constants
    if (item.endTime.startsWith('01:')) end = (13 * 60) + parseInt(item.endTime.split(':')[1], 10);
    else if (item.endTime.startsWith('02:')) end = (14 * 60) + parseInt(item.endTime.split(':')[1], 10);
    else if (item.endTime.startsWith('03:')) end = (15 * 60) + parseInt(item.endTime.split(':')[1], 10);
    else if (item.endTime.startsWith('04:')) end = (16 * 60) + parseInt(item.endTime.split(':')[1], 10);
    else end = toMinutes(item.endTime);

    let adjustedStart = start;
    if (item.startTime.startsWith('01:')) adjustedStart = (13 * 60) + parseInt(item.startTime.split(':')[1], 10);
    else if (item.startTime.startsWith('02:')) adjustedStart = (14 * 60) + parseInt(item.startTime.split(':')[1], 10);
    else if (item.startTime.startsWith('03:')) adjustedStart = (15 * 60) + parseInt(item.startTime.split(':')[1], 10);

    if (currentMinutes >= adjustedStart && currentMinutes < end) {
      return {
        isActive: true,
        type: item.type || 'lecture',
        period: item.period || null,
        name: item.name || `Period ${item.period}`,
        label: item.label || `${item.startTime} – ${item.endTime}`,
      };
    }
  }

  return {
    isActive: false,
    period: null,
    name: 'Outside Instructional Hours',
    label: 'Campus Schedule Inactive',
  };
}

/**
 * Extracts and normalizes list of faculty assignments from a session.
 * Always preserves multi-faculty LAB/MC assignments without cell duplication.
 */
export function getSessionFacultyList(session) {
  if (!session) return [];
  if (Array.isArray(session.facultyAssignments) && session.facultyAssignments.length > 0) {
    return session.facultyAssignments.map((fa) => ({
      facultyId: fa.facultyId || fa.id || 'N/A',
      facultyName: fa.facultyName || fa.name || fa.facultyId || '',
      role: fa.role || 'PRIMARY',
    }));
  }
  if (session.facultyId || session.facultyName) {
    return [{
      facultyId: session.facultyId || '',
      facultyName: session.facultyName || session.facultyId || '',
      role: 'PRIMARY',
    }];
  }
  return [];
}

/**
 * Group flat session list into day-keyed dictionary { MON: [...], TUE: [...] }
 * Supports SAT and dynamically orders periods using PERIOD_TIMINGS or numeric period codes.
 */
export function groupSessionsByDay(sessions = []) {
  const grouped = {};
  const standardDays = Array.isArray(WEEK_DAYS) ? WEEK_DAYS.map((w) => w.id) : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  standardDays.forEach((d) => {
    grouped[d] = [];
  });

  sessions.forEach((session) => {
    if (!session || !session.day) return;
    const day = String(session.day).toUpperCase();
    if (!grouped[day]) {
      grouped[day] = [];
    }
    grouped[day].push(session);
  });

  // Dynamic period ordering
  const periodOrderMap = {};
  (PERIOD_TIMINGS || []).forEach((pt, idx) => {
    if (pt.period) periodOrderMap[pt.period] = idx + 1;
  });

  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => {
      const ordA = periodOrderMap[a.period] ?? (parseInt(String(a.period).replace(/\D/g, ''), 10) || 99);
      const ordB = periodOrderMap[b.period] ?? (parseInt(String(b.period).replace(/\D/g, ''), 10) || 99);
      return ordA - ordB;
    });
  });

  return grouped;
}

/**
 * Calculate teaching breakdown metrics
 */
export function calculateTimetableMetrics(sessions = []) {
  let theoryCount = 0;
  let labCount = 0;
  let pblCount = 0;
  let otherCount = 0;

  sessions.forEach((s) => {
    const type = s.sessionType ? s.sessionType.toUpperCase() : 'THEORY';
    if (type === 'THEORY') theoryCount++;
    else if (type === 'LAB') labCount++;
    else if (type === 'PBL' || type === 'SAS') pblCount++;
    else otherCount++;
  });

  return {
    totalPeriods: sessions.length,
    theoryCount,
    labCount,
    pblCount,
    otherCount,
  };
}

export const timetableService = {
  getFacultyTimetable,
  getClassTimetable,
  getPublishedClassTimetable,
  getDesignContext,
  getContextStatus,
  generateFromContext,
  getReviewMatrix,
  getTimetableVersions,
  solveTimetable,
  getCurrentDayId,
  getCurrentPeriodStatus,
  groupSessionsByDay,
  getSessionFacultyList,
  calculateTimetableMetrics,
};

export default timetableService;
