/**
 * Timetable Service for Web Application
 * Handles API calls and schedule matrix transformations for Faculty & Class Timetables.
 */

import api from './api';
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
 * Group flat session list into day-keyed dictionary { MON: [...], TUE: [...] }
 */
export function groupSessionsByDay(sessions = []) {
  const grouped = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
  };

  sessions.forEach((session) => {
    if (grouped[session.day]) {
      grouped[session.day].push(session);
    }
  });

  // Sort each day's sessions by period order
  const periodOrder = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6, P7: 7 };
  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => (periodOrder[a.period] || 99) - (periodOrder[b.period] || 99));
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
  getTimetableVersions,
  getCurrentDayId,
  getCurrentPeriodStatus,
  groupSessionsByDay,
  calculateTimetableMetrics,
};

export default timetableService;
