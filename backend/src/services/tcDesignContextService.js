/**
 * TC Design Context Service
 *
 * Phase 3: Builds the authoritative timetable-design dataset for the
 * TimeTable Coordinator (TC) screen.
 *
 * Business Rules:
 *   - HODFacultyAllocation is the ONLY authority for Course → Faculty.
 *   - Read-only: this service never mutates any document.
 *   - Context-isolated: every allocation and version query is scoped to
 *     the supplied academicContextId.
 *   - No N+1 queries: all lookups are batched.
 *
 * Consumers:
 *   GET /api/timetable/design-context/:academicContextId
 */

const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const TimetableVersion = require('../models/TimetableVersion');
const { resolveSemesterForContext } = require('./timetable/semesterResolver');
const { R22_ELECTIVE_SLOT_MAP } = require('../data/r22CurriculumMaster');
const {
  getCourseAllocationPolicy,
  computeAllocationStatus,
  ALLOCATION_RULES,
} = require('./allocationPolicyService');

// ---------------------------------------------------------------------------
// Period-resolution helper — mirrors constraintBuilder L372 exactly
// ---------------------------------------------------------------------------

/**
 * Computes the canonical number of periods to schedule for a course.
 * Must stay in sync with the CSP solver's `buildSchedulingContext`.
 */
function resolveRequiredPeriods(course) {
  if (!course) return 0;

  const isLab =
    course.isLab === true ||
    course.courseType === 'LAB' ||
    (course.P >= 3 && course.L === 0);

  const totalPeriod =
    course.totalPeriod ||
    (course.L || 0) + (course.T || 0) + (course.P || 0) ||
    (isLab ? 4 : 3);

  return totalPeriod;
}

// ---------------------------------------------------------------------------
// Faculty resolution helper
// ---------------------------------------------------------------------------

/**
 * Builds the authoritative facultyAssignments array for a course from its
 * HOD allocation, enriched with Faculty document data from the batch-loaded
 * faculty map.
 *
 * @param {Object}  allocation  - HODFacultyAllocation document (lean)
 * @param {Map}     facultyMap  - Map<facultyId, Faculty doc>
 * @param {Object}  policy      - getCourseAllocationPolicy() result
 * @returns {{ assignments: Array, validationErrors: Array }}
 */
function resolveAuthoritativeFacultyAssignments(allocation, facultyMap, policy) {
  const assignments = [];
  const validationErrors = [];

  if (!allocation) {
    return { assignments, validationErrors };
  }

  const rawAssignments =
    Array.isArray(allocation.facultyAssignments) && allocation.facultyAssignments.length > 0
      ? allocation.facultyAssignments
      : allocation.facultyId
        ? [{ facultyId: allocation.facultyId, facultyName: allocation.facultyName || '', role: 'THEORY' }]
        : [];

  for (const fa of rawAssignments) {
    const fid = (fa.facultyId || '').trim();
    if (!fid) continue;

    const facultyDoc = facultyMap.get(fid);

    if (!facultyDoc) {
      validationErrors.push({
        facultyId: fid,
        error: 'FACULTY_NOT_FOUND',
        message: `Faculty '${fid}' not found in Faculty database.`,
      });
      assignments.push({
        facultyId: fid,
        facultyName: fa.facultyName || '',
        role: fa.role || 'THEORY',
        valid: false,
        error: 'FACULTY_NOT_FOUND',
      });
      continue;
    }

    if (!facultyDoc.isActive) {
      validationErrors.push({
        facultyId: fid,
        error: 'FACULTY_INACTIVE',
        message: `Faculty '${fid}' (${facultyDoc.facultyName}) is inactive.`,
      });
      assignments.push({
        facultyId: fid,
        facultyName: facultyDoc.facultyName,
        role: fa.role || 'THEORY',
        valid: false,
        error: 'FACULTY_INACTIVE',
      });
      continue;
    }

    assignments.push({
      facultyId: fid,
      facultyName: facultyDoc.facultyName,
      designation: facultyDoc.designation || null,
      department: facultyDoc.department || null,
      role: fa.role || 'THEORY',
      source: fa.source || 'MANUAL',
      valid: true,
    });
  }

  return { assignments, validationErrors };
}

// ---------------------------------------------------------------------------
// Timetable eligibility helper
// ---------------------------------------------------------------------------

/**
 * Determines whether a course is eligible for timetable scheduling.
 *
 * @param {string} allocationStatus   - computeAllocationStatus() result
 * @param {Object} policy             - getCourseAllocationPolicy() result
 * @param {Array}  validationErrors   - Faculty validation errors
 * @returns {{ eligible: boolean, reason: string|null }}
 */
function computeTimetableEligibility(allocationStatus, policy, validationErrors) {
  // MC_OPTIONAL_MAPPING with disabled mapping is always eligible (not a blocker)
  if (policy.rule === ALLOCATION_RULES.MC_OPTIONAL_MAPPING) {
    if (allocationStatus === 'OPTIONAL_NOT_MAPPED') {
      return { eligible: true, reason: null };
    }
    // If mapped, check validity
    if (validationErrors.length > 0) {
      return { eligible: false, reason: 'FACULTY_VALIDATION_ERROR' };
    }
    return { eligible: true, reason: null };
  }

  // Faculty validation errors
  if (validationErrors.length > 0) {
    return { eligible: false, reason: 'FACULTY_VALIDATION_ERROR' };
  }

  // Allocation completeness
  switch (allocationStatus) {
    case 'UNALLOCATED':
      return { eligible: false, reason: 'HOD_FACULTY_ALLOCATION_REQUIRED' };
    case 'INCOMPLETE':
    case 'PRIMARY_ONLY':
      return { eligible: false, reason: 'HOD_FACULTY_ALLOCATION_INCOMPLETE' };
    case 'MATHS_BME_MISSING':
      return { eligible: false, reason: 'MATHS_BME_FACULTY_REQUIRED' };
    case 'ENGLISH_MISSING':
      return { eligible: false, reason: 'ENGLISH_FACULTY_REQUIRED' };
    case 'COMPLETE':
    case 'COMPLETE_2':
    case 'COMPLETE_3':
    case 'MAPPED':
      return { eligible: true, reason: null };
    default:
      return { eligible: false, reason: 'HOD_FACULTY_ALLOCATION_REQUIRED' };
  }
}

// ---------------------------------------------------------------------------
// Main Service Function
// ---------------------------------------------------------------------------

/**
 * Builds the authoritative TC timetable design context for a given
 * academic context.
 *
 * @param {string|ObjectId} academicContextId
 * @returns {Promise<Object>} Design context response payload
 */
async function getTCTimetableDesignContext(academicContextId) {
  // ---- 1. Validate AcademicContext ----
  if (!academicContextId) {
    return {
      success: false,
      statusCode: 400,
      code: 'INVALID_CONTEXT',
      message: 'academicContextId is required.',
    };
  }

  const context = await AcademicContext.findById(academicContextId);
  if (!context) {
    return {
      success: false,
      statusCode: 404,
      code: 'CONTEXT_NOT_FOUND',
      message: `Academic context '${academicContextId}' not found.`,
    };
  }

  if (context.status !== 'ACTIVE') {
    return {
      success: false,
      statusCode: 400,
      code: 'CONTEXT_INACTIVE',
      message: `Academic context '${academicContextId}' is not active (status: ${context.status}).`,
    };
  }

  // ---- 2. Resolve Curriculum Semester ----
  const expectedSemester = resolveSemesterForContext(context);
  if (!expectedSemester) {
    return {
      success: false,
      statusCode: 400,
      code: 'INVALID_COHORT_YEAR',
      message: `Cannot map cohort '${context.year}' (${context.semester}) to an authoritative curriculum semester.`,
    };
  }

  // ---- 3. Batch-load Curriculum Courses (1 query) ----
  const coreCourses = await Course.find({
    semester: expectedSemester,
    isActive: true,
    category: { $nin: ['PEC', 'OEC'] },
  }).sort({ courseCode: 1 }).lean();

  // ---- 4. Batch-load HOD Allocations for this context (1 query) ----
  const allAllocations = await HODFacultyAllocation.find({
    academicContextId: context._id,
    status: { $ne: 'REJECTED' },
  }).lean();

  // Build allocation lookup by courseCode
  const allocByCourse = new Map();
  allAllocations.forEach((a) => {
    allocByCourse.set(a.courseCode, a);
  });

  // ---- 5. Resolve Allocated Electives (from allocations, not catalog) ----
  const coreCodes = new Set(coreCourses.map((c) => c.courseCode));
  const allocatedElectiveCodes = allAllocations
    .map((a) => a.courseCode)
    .filter((code) => !coreCodes.has(code));

  let electiveCourses = [];
  if (allocatedElectiveCodes.length > 0) {
    const rawElectives = await Course.find({
      courseCode: { $in: allocatedElectiveCodes },
      isActive: true,
      $or: [
        { category: { $in: ['PEC', 'OEC'] } },
        { semester: { $in: ['Programme Elective', 'Open Elective'] } },
        { semester: expectedSemester },
      ],
    }).lean();

    // Exclude core courses from other semesters that might exist in historical allocations
    electiveCourses = rawElectives.filter((crs) => {
      if (crs.semester && crs.semester.startsWith('Semester ') && crs.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
        return false;
      }
      return true;
    });
  }

  const allCohortCourses = [...coreCourses, ...electiveCourses];

  const electiveSlots = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];

  // ---- 6. Collect all faculty IDs and batch-load (1 query) ----
  const facultyIdsSet = new Set();
  allAllocations.forEach((a) => {
    if (a.facultyId) facultyIdsSet.add(a.facultyId.trim());
    if (Array.isArray(a.facultyAssignments)) {
      a.facultyAssignments.forEach((fa) => {
        if (fa.facultyId) facultyIdsSet.add(fa.facultyId.trim());
      });
    }
  });

  const facultyDocs = facultyIdsSet.size > 0
    ? await Faculty.find({ facultyId: { $in: Array.from(facultyIdsSet) } }).lean()
    : [];

  const facultyMap = new Map(facultyDocs.map((f) => [f.facultyId, f]));

  // ---- 7. Load Current TimetableVersion for this context (1 query) ----
  const versions = await TimetableVersion.find({
    academicContextId: context._id,
  }).sort({ createdAt: -1 }).lean();

  // Priority selection: PUBLISHED > APPROVED > PENDING_HOD_APPROVAL > GENERATED > DRAFT > NO_TIMETABLE
  const STATUS_PRIORITY = ['PUBLISHED', 'APPROVED', 'PENDING_HOD_APPROVAL', 'GENERATED', 'DRAFT', 'NO_TIMETABLE'];
  let currentVersion = null;

  for (const status of STATUS_PRIORITY) {
    const found = versions.find((v) => v.status === status);
    if (found) {
      currentVersion = found;
      break;
    }
  }

  // If no priority match, use the most recent version
  if (!currentVersion && versions.length > 0) {
    currentVersion = versions[0];
  }

  // ---- 8. Build Per-Course Design Contract ----
  let completedCourses = 0;
  let pendingCourses = 0;
  let totalRequiredCourses = 0;

  const courses = allCohortCourses.map((course) => {
    const policy = getCourseAllocationPolicy(course, allCohortCourses);
    const allocation = allocByCourse.get(course.courseCode) || null;
    const allocationStatus = computeAllocationStatus(policy, allocation);

    const { assignments, validationErrors } = resolveAuthoritativeFacultyAssignments(
      allocation, facultyMap, policy
    );

    const isLab =
      course.isLab === true ||
      course.courseType === 'LAB' ||
      (course.P >= 3 && course.L === 0);

    const requiredPeriods = resolveRequiredPeriods(course);
    const sessionType = isLab ? 'LAB' : (course.courseType || 'THEORY');

    const { eligible, reason } = computeTimetableEligibility(
      allocationStatus, policy, validationErrors
    );

    // Determine timetable mapping state
    const timetableMapping = allocation
      ? (allocation.timetableMapping || policy.timetableMapping)
      : policy.timetableMapping;

    // Count readiness (exclude MC_OPTIONAL_MAPPING from required count)
    const isRequiredForReadiness = policy.rule !== ALLOCATION_RULES.MC_OPTIONAL_MAPPING;

    if (isRequiredForReadiness) {
      totalRequiredCourses++;
      if (eligible) {
        completedCourses++;
      } else {
        pendingCourses++;
      }
    }

    return {
      courseCode: course.courseCode,
      courseName: course.courseName,
      courseType: course.courseType || 'THEORY',
      sessionType,
      category: course.category,
      // Phase 4: the generation engine needs the owning department to pick the
      // correct lab room, exactly as the legacy constraintBuilder does.
      department: course.department || null,
      credits: course.credits,
      requiredPeriods,
      contactPeriod: course.contactPeriod,
      L: course.L,
      T: course.T,
      P: course.P,
      totalPeriod: course.totalPeriod,
      allocationRule: policy.rule,
      allocationStatus,
      linkedTheoryCourseCode: policy.linkedTheoryCourseCode || null,
      facultyAssignments: assignments,
      facultyValidationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      timetableEligible: eligible,
      timetableEligibilityReason: reason,
      timetableMapping,
    };
  });

  // ---- 9. Compute Context-Level Readiness ----
  const allRequiredAllocationsComplete = pendingCourses === 0 && totalRequiredCourses > 0;

  let readinessState;
  if (allCohortCourses.length === 0) {
    readinessState = 'CURRICULUM_UNAVAILABLE';
  } else if (!allRequiredAllocationsComplete) {
    readinessState = 'ALLOCATION_INCOMPLETE';
  } else if (currentVersion && currentVersion.status === 'PUBLISHED') {
    readinessState = 'PUBLISHED';
  } else if (currentVersion && currentVersion.status === 'APPROVED') {
    readinessState = 'APPROVED';
  } else if (currentVersion && currentVersion.status === 'PENDING_HOD_APPROVAL') {
    readinessState = 'PENDING_HOD_APPROVAL';
  } else if (currentVersion && ['GENERATED', 'DRAFT'].includes(currentVersion.status)) {
    readinessState = 'TIMETABLE_GENERATED';
  } else {
    readinessState = 'READY_FOR_GENERATION';
  }

  // ---- 10. Construct Response ----
  return {
    success: true,
    statusCode: 200,
    data: {
      academicContext: {
        id: context._id,
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        year: context.year,
        section: context.section,
        program: context.program,
        status: context.status,
      },

      regulation: 'R22',
      curriculumSemester: expectedSemester,

      readiness: {
        state: readinessState,
        allRequiredAllocationsComplete,
        totalCourses: allCohortCourses.length,
        totalRequiredCourses,
        completedCourses,
        pendingCourses,
      },

      electiveSelection: {
        requiredSlotsCount: electiveSlots.length,
        allocatedElectivesCount: allocatedElectiveCodes.length,
        allocatedElectives: allocatedElectiveCodes,
        isElectiveComplete: electiveSlots.length === 0 || allocatedElectiveCodes.length >= electiveSlots.length,
        electiveSlots,
      },

      currentVersion: currentVersion
        ? {
          id: currentVersion._id,
          version: currentVersion.version,
          versionLabel: currentVersion.versionLabel,
          status: currentVersion.status,
          generatedBy: currentVersion.generatedBy,
          submittedBy: currentVersion.submittedBy,
          approvedBy: currentVersion.approvedBy,
          totalScheduledPeriods: currentVersion.totalScheduledPeriods,
          createdAt: currentVersion.createdAt,
        }
        : null,

      courses,
    },
  };
}

module.exports = {
  getTCTimetableDesignContext,
  // Exported for testing
  resolveRequiredPeriods,
  resolveAuthoritativeFacultyAssignments,
  computeTimetableEligibility,
};
