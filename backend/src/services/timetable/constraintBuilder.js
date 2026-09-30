/**
 * Constraint & Problem Builder for Automated Timetable Generation
 *
 * Validates authoritative academic context, R22 curriculum semester mapping,
 * HOD faculty allocations, faculty availability, and existing timetable occupancy.
 */

const AcademicContext = require('../../models/AcademicContext');
const TimetableVersion = require('../../models/TimetableVersion');
const TimetableSession = require('../../models/TimetableSession');
const Course = require('../../models/Course');
const Faculty = require('../../models/Faculty');
const HODFacultyAllocation = require('../../models/HODFacultyAllocation');
const FacultyAvailability = require('../../models/FacultyAvailability');
const { DEFAULT_DAYS, DEFAULT_PERIODS } = require('./timetableGrid');
const { resolveSemesterForContext } = require('./semesterResolver');
const { R22_ELECTIVE_SLOT_MAP } = require('../../data/r22CurriculumMaster');

const YEAR_TO_SEMESTER = {
  'I YEAR': 'Semester I',
  'II YEAR': 'Semester III',
  'III YEAR': 'Semester V',
  'IV YEAR': 'Semester VII',
};

class ConstraintBuilderError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ConstraintBuilderError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates inputs and constructs the scheduling problem domain.
 */
async function buildSchedulingContext(input = {}) {
  const {
    academicContextId,
    timetableVersionId,
    assignmentPlan,
    gridConfig = {},
  } = input;

  if (!academicContextId) {
    throw new ConstraintBuilderError(
      'academicContextId is required for timetable generation.',
      'INVALID_CONTEXT'
    );
  }

  // 1. Resolve and validate Academic Context
  const context = await AcademicContext.findById(academicContextId);
  if (!context) {
    throw new ConstraintBuilderError(
      `Academic context '${academicContextId}' not found.`,
      'CONTEXT_NOT_FOUND',
      { academicContextId }
    );
  }

  if (context.status !== 'ACTIVE') {
    throw new ConstraintBuilderError(
      `Academic context '${academicContextId}' is not active (status: ${context.status}).`,
      'CONTEXT_INACTIVE',
      { academicContextId }
    );
  }

  const expectedSemester = resolveSemesterForContext(context);
  if (!expectedSemester) {
    throw new ConstraintBuilderError(
      `Cannot map cohort '${context.year}' (${context.semester}) to an authoritative curriculum semester.`,
      'INVALID_COHORT_YEAR',
      { year: context.year, semester: context.semester }
    );
  }

  // 2. Resolve or initialize Timetable Version
  let version = null;
  if (timetableVersionId) {
    version = await TimetableVersion.findById(timetableVersionId);
    if (!version) {
      throw new ConstraintBuilderError(
        `Timetable version '${timetableVersionId}' not found.`,
        'VERSION_NOT_FOUND',
        { timetableVersionId }
      );
    }
    if (['PUBLISHED', 'APPROVED'].includes(version.status)) {
      throw new ConstraintBuilderError(
        `Timetable version '${version.versionLabel}' is ${version.status} and cannot be modified.`,
        'VERSION_LOCKED',
        { status: version.status }
      );
    }
  } else {
    // Find latest draft/generated version or prepare one
    version = await TimetableVersion.findOne({
      academicYear: context.academicYear,
      semester: context.semester,
      department: context.department,
      year: context.year,
      section: context.section,
    }).sort({ createdAt: -1 });

    if (!version || ['PUBLISHED', 'APPROVED'].includes(version.status)) {
      version = await TimetableVersion.create({
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        year: context.year,
        section: context.section,
        version: 1,
        versionLabel: 'v1.0 (Auto-Generated)',
        status: 'GENERATED',
        generatedBy: 'Auto-Solver',
      });
    }
  }

  // 3. Resolve Courses to be scheduled
  let coursesToSchedule = [];
  if (Array.isArray(assignmentPlan) && assignmentPlan.length > 0) {
    for (const item of assignmentPlan) {
      if (!item.courseCode) continue;
      const normalizedCode = item.courseCode.toUpperCase().trim();
      const course = await Course.findOne({ courseCode: normalizedCode });
      if (!course) {
        throw new ConstraintBuilderError(
          `Course '${normalizedCode}' in assignment plan not found.`,
          'COURSE_NOT_FOUND',
          { courseCode: normalizedCode }
        );
      }

      // Check semester integrity
      if (course.semester && course.semester.startsWith('Semester ')) {
        if (course.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
          throw new ConstraintBuilderError(
            `Course '${normalizedCode}' belongs to ${course.semester}, but target cohort is ${context.year} (${expectedSemester}).`,
            'COURSE_SEMESTER_MISMATCH',
            { courseCode: normalizedCode, expectedSemester, actualSemester: course.semester }
          );
        }
      } else if (
        ['PEC', 'OEC', 'Management Elective'].includes(course.electiveType) ||
        ['PEC', 'OEC'].includes(course.category)
      ) {
        // Validate elective slot applicability for target semester
        const slotsForSem = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];
        const allowsPEC = slotsForSem.some((s) => s.allowedType.includes('PEC'));
        const allowsOEC = slotsForSem.some((s) => s.allowedType.includes('OEC'));
        const allowsMgmt = slotsForSem.some((s) => s.allowedType.includes('Management'));

        const isPEC = course.electiveType === 'PEC' || course.category === 'PEC';
        const isOEC = course.electiveType === 'OEC' || course.category === 'OEC';
        const isMgmt = course.electiveType === 'Management Elective';

        if ((isPEC && !allowsPEC) || (isOEC && !allowsOEC) || (isMgmt && !allowsMgmt)) {
          throw new ConstraintBuilderError(
            `Elective '${normalizedCode}' (${course.electiveType || course.category}) is not permitted in ${expectedSemester}.`,
            'COURSE_SEMESTER_MISMATCH',
            { courseCode: normalizedCode, expectedSemester, electiveType: course.electiveType }
          );
        }
      }

      coursesToSchedule.push({
        course,
        requestedFacultyId: item.facultyId ? item.facultyId.trim() : null,
        requestedPeriods: item.requiredPeriods || null,
        requestedType: item.type || null,
      });
    }
  } else {
    // Automatically load all core/active courses for this curriculum semester
    const semCourses = await Course.find({
      semester: expectedSemester,
      isActive: true,
      category: { $nin: ['PEC', 'OEC'] },
    }).sort({ courseCode: 1 });

    if (semCourses.length === 0) {
      throw new ConstraintBuilderError(
        `No curriculum courses found for ${expectedSemester}.`,
        'NO_COURSES_FOUND',
        { semester: expectedSemester }
      );
    }

    coursesToSchedule = semCourses.map((c) => ({
      course: c,
      requestedFacultyId: null,
      requestedPeriods: null,
      requestedType: null,
    }));

    // Check if semester requires electives
    const electiveSlots = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];
    if (electiveSlots.length > 0) {
      const existingAllocs = await HODFacultyAllocation.find({
        academicContextId: context._id,
        status: { $ne: 'REJECTED' },
      });

      const coreCodes = new Set(semCourses.map((c) => c.courseCode));
      const allocatedElectiveCodes = existingAllocs
        .map((a) => a.courseCode)
        .filter((code) => !coreCodes.has(code));

      if (allocatedElectiveCodes.length < electiveSlots.length) {
        throw new ConstraintBuilderError(
          `Cohort requires ${electiveSlots.length} active elective allocation(s), but only ${allocatedElectiveCodes.length} allocated. Elective selection required prior to generation.`,
          'ELECTIVE_SELECTION_REQUIRED',
          { expectedSemester, requiredSlots: electiveSlots.map((s) => s.slot), allocatedCount: allocatedElectiveCodes.length }
        );
      }

      for (const electiveCode of allocatedElectiveCodes) {
        const electiveCourse = await Course.findOne({ courseCode: electiveCode });
        if (electiveCourse) {
          coursesToSchedule.push({
            course: electiveCourse,
            requestedFacultyId: null,
            requestedPeriods: null,
            requestedType: null,
          });
        }
      }
    }
  }

  // 4. Resolve Authoritative HOD Faculty Allocations
  const resolvedRequirements = [];
  const facultyIdsSet = new Set();

  for (const entry of coursesToSchedule) {
    const { course, requestedFacultyId, requestedPeriods, requestedType } = entry;
    const courseCode = course.courseCode.toUpperCase().trim();

    const hodAllocs = await HODFacultyAllocation.find({
      academicContextId: context._id,
      courseCode,
      status: { $ne: 'REJECTED' },
    });

    if (hodAllocs.length === 0) {
      throw new ConstraintBuilderError(
        `Course '${courseCode}' (${course.courseName}) has no authoritative HOD Course → Faculty allocation for ${context.year} Sec ${context.section}.`,
        'HOD_ALLOCATION_REQUIRED',
        { courseCode, courseName: course.courseName, academicContextId: context._id }
      );
    }

    if (hodAllocs.length > 1) {
      throw new ConstraintBuilderError(
        `Multiple active HOD allocations found for course '${courseCode}'. HOD resolution is required.`,
        'HOD_ALLOCATION_CONFLICT',
        { courseCode, allocationCount: hodAllocs.length }
      );
    }

    const allocation = hodAllocs[0];
    const authoritativeFacultyId = allocation.facultyId.trim();

    if (requestedFacultyId && requestedFacultyId !== authoritativeFacultyId) {
      throw new ConstraintBuilderError(
        `Requested faculty '${requestedFacultyId}' does not match authoritative HOD allocated faculty '${authoritativeFacultyId}' for course '${courseCode}'.`,
        'HOD_FACULTY_MISMATCH',
        { courseCode, requestedFacultyId, authoritativeFacultyId }
      );
    }

    // Verify faculty exists and is active
    const facultyDoc = await Faculty.findOne({ facultyId: authoritativeFacultyId });
    if (!facultyDoc) {
      throw new ConstraintBuilderError(
        `Allocated faculty '${authoritativeFacultyId}' not found in Faculty database.`,
        'FACULTY_NOT_FOUND',
        { facultyId: authoritativeFacultyId, courseCode }
      );
    }

    if (facultyDoc.isActive === false) {
      throw new ConstraintBuilderError(
        `Allocated faculty '${authoritativeFacultyId}' (${facultyDoc.facultyName}) is inactive.`,
        'FACULTY_INACTIVE',
        { facultyId: authoritativeFacultyId, courseCode }
      );
    }

    facultyIdsSet.add(authoritativeFacultyId);

    // Determine lab vs theory classification
    const isLab =
      course.isLab === true ||
      course.courseType === 'LAB' ||
      allocation.allocationType === 'LAB_PRIMARY' ||
      (course.P >= 3 && course.L === 0);

    const totalPeriod = requestedPeriods || course.totalPeriod || (course.L || 0) + (course.T || 0) + (course.P || 0) || (isLab ? 4 : 3);
    const labBlockSize = isLab ? (course.P || totalPeriod || 4) : 1;

    resolvedRequirements.push({
      courseCode,
      courseName: course.courseName,
      facultyId: authoritativeFacultyId,
      facultyName: allocation.facultyName || facultyDoc.facultyName,
      isLab,
      totalPeriod,
      labBlockSize,
      sessionType: isLab ? 'LAB' : (course.courseType || 'THEORY'),
      room: isLab ? (course.department === 'CSE' ? 'Systems Lab' : 'Laboratory') : 'LH-101',
    });
  }

  // 5. Expand into Schedulable Variables
  const labVariables = [];
  const theoryVariables = [];

  for (const req of resolvedRequirements) {
    if (req.isLab) {
      // Create block variable(s)
      const blocksCount = Math.max(1, Math.floor(req.totalPeriod / req.labBlockSize));
      for (let b = 1; b <= blocksCount; b++) {
        labVariables.push({
          id: `${req.courseCode}-LAB-${b}`,
          courseCode: req.courseCode,
          courseName: req.courseName,
          facultyId: req.facultyId,
          facultyName: req.facultyName,
          isLab: true,
          duration: req.labBlockSize,
          sessionType: 'LAB',
          room: req.room,
        });
      }
    } else {
      // Create independent single-period variables
      for (let p = 1; p <= req.totalPeriod; p++) {
        theoryVariables.push({
          id: `${req.courseCode}-T-${p}`,
          courseCode: req.courseCode,
          courseName: req.courseName,
          facultyId: req.facultyId,
          facultyName: req.facultyName,
          isLab: false,
          duration: 1,
          sessionType: req.sessionType,
          room: req.room,
        });
      }
    }
  }

  // 6. Build Global Occupancy and Faculty Availability Maps
  const facultyUnavailableSet = new Set();
  const unavailRecords = await FacultyAvailability.find({
    facultyId: { $in: Array.from(facultyIdsSet) },
    status: 'UNAVAILABLE',
  });
  unavailRecords.forEach((u) => {
    facultyUnavailableSet.add(`${u.facultyId}_${u.day}_${u.period}`);
  });

  // Global Faculty Occupancy: sessions in other academic contexts or published versions
  const globalFacultyOccupancy = new Map();
  const otherSessions = await TimetableSession.find({
    academicContextId: { $ne: context._id },
    facultyId: { $in: Array.from(facultyIdsSet) },
  });

  otherSessions.forEach((s) => {
    const key = `${s.facultyId}_${s.day}_${s.period}`;
    globalFacultyOccupancy.set(key, {
      courseCode: s.courseCode,
      academicContextId: s.academicContextId,
      sessionType: s.sessionType,
    });
  });

  // Existing sessions for THIS class (e.g. if locked or if preserving non-course sessions like Library/Sports)
  const existingClassOccupancy = new Map();
  const existingClassSessions = await TimetableSession.find({
    timetableVersionId: version._id,
    academicContextId: context._id,
  });

  // Check if any existing sessions are locked non-teaching sessions (e.g., mentor, library, sports)
  // For generation, standard curriculum theory and lab sessions are replaced cleanly by the solver.
  // Locked sessions can be preserved if configured.
  const preserveSessionTypes = gridConfig.preserveSessionTypes || ['SAS', 'OTHER'];
  if (gridConfig.preserveExistingSpecialSessions) {
    existingClassSessions.forEach((s) => {
      if (preserveSessionTypes.includes(s.sessionType)) {
        existingClassOccupancy.set(`${s.day}_${s.period}`, s);
        globalFacultyOccupancy.set(`${s.facultyId}_${s.day}_${s.period}`, s);
      }
    });
  }

  const finalGridConfig = {
    days: gridConfig.days || DEFAULT_DAYS,
    periods: gridConfig.periods || DEFAULT_PERIODS,
    ...gridConfig,
  };

  return {
    context,
    version,
    expectedSemester,
    resolvedRequirements,
    labVariables,
    theoryVariables,
    allVariables: [...labVariables, ...theoryVariables],
    globalFacultyOccupancy,
    existingClassOccupancy,
    facultyUnavailableSet,
    gridConfig: finalGridConfig,
  };
}

module.exports = {
  ConstraintBuilderError,
  buildSchedulingContext,
  YEAR_TO_SEMESTER,
};
