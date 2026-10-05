/**
 * Timetable Review Service (Phase 5)
 *
 * Read-only helpers shared by every TC/HOD review endpoint
 * (class timetable, review matrix, faculty timetable, submission summary).
 *
 * Design rules honoured here:
 *   - ONE TimetableSession is ONE class session. A multi-faculty LAB/SAS row is
 *     never expanded into one row per faculty; `facultyAssignments[]` carries
 *     the complete instructor set (PRIMARY / ADDITIONAL / OPTIONAL /
 *     MATHS_BME / ENGLISH / THEORY).
 *   - No N+1 queries: courses are batch-loaded once and projected onto the
 *     session list from an in-memory map.
 */

const Course = require('../models/Course');

/** Working days / periods used to order a review grid deterministically. */
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const PERIOD_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

/**
 * Batches the Course master lookup for a session list.
 *
 * @param {Array} sessions - Lean TimetableSession documents
 * @returns {Promise<Map<string, string>>} courseCode -> canonical courseName
 */
async function loadCourseNameMap(sessions) {
  const courseCodes = Array.from(
    new Set(
      (sessions || [])
        .map((s) => (s.courseCode || '').trim())
        .filter(Boolean)
    )
  );

  const map = new Map();
  if (courseCodes.length === 0) return map;

  const courses = await Course.find({ courseCode: { $in: courseCodes } }, 'courseCode courseName').lean();
  courses.forEach((c) => map.set(c.courseCode, c.courseName));
  return map;
}

/**
 * Projects a raw session into the canonical review shape.
 *
 * Multi-faculty sessions keep their complete facultyAssignments array; the
 * class-facing `facultyId` remains the single primary instructor.
 */
function toReviewSession(session, courseNameMap) {
  const canonicalName =
    (courseNameMap && courseNameMap.get(session.courseCode)) || session.courseName || '';

  return {
    _id: session._id,
    id: session._id,
    courseCode: session.courseCode,
    courseName: canonicalName,
    sessionType: session.sessionType || 'THEORY',
    day: session.day,
    period: session.period,
    duration: session.duration === undefined ? 1 : session.duration,
    room: session.room || null,
    // Primary instructor (single-instructor convenience field).
    facultyId: session.facultyId,
    facultyName: session.facultyName || '',
    // Every instructor attached to this single class session.
    facultyAssignments: Array.isArray(session.facultyAssignments)
      ? session.facultyAssignments.map((a) => ({
          facultyId: a.facultyId,
          facultyName: a.facultyName || '',
          role: a.role || 'PRIMARY',
        }))
      : [],
    academicContextId: session.academicContextId ? session.academicContextId.toString() : null,
    timetableVersionId: session.timetableVersionId ? session.timetableVersionId.toString() : null,
  };
}

/** Orders sessions by day then period so a review grid renders predictably. */
function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period);
  });
}

/**
 * Builds the canonical review session list for a batch of lean sessions.
 *
 * @param {Array} sessions - Lean TimetableSession documents (already filtered
 *                           to the exact context + version)
 * @returns {Promise<Array>} Review-shaped, canonically ordered sessions
 */
async function buildReviewSessions(sessions) {
  const courseNameMap = await loadCourseNameMap(sessions);
  return sortSessions((sessions || []).map((s) => toReviewSession(s, courseNameMap)));
}

/**
 * Computes the TC review summary counters.
 *
 * `conflictCount` is derived in memory from the exact sessions under review —
 * it counts class double-bookings and faculty double-bookings (including the
 * additional instructors on LAB/SAS sessions).
 *
 * @param {Array} sessions - Review-shaped sessions
 * @returns {{courseCount:number, sessionCount:number, scheduledPeriods:number,
 *            conflictCount:number, facultyCount:number}}
 */
function buildReviewSummary(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];

  const courseCodes = new Set();
  const facultyIds = new Set();
  const classSlots = new Set();
  const facultySlots = new Set();
  let conflictCount = 0;

  for (const s of list) {
    if (s.courseCode) courseCodes.add(s.courseCode);

    const slotKey = `${s.day}_${s.period}`;
    if (classSlots.has(slotKey)) conflictCount += 1;
    classSlots.add(slotKey);

    const instructors =
      s.facultyAssignments && s.facultyAssignments.length > 0
        ? s.facultyAssignments.map((a) => a.facultyId)
        : [s.facultyId];

    for (const fid of instructors.filter(Boolean)) {
      facultyIds.add(fid);
      const facSlotKey = `${fid}_${slotKey}`;
      if (facultySlots.has(facSlotKey)) conflictCount += 1;
      facultySlots.add(facSlotKey);
    }
  }

  return {
    courseCount: courseCodes.size,
    sessionCount: list.length,
    scheduledPeriods: list.length,
    conflictCount,
    facultyCount: facultyIds.size,
  };
}

/**
 * Builds the full TC/HOD review payload for one exact academic context +
 * timetable version pair.
 *
 * @param {Object} params
 * @param {Object} params.context        - AcademicContext document
 * @param {Object} params.version        - TimetableVersion document
 * @param {Array}  params.sessions       - Lean TimetableSession documents
 * @param {Object} params.contextSummary - Canonical context summary shape
 * @param {Object} params.versionSummary - Canonical version summary shape
 * @returns {Promise<Object>} { academicContext, timetableVersion, summary, sessions }
 */
async function buildTimetableReviewPayload({
  context,
  version,
  sessions,
  contextSummary,
  versionSummary,
}) {
  const reviewSessions = await buildReviewSessions(sessions);

  return {
    academicContextId: context ? context._id : null,
    academicContext: contextSummary || null,
    timetableVersionId: version ? version._id : null,
    timetableVersion: versionSummary || null,
    status: version ? version.status : null,
    sessionCount: reviewSessions.length,
    summary: buildReviewSummary(reviewSessions),
    sessions: reviewSessions,
  };
}

module.exports = {
  DAY_ORDER,
  PERIOD_ORDER,
  loadCourseNameMap,
  toReviewSession,
  sortSessions,
  buildReviewSessions,
  buildReviewSummary,
  buildTimetableReviewPayload,
};
