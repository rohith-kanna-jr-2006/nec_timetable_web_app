const Course = require('../models/Course');
const AcademicContext = require('../models/AcademicContext');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const { R22_ELECTIVE_SLOT_MAP } = require('../data/r22CurriculumMaster');

/**
 * Phase 10 - Elective Object (EO) selection, HOD-authoritative.
 *
 * Concept separation enforced here:
 *
 *   Elective catalog      = every EO course that exists
 *   Elective candidate    = catalog entry applicable to this context's regulation+slots
 *   HOD selection         = HODFacultyAllocation for this exact AcademicContext
 *   Active elective       = an HOD selection that exists and is not REJECTED
 *   Timetable eligibility = active electives surfaced in the TC design context
 *
 * A catalog entry is NOT a selection, and a selection is NOT automatically
 * schedulable. Only an HOD allocation activates an elective.
 */

const ELECTIVE_TYPES = ['PEC', 'OEC', 'Management Elective'];

function _err(message, code, statusCode, details) {
  const err = new Error(message);
  err.name = 'ElectiveSelectionError';
  err.code = code;
  err.statusCode = statusCode;
  err.details = details === undefined ? null : details;
  return err;
}

const _norm = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : '');

/** Resolves the timetable semester a context cohort maps onto. */
function resolveSemesterForContext(context) {
  const explicit = (context && context.semester) || '';
  if (/^Semester\s+[IVX]+$/i.test(explicit.trim())) return explicit.trim();
  const year = ((context && context.year) || '').toUpperCase();
  if (year.includes('II') && !year.includes('III')) return 'Semester III';
  if (year.includes('III')) return 'Semester V';
  if (year.includes('IV')) return 'Semester VII';
  return null;
}

/**
 * The regulation that applies to a context's programme.
 * Derived from the AcademicContext programme, never hardcoded per context.
 */
function regulationForContext(context) {
  const program = _norm((context && context.program) || 'UG');
  return program === 'PG' ? 'R22-PG' : 'R22';
}

/** Regulations the Course collection actually represents. */
async function getSupportedRegulations() {
  const found = await Course.distinct('regulation');
  const known = ['R22', 'R22-PG'].filter((r) => found.includes(r));
  return known.length > 0 ? known : found;
}

/** Validates a regulation is genuinely supported; never invents one. */
async function assertSupportedRegulation(regulation) {
  const wanted = _norm(regulation);
  const supported = await getSupportedRegulations();
  if (supported.map(_norm).indexOf(wanted) === -1) {
    throw _err(
      'Regulation ' + regulation + ' is not supported by this backend',
      'REGULATION_NOT_SUPPORTED',
      404,
      { requestedRegulation: regulation, supportedRegulations: supported }
    );
  }
  return wanted;
}

/** Elective slots for a context's semester (empty when the semester has no EO slots). */
function electiveSlotsForContext(context) {
  const semester = resolveSemesterForContext(context);
  if (!semester) return { semester: null, slots: [] };
  return { semester, slots: R22_ELECTIVE_SLOT_MAP[semester] || [] };
}

/** True when a course is an EO catalog entry. */
function isElectiveCourse(course) {
  if (!course) return false;
  return ELECTIVE_TYPES.indexOf(_norm(course.electiveType)) !== -1 ||
    ELECTIVE_TYPES.indexOf(_norm(course.category)) !== -1;
}

/** Slot types a semester's EO slots permit. */
function allowedElectiveTypes(slots) {
  const allowed = new Set();
  (slots || []).forEach((s) => String(s.allowedType || '').split('/').forEach((t) => allowed.add(t.trim())));
  return allowed;
}

/** The HOD-authoritative active elective selection for one exact context. */
async function getActiveElectiveSelection(academicContextId) {
  const context = await AcademicContext.findById(academicContextId).lean();
  if (!context) {
    throw _err('Academic context not found', 'CONTEXT_NOT_FOUND', 404, { academicContextId });
  }

  const allocations = await HODFacultyAllocation.find({
    academicContextId: context._id,
    status: { $ne: 'REJECTED' },
  }).lean();

  // A "core course" for this cohort is a course that belongs to the cohort's own
  // semester and is not an elective. Anything else that the HOD allocated is an
  // active elective. This mirrors tcDesignContextService exactly.
  const slotInfo = electiveSlotsForContext(context);
  const core = slotInfo.semester
    ? await Course.find({
        semester: slotInfo.semester,
        isActive: true,
        category: { $nin: ELECTIVE_TYPES },
      })
        .select('courseCode')
        .lean()
    : [];
  const coreCodes = new Set(core.map((c) => c.courseCode));

  const selected = allocations.filter((a) => !coreCodes.has(a.courseCode));

  const isComplete = slotInfo.slots.length === 0 || selected.length >= slotInfo.slots.length;

  return {
    academicContextId: context._id,
    regulation: regulationForContext(context),
    semester: slotInfo.semester,
    requiredSlotsCount: slotInfo.slots.length,
    slots: slotInfo.slots,
    selectedCount: selected.length,
    isComplete,
    selected: selected.map((a) => ({
      courseCode: a.courseCode,
      courseName: a.courseName,
      allocationId: a._id,
      status: a.status,
      assignedBy: a.assignedBy,
      facultyId: a.facultyId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    // Actionable state, mirroring the existing readiness vocabulary.
    state: isComplete ? 'ELECTIVE_SELECTION_COMPLETE' : 'ELECTIVE_SELECTION_REQUIRED',
  };
}

/**
 * Validates a proposed EO selection for a context: the course must be an active
 * EO catalog entry belonging to this context's regulation, and of an elective
 * type the cohort's slots permit.
 */
async function validateElectiveSelection(options) {
  const context = await AcademicContext.findById(options.academicContextId).lean();
  if (!context) {
    throw _err('Academic context not found', 'CONTEXT_NOT_FOUND', 404, { academicContextId: options.academicContextId });
  }

  const code = _norm(options.courseCode);
  const course = await Course.findOne({ courseCode: code }).lean();
  if (!course) {
    throw _err('Course ' + code + ' not found in Course Master', 'COURSE_NOT_FOUND', 404, { courseCode: code });
  }
  if (!isElectiveCourse(course)) {
    throw _err('Course ' + code + ' is not an elective (EO) course', 'COURSE_NOT_ELECTIVE', 409, {
      courseCode: code,
      category: course.category,
      electiveType: course.electiveType,
    });
  }
  if (course.isActive === false) {
    throw _err('Course ' + code + ' is inactive', 'COURSE_INACTIVE', 409, { courseCode: code });
  }

  const expectedRegulation = regulationForContext(context);
  if (_norm(course.regulation) !== _norm(expectedRegulation)) {
    throw _err(
      'Course ' + code + ' belongs to regulation ' + course.regulation + ', but this cohort follows ' + expectedRegulation,
      'ELECTIVE_COURSE_WRONG_REGULATION',
      409,
      { courseCode: code, courseRegulation: course.regulation, contextRegulation: expectedRegulation }
    );
  }

  const slotInfo = electiveSlotsForContext(context);
  const allowed = allowedElectiveTypes(slotInfo.slots);
  const type = _norm(course.electiveType) || _norm(course.category);
  if (slotInfo.slots.length > 0 && allowed.has(type) === false) {
    throw _err(
      'Course ' + code + ' is of type ' + type + ', which is not permitted for ' + (slotInfo.semester || 'this cohort'),
      'ELECTIVE_COURSE_WRONG_SEMESTER',
      409,
      { courseCode: code, courseType: type, semester: slotInfo.semester, allowedTypes: Array.from(allowed) }
    );
  }

  return { course: course, context: context, semester: slotInfo.semester, slots: slotInfo.slots };
}

/** EO catalog candidates applicable to a context, flagged with the current selection. */
async function listElectiveCandidates(options) {
  const context = await AcademicContext.findById(options.academicContextId).lean();
  if (!context) {
    throw _err('Academic context not found', 'CONTEXT_NOT_FOUND', 404, { academicContextId: options.academicContextId });
  }

  const contextRegulation = regulationForContext(context);
  const effectiveRegulation = options.regulation
    ? await assertSupportedRegulation(options.regulation)
    : contextRegulation;

  const slotInfo = electiveSlotsForContext(context);
  const allowed = allowedElectiveTypes(slotInfo.slots);

  const selected = await HODFacultyAllocation.find({
    academicContextId: context._id,
    status: { $ne: 'REJECTED' },
  })
    .select('courseCode')
    .lean();
  const selectedCodes = new Set(selected.map((s) => s.courseCode));

  const catalog = await Course.find({
    regulation: effectiveRegulation,
    isActive: true,
    $or: [{ electiveType: { $in: ELECTIVE_TYPES } }, { category: { $in: ELECTIVE_TYPES } }],
  })
    .select('courseCode courseName semester category electiveType vertical regulation isActive')
    .sort({ electiveType: 1, courseCode: 1 })
    .lean();

  const candidates = catalog
    .map((c) => {
      const type = _norm(c.electiveType) || _norm(c.category);
      return {
        courseCode: c.courseCode,
        courseName: c.courseName,
        regulation: c.regulation,
        catalogSemester: c.semester,
        electiveType: c.electiveType || c.category,
        vertical: c.vertical || null,
        isSlotEligible: slotInfo.slots.length === 0 || allowed.has(type),
        isSelected: selectedCodes.has(c.courseCode),
      };
    })
    .filter((c) => c.isSlotEligible);

  return {
    academicContextId: context._id,
    regulation: effectiveRegulation,
    semester: options.semester || slotInfo.semester,
    slots: slotInfo.slots,
    allowedElectiveTypes: Array.from(allowed),
    candidateCount: candidates.length,
    candidates: candidates,
  };
}

module.exports = {
  ELECTIVE_TYPES: ELECTIVE_TYPES,
  resolveSemesterForContext: resolveSemesterForContext,
  regulationForContext: regulationForContext,
  getSupportedRegulations: getSupportedRegulations,
  assertSupportedRegulation: assertSupportedRegulation,
  electiveSlotsForContext: electiveSlotsForContext,
  isElectiveCourse: isElectiveCourse,
  allowedElectiveTypes: allowedElectiveTypes,
  getActiveElectiveSelection: getActiveElectiveSelection,
  validateElectiveSelection: validateElectiveSelection,
  listElectiveCandidates: listElectiveCandidates,
  _err: _err,
  _norm: _norm,
};
