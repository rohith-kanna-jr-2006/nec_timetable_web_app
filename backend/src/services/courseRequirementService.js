const Course = require('../models/Course');
const TimetableSession = require('../models/TimetableSession');

/**
 * Phase 11 - Canonical course-period requirement and workload integrity.
 *
 * The repository historically resolved a course's weekly requirement with a
 * silent fallback ("if it is a LAB use 4, otherwise use 3"). That invented a
 * number for any course whose requirement was not present in the curriculum, so a
 * missing requirement was indistinguishable from a real one.
 *
 * This service makes the requirement explicit:
 *
 *   source = 'TOTAL_PERIOD'  -> Course.totalPeriod is the canonical weekly period count
 *   source = 'LTP_SUM'       -> Course.L + Course.T + Course.P is the canonical count
 *   source = 'MISSING'       -> no canonical requirement exists; nothing is invented
 *
 * 'MISSING' is reported, never silently defaulted, so the gap is actionable.
 */

const _num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

/** True when the course is laboratory-bearing, using the existing project rules. */
function isLabCourse(course) {
  if (!course) return false;
  return (
    course.isLab === true ||
    course.courseType === 'LAB' ||
    (_num(course.P) >= 3 && _num(course.L) === 0)
  );
}

/**
 * Resolves the canonical weekly period requirement for a course.
 *
 * Never invents a default. When no canonical requirement exists the result is
 * source 'MISSING' with requiredPeriods 0.
 */
function resolveCourseRequirement(course) {
  if (!course) {
    return { requiredPeriods: 0, source: 'MISSING', isLab: false, reason: 'COURSE_NOT_FOUND' };
  }

  const isLab = isLabCourse(course);
  const totalPeriod = _num(course.totalPeriod);

  if (totalPeriod > 0) {
    return { requiredPeriods: totalPeriod, source: 'TOTAL_PERIOD', isLab, reason: null };
  }

  const ltp = _num(course.L) + _num(course.T) + _num(course.P);
  if (ltp > 0) {
    return { requiredPeriods: ltp, source: 'LTP_SUM', isLab, reason: null };
  }

  return {
    requiredPeriods: 0,
    source: 'MISSING',
    isLab,
    reason: 'COURSE_REQUIREMENT_MISSING',
  };
}

/**
 * Compares each scheduled course's canonical requirement against the number of
 * class TimetableSessions actually generated for an exact context + version.
 *
 * A multi-faculty LAB or MC_SAS counts as ONE class session per slot: the same
 * class event is shared by several faculty, so a faculty projection must never
 * inflate the class-session count.
 */
async function validateSessionCounts({ academicContextId, timetableVersionId }) {
  const sessions = await TimetableSession.find({
    academicContextId: academicContextId,
    timetableVersionId: timetableVersionId,
  }).lean();

  const codes = Array.from(new Set(sessions.map((s) => s.courseCode)));
  const courses = await Course.find({ courseCode: { $in: codes } }).lean();
  const byCode = new Map(courses.map((c) => [c.courseCode, c]));

  const results = codes.map((code) => {
    const forCourse = sessions.filter((s) => s.courseCode === code);
    const course = byCode.get(code);
    const requirement = resolveCourseRequirement(course);
    const facultyIds = new Set();
    forCourse.forEach((s) => {
      if (s.facultyId) facultyIds.add(s.facultyId);
      (s.facultyAssignments || []).forEach((fa) => fa.facultyId && facultyIds.add(fa.facultyId));
    });

    return {
      courseCode: code,
      courseName: course ? course.courseName : null,
      sessionType: forCourse[0] ? forCourse[0].sessionType : null,
      facultyCount: facultyIds.size,
      isMultiFaculty: facultyIds.size > 1,
      requiredPeriods: requirement.requiredPeriods,
      requirementSource: requirement.source,
      actualSessions: forCourse.length,
      // Class events, never multiplied by the number of faculty on the session.
      matches: requirement.source !== 'MISSING' && requirement.requiredPeriods === forCourse.length,
      isComplete: requirement.source !== 'MISSING',
    };
  });

  return {
    academicContextId: academicContextId,
    timetableVersionId: timetableVersionId,
    sessionCount: sessions.length,
    courseCount: results.length,
    allMatch: results.every((r) => r.matches || !r.isComplete),
    mismatches: results.filter((r) => r.isComplete && !r.matches),
    incompleteRequirements: results.filter((r) => !r.isComplete),
    results: results,
  };
}

/**
 * Workload fields that must never be written from a client-supplied payload.
 * The backend is authoritative for every calculated figure; a client may supply
 * reference data only where the domain explicitly allows it.
 */
const WORKLOAD_PROTECTED_FIELDS = Object.freeze([
  'calculatedTeachingHours',
  'calculatedResponsibilityHours',
  'calculatedTotalHours',
  'teaching',
  'responsibilities',
]);

/** Fields a caller may contribute to a workload record. */
const WORKLOAD_ACCEPTED_FIELDS = Object.freeze(['sourceTotalHours']);

/**
 * Builds a workload persistence payload from an untrusted body.
 *
 * Client-supplied teaching/responsibility structures and calculated totals are
 * rejected outright rather than silently ignored, so an attempt to set an
 * authoritative figure from the client is visible.
 */
function buildWorkloadPayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const attempted = WORKLOAD_PROTECTED_FIELDS.filter((f) =>
    Object.prototype.hasOwnProperty.call(source, f)
  );
  if (attempted.length > 0) {
    const err = new Error(
      'Workload field(s) are backend-authoritative and cannot be supplied by the client: ' + attempted.join(', ')
    );
    err.name = 'WorkloadValidationError';
    err.code = 'WORKLOAD_FIELD_PROTECTED';
    err.statusCode = 400;
    err.details = { attempted: attempted, accepted: WORKLOAD_ACCEPTED_FIELDS };
    throw err;
  }

  const payload = {};
  WORKLOAD_ACCEPTED_FIELDS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(source, f)) payload[f] = source[f];
  });
  return payload;
}

/**
 * Derives the backend-authoritative workload totals for a faculty member from the
 * persisted teaching / responsibility structures.
 *
 * This mirrors workloadService.calculateTeachingHours / calculateResponsibilityHours
 * so the two can never silently diverge.
 */
function deriveWorkloadTotals(workload) {
  const teaching = (workload && workload.teaching) || {};
  const categories = ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others'];

  let calculatedTeachingHours = 0;
  categories.forEach((cat) => {
    const items = teaching[cat];
    if (Array.isArray(items)) {
      items.forEach((item) => {
        calculatedTeachingHours += _num(item && item.hours);
      });
    }
  });

  let calculatedResponsibilityHours = 0;
  const responsibilities = (workload && workload.responsibilities) || [];
  if (Array.isArray(responsibilities)) {
    responsibilities.forEach((item) => {
      calculatedResponsibilityHours += _num(item && item.hours);
    });
  }

  return {
    calculatedTeachingHours: calculatedTeachingHours,
    calculatedResponsibilityHours: calculatedResponsibilityHours,
    calculatedTotalHours: calculatedTeachingHours + calculatedResponsibilityHours,
  };
}

module.exports = {
  isLabCourse: isLabCourse,
  resolveCourseRequirement: resolveCourseRequirement,
  validateSessionCounts: validateSessionCounts,
  buildWorkloadPayload: buildWorkloadPayload,
  deriveWorkloadTotals: deriveWorkloadTotals,
  WORKLOAD_PROTECTED_FIELDS: WORKLOAD_PROTECTED_FIELDS,
  WORKLOAD_ACCEPTED_FIELDS: WORKLOAD_ACCEPTED_FIELDS,
};
