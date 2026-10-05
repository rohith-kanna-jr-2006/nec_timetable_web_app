/**
 * Phase 7 â€” Absence + Substitute Mapping Service.
 *
 * Owns the authoritative backend rules for:
 *   FacultyAbsence -> exact affected TimetableSession
 *   exact-slot substitute eligibility
 *   context/version safe persistence of a substitute mapping
 *
 * The frontend never decides which session is affected or who is free; it only
 * renders what this service returns.
 */

const Faculty = require('../models/Faculty');
const FacultyAbsence = require('../models/FacultyAbsence');
const FacultyAvailability = require('../models/FacultyAvailability');
const SubstituteAllocation = require('../models/SubstituteAllocation');
const TimetableSession = require('../models/TimetableSession');

const JS_DAY_TO_CODE = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 0: 'SUN' };

/**
 * Builds a structured error the global errorHandler maps without string matching.
 * Mirrors timetableSubmissionService so the API keeps one error convention.
 */
function _substituteError(message, code, statusCode, details = null) {
  const err = new Error(message);
  err.name = 'SubstituteMappingError';
  err.code = code;
  err.statusCode = statusCode;
  err.details = details;
  return err;
}

function _norm(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

/**
 * Resolves the timetable weekday for a calendar date.
 *
 * The date is parsed as UTC midnight so the weekday never shifts with the
 * server's local timezone â€” a '2026-10-20' absence must always mean the same
 * weekday regardless of where the process runs.
 *
 * Returns null for a malformed date or a Sunday (the timetable has no Sunday).
 */
function resolveDayForDate(date) {
  if (!date || typeof date !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible calendar dates that Date silently rolls over (e.g. 2026-02-31).
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  const code = JS_DAY_TO_CODE[parsed.getUTCDay()];
  return code === 'SUN' ? null : code;
}

/** True when the faculty appears on the session, either as primary or in facultyAssignments. */
function sessionInvolvesFaculty(session, facultyId) {
  const target = _norm(facultyId);
  if (!target) return false;
  if (_norm(session.facultyId) === target) return true;
  return (session.facultyAssignments || []).some((a) => _norm(a.facultyId) === target);
}

/**
 * Resolves the exact TimetableSession(s) an absence affects.
 *
 * Resolution is fully determined by (academicContextId, timetableVersionId,
 * facultyId, day-from-date, period). It never falls back to "first session",
 * "first class" or a default faculty.
 *
 * Returns { sessions, day, ambiguity } where ambiguity names the real domain
 * constraint when more than one session matches, instead of silently picking one.
 */
async function resolveAffectedSessions({ academicContextId, timetableVersionId, facultyId, date, period }) {
  const day = resolveDayForDate(date);
  if (!day) {
    throw _substituteError(
      `"${date}" is not a valid timetable date. Use YYYY-MM-DD for a Mon-Sat working day.`,
      'INVALID_ABSENCE_DATE',
      400,
      { date }
    );
  }

  const normFaculty = _norm(facultyId);
  if (!normFaculty) {
    throw _substituteError('facultyId is required to resolve an affected session.', 'FACULTY_REQUIRED', 400, { facultyId });
  }
  if (!_norm(period)) {
    throw _substituteError('period is required to resolve an affected session.', 'PERIOD_REQUIRED', 400, { period });
  }

  const query = {
    day,
    period: _norm(period),
    $or: [{ facultyId: normFaculty }, { 'facultyAssignments.facultyId': normFaculty }],
  };

  // Context/version scoping is mandatory. Resolving globally would let a session
  // from an unrelated cohort/version be treated as the affected one.
  if (academicContextId) query.academicContextId = academicContextId;
  if (timetableVersionId) query.timetableVersionId = timetableVersionId;

  const sessions = await TimetableSession.find(query).sort({ academicContextId: 1, courseCode: 1 }).lean();

  return {
    day,
    sessions,
    ambiguity: sessions.length > 1 ? 'MULTIPLE_MATCHING_SESSIONS' : null,
  };
}

/**
 * Projects a TimetableSession into the exact shape the TC needs to map a
 * substitute without re-entering anything the backend already knows.
 */
function buildAffectedSessionPayload(session, { absence = null, context = null, version = null } = {}) {
  const absentAssignment = absence
    ? (session.facultyAssignments || []).find((a) => _norm(a.facultyId) === _norm(absence.facultyId))
    : null;

  return {
    timetableSessionId: session._id,
    academicContextId: session.academicContextId || null,
    timetableVersionId: session.timetableVersionId || null,
    absenceId: absence ? absence._id : null,
    originalFacultyId: absence ? absence.facultyId : session.facultyId,
    originalFacultyName: (absence && absentAssignment && absentAssignment.facultyName) || session.facultyName || '',
    date: absence ? absence.date : null,
    day: session.day,
    period: session.period,
    courseCode: session.courseCode,
    courseName: session.courseName || '',
    section: context && context.section ? context.section : null,
    year: context && context.year ? context.year : null,
    academicYear: version ? version.academicYear : null,
    semester: version ? version.semester : null,
    room: session.room || null,
    sessionType: session.sessionType || 'THEORY',
    duration: typeof session.duration === 'number' ? session.duration : 1,
    facultyAssignments: session.facultyAssignments || [],
    facultyCount: (session.facultyAssignments || []).length || 1,
  };
}

/**
 * Server-side substitute eligibility.
 *
 * Returns only faculty that satisfy every backend constraint for the exact slot.
 * The full faculty master is never returned for the client to filter.
 */
async function findEligibleSubstitutes({ academicContextId, timetableVersionId, session, date, period, excludeFacultyId }) {
  const day = session.day;
  const normPeriod = _norm(period);

  // Faculty already committed elsewhere at this slot (multi-faculty aware).
  const busyAtSlot = await TimetableSession.find({
    day,
    period: normPeriod,
    ...(timetableVersionId ? { timetableVersionId } : {}),
    ...(academicContextId ? { academicContextId } : {}),
    _id: { $ne: session._id },
  }).lean();

  const busyFacultyIds = new Set();
  busyAtSlot.forEach((s) => {
    if (s.facultyId) busyFacultyIds.add(_norm(s.facultyId));
    (s.facultyAssignments || []).forEach((a) => {
      if (a.facultyId) busyFacultyIds.add(_norm(a.facultyId));
    });
  });

  // Faculty absent on the target date (a rejected absence does not block the slot).
  const absentDocs = await FacultyAbsence.find({ date, status: { $ne: 'REJECTED' } }).lean();
  const absentIds = new Set(absentDocs.map((a) => _norm(a.facultyId)));

  // Faculty explicitly marked unavailable / preferred off for this slot.
  const availabilityDocs = await FacultyAvailability.find({ day, period: normPeriod }).lean();
  const availabilityById = new Map();
  availabilityDocs.forEach((a) => availabilityById.set(_norm(a.facultyId), _norm(a.status)));

  // Faculty already mapped as a substitute at this exact slot.
  const mappedDocs = await SubstituteAllocation.find({
    date,
    period: normPeriod,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  }).lean();
  const mappedIds = new Set(mappedDocs.map((s) => _norm(s.substituteFacultyId)));

  const faculty = await Faculty.find({ isActive: { $ne: false } }).sort({ facultyId: 1 }).lean();

  const eligible = [];
  faculty.forEach((f) => {
    const id = _norm(f.facultyId);
    const reasons = [];

    if (excludeFacultyId && id === _norm(excludeFacultyId)) reasons.push('IS_ORIGINAL_FACULTY');
    if (absentIds.has(id)) reasons.push('ABSENT_ON_DATE');
    if (busyFacultyIds.has(id)) reasons.push('CONFLICTING_TIMETABLE_SESSION');
    const availability = availabilityById.get(id);
    if (availability === 'UNAVAILABLE') reasons.push('MARKED_UNAVAILABLE');
    else if (availability === 'PREFERRED_OFF') reasons.push('PREFERRED_OFF');
    if (mappedIds.has(id)) reasons.push('CONFLICTING_SUBSTITUTE_MAPPING');

    if (reasons.length === 0) {
      eligible.push({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        department: f.department || null,
        designation: f.designation || null,
      });
    }
  });

  return eligible;
}

/**
 * Full exact-slot validation and persistence of a substitute mapping.
 *
 * Validation order is deliberate so the caller receives the most specific,
 * actionable structured error first:
 *   absence -> context -> session -> substitute faculty -> slot conflicts
 */
async function createSubstituteMapping(input) {
  const {
    absenceId,
    substituteFacultyId,
    timetableSessionId = null,
    academicContextId = null,
    timetableVersionId = null,
    period = null,
    date = null,
    originalFacultyId = null,
    assignedBy = null,
    status = 'PENDING',
  } = input || {};

  if (!absenceId) {
    throw _substituteError('absenceId is required.', 'ABSENCE_REQUIRED', 400, {});
  }
  if (!substituteFacultyId) {
    throw _substituteError('substituteFacultyId is required.', 'SUBSTITUTE_FACULTY_REQUIRED', 400, {});
  }

  // ---- 1. Absence must exist and be usable -------------------------------
  const absence = await FacultyAbsence.findById(absenceId);
  if (!absence) {
    throw _substituteError('Absence record not found.', 'ABSENCE_NOT_FOUND', 404, { absenceId });
  }
  if (absence.status === 'REJECTED') {
    throw _substituteError(
      'A rejected absence cannot be mapped to a substitute.',
      'ABSENCE_NOT_APPROVED',
      409,
      { absenceId, status: absence.status }
    );
  }

  // The absence date is authoritative; a client-supplied date may not contradict it.
  if (date && date !== absence.date) {
    throw _substituteError(
      `Requested date '${date}' does not match the absence date '${absence.date}'.`,
      'DATE_ABSENCE_MISMATCH',
      409,
      { requestedDate: date, absenceDate: absence.date }
    );
  }
  const targetDate = absence.date;

  // ---- 2. Context safety -------------------------------------------------
  const requestedContextId = academicContextId
    ? String(academicContextId)
    : absence.academicContextId
      ? String(absence.academicContextId)
      : null;

  if (absence.academicContextId && requestedContextId && String(absence.academicContextId) !== requestedContextId) {
    throw _substituteError(
      'Absence belongs to academic context ' + absence.academicContextId + ', not ' + requestedContextId + '.',
      'ABSENCE_CONTEXT_MISMATCH',
      409,
      { absenceContextId: String(absence.academicContextId), requestedContextId }
    );
  }

  // ---- 3. Resolve the affected session -----------------------------------
  const resolved = await resolveAffectedSessions({
    academicContextId: requestedContextId,
    timetableVersionId,
    facultyId: absence.facultyId,
    date: targetDate,
    period,
  });

  let session = null;
  if (timetableSessionId) {
    session = await TimetableSession.findById(timetableSessionId).lean();
    if (!session) {
      throw _substituteError('Timetable session not found.', 'SESSION_NOT_FOUND', 404, { timetableSessionId });
    }
    const isAffected = resolved.sessions.some((s) => String(s._id) === String(session._id));
    if (!isAffected) {
      throw _substituteError(
        'The supplied timetable session is not affected by this absence on the requested date and period.',
        'SESSION_NOT_AFFECTED_BY_ABSENCE',
        409,
        { timetableSessionId, absenceId, resolvedSessionIds: resolved.sessions.map((s) => String(s._id)) }
      );
    }
    if (requestedContextId && session.academicContextId && String(session.academicContextId) !== requestedContextId) {
      throw _substituteError(
        'The supplied timetable session belongs to a different academic context.',
        'SESSION_CONTEXT_MISMATCH',
        409,
        { sessionContextId: String(session.academicContextId), requestedContextId }
      );
    }
    if (timetableVersionId && String(session.timetableVersionId) !== String(timetableVersionId)) {
      throw _substituteError(
        'The supplied timetable session belongs to a different timetable version.',
        'SESSION_VERSION_MISMATCH',
        409,
        { sessionVersionId: String(session.timetableVersionId), requestedVersionId: String(timetableVersionId) }
      );
    }
  } else {
    if (resolved.sessions.length === 0) {
      throw _substituteError(
        'No timetable session matches faculty ' + absence.facultyId + ' on ' + targetDate + ' (' + resolved.day + ') for period ' + _norm(period) + '.',
        'NO_AFFECTED_SESSION',
        404,
        { facultyId: absence.facultyId, date: targetDate, day: resolved.day, period: _norm(period) }
      );
    }
    if (resolved.sessions.length > 1) {
      throw _substituteError(
        'The absence affects more than one timetable session. Resolve the exact session before mapping a substitute.',
        'AMBIGUOUS_AFFECTED_SESSION',
        409,
        {
          matchedSessionIds: resolved.sessions.map((s) => String(s._id)),
          matchedCourses: resolved.sessions.map((s) => s.courseCode),
        }
      );
    }
    [session] = resolved.sessions;
  }
// ---- 4. Substitute faculty validity ------------------------------------
  const normSubstitute = _norm(substituteFacultyId);
  if (originalFacultyId && normSubstitute === _norm(originalFacultyId)) {
    throw _substituteError(
      'The absent faculty cannot also be the substitute.',
      'SUBSTITUTE_IS_ORIGINAL_FACULTY',
      409,
      { facultyId: originalFacultyId }
    );
  }
  if (normSubstitute === _norm(absence.facultyId)) {
    throw _substituteError(
      'The absent faculty cannot also be the substitute.',
      'SUBSTITUTE_IS_ORIGINAL_FACULTY',
      409,
      { facultyId: absence.facultyId }
    );
  }

  const substituteDoc = await Faculty.findOne({ facultyId: substituteFacultyId }).lean();
  if (!substituteDoc) {
    throw _substituteError(
      'Substitute faculty ' + substituteFacultyId + ' does not exist.',
      'SUBSTITUTE_FACULTY_NOT_FOUND',
      404,
      { substituteFacultyId }
    );
  }
  if (substituteDoc.isActive === false) {
    throw _substituteError(
      'Substitute faculty ' + substituteFacultyId + ' is inactive.',
      'SUBSTITUTE_FACULTY_INACTIVE',
      409,
      { substituteFacultyId }
    );
  }

  // ---- 5. Exact-slot eligibility -----------------------------------------
  const effectiveVersionId = timetableVersionId || session.timetableVersionId;
  const eligible = await findEligibleSubstitutes({
    academicContextId: requestedContextId,
    timetableVersionId: effectiveVersionId,
    session,
    date: targetDate,
    period: session.period,
    excludeFacultyId: absence.facultyId,
  });

  if (!eligible.some((f) => _norm(f.facultyId) === normSubstitute)) {
    const reasons = await explainIneligibility({
      substituteFacultyId,
      academicContextId: requestedContextId,
      timetableVersionId: effectiveVersionId,
      session,
      date: targetDate,
      period: session.period,
      excludeFacultyId: absence.facultyId,
    });
    throw _substituteError(
      'Faculty ' + substituteFacultyId + ' is not eligible to cover this session (' + reasons.join(', ') + ').',
      'SUBSTITUTE_NOT_ELIGIBLE',
      409,
      { substituteFacultyId, reasons }
    );
  }

  // ---- 6. Duplicate / conflicting mapping --------------------------------
  const existingForSession = await SubstituteAllocation.findOne({
    timetableSessionId: session._id,
    substituteFacultyId: substituteDoc.facultyId,
    date: targetDate,
    period: session.period,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  });
  if (existingForSession) {
    throw _substituteError(
      'An identical substitute mapping already exists for this session and slot.',
      'DUPLICATE_SUBSTITUTE_MAPPING',
      409,
      { existingMappingId: String(existingForSession._id) }
    );
  }

  // ---- 7. Persist --------------------------------------------------------
  const created = await SubstituteAllocation.create({
    absenceId: absence._id,
    originalFacultyId: absence.facultyId,
    substituteFacultyId: substituteDoc.facultyId,
    timetableSessionId: session._id,
    date: targetDate,
    period: session.period,
    day: session.day,
    academicContextId: session.academicContextId || requestedContextId || null,
    timetableVersionId: session.timetableVersionId || null,
    status,
    assignedBy,
  });

  return { mapping: created, session, absence };
}

/** Recomputes why a specific faculty was excluded, for an actionable 409 body. */
async function explainIneligibility({ substituteFacultyId, academicContextId, timetableVersionId, session, date, period, excludeFacultyId }) {
  const normSubstitute = _norm(substituteFacultyId);
  const reasons = [];

  const busyAtSlot = await TimetableSession.find({
    day: session.day,
    period: _norm(period),
    ...(timetableVersionId ? { timetableVersionId } : {}),
    ...(academicContextId ? { academicContextId } : {}),
    _id: { $ne: session._id },
  }).lean();

  const busy = busyAtSlot.some(
    (s) =>
      _norm(s.facultyId) === normSubstitute ||
      (s.facultyAssignments || []).some((a) => _norm(a.facultyId) === normSubstitute)
  );
  if (busy) reasons.push('CONFLICTING_TIMETABLE_SESSION');

  const absentDocs = await FacultyAbsence.find({ date, status: { $ne: 'REJECTED' } }).lean();
  if (absentDocs.some((a) => _norm(a.facultyId) === normSubstitute)) reasons.push('ABSENT_ON_DATE');

  const availability = await FacultyAvailability.findOne({
    facultyId: substituteFacultyId,
    day: session.day,
    period: _norm(period),
  }).lean();
  if (availability && _norm(availability.status) === 'UNAVAILABLE') reasons.push('MARKED_UNAVAILABLE');
  else if (availability && _norm(availability.status) === 'PREFERRED_OFF') reasons.push('PREFERRED_OFF');

  const mapped = await SubstituteAllocation.findOne({
    date,
    period: _norm(period),
    substituteFacultyId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  }).lean();
  if (mapped) reasons.push('CONFLICTING_SUBSTITUTE_MAPPING');

  if (normSubstitute === _norm(excludeFacultyId)) reasons.push('IS_ORIGINAL_FACULTY');

  return reasons.length > 0 ? reasons : ['CONSTRAINT_NOT_SATISFIED'];
}

module.exports = {
  resolveDayForDate,
  resolveAffectedSessions,
  buildAffectedSessionPayload,
  findEligibleSubstitutes,
  createSubstituteMapping,
  sessionInvolvesFaculty,
  explainIneligibility,
  _substituteError,
};
