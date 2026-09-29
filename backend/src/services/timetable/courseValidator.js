const Course = require('../../models/Course');
const AcademicContext = require('../../models/AcademicContext');

/**
 * Mapping from AcademicContext cohort year to authoritative curriculum semester.
 */
const YEAR_TO_SEMESTER = {
  'I YEAR': 'Semester I',
  'I Year': 'Semester I',
  '1': 'Semester I',
  'II YEAR': 'Semester III',
  'II Year': 'Semester III',
  '2': 'Semester III',
  'III YEAR': 'Semester V',
  'III Year': 'Semester V',
  '3': 'Semester V',
  'IV YEAR': 'Semester VII',
  'IV Year': 'Semester VII',
  '4': 'Semester VII',
};

/**
 * Resolves the authoritative curriculum semester string from an AcademicContext or cohort year string.
 *
 * @param {Object|string} contextOrYear - AcademicContext doc/object or year string ('III Year')
 * @returns {string|null} Resolved semester string (e.g. 'Semester V')
 */
function resolveContextSemester(contextOrYear) {
  if (!contextOrYear) return null;
  const rawYear = typeof contextOrYear === 'string' ? contextOrYear : contextOrYear.year;
  if (!rawYear) return null;
  const normalized = rawYear.trim().toUpperCase();
  return YEAR_TO_SEMESTER[normalized] || null;
}

/**
 * Checks whether a course code represents a standard curriculum course
 * or an institutional non-academic activity.
 *
 * @param {string} courseCode
 * @returns {boolean}
 */
function isCurriculumCourse(courseCode) {
  if (!courseCode) return false;
  const code = courseCode.toUpperCase().trim();
  // Institutional activities
  if (
    code.startsWith('NON-ACAD') ||
    code === 'LIBRARY' ||
    code === 'SPORTS' ||
    code === 'MENTORING' ||
    code === 'SEMINAR' ||
    code === 'STUDY' ||
    code === 'SELF-STUDY'
  ) {
    return false;
  }
  // Legacy non-academic pseudo-codes
  if (
    code === '22CSS01' ||
    code === '22CSS02' ||
    code === '22CSM01' ||
    code === '22CST01' ||
    code === '22CSL04'
  ) {
    return false;
  }
  return true;
}

/**
 * Reusable backend course identity and semester integrity validator.
 * Validates that courseCode -> exact authoritative courseName from Course master,
 * and verifies that the course belongs to the appropriate curriculum semester.
 *
 * @param {string} courseCode - The course code to validate (e.g. '22CSC14')
 * @param {string} [courseName] - The course name to verify against authoritative master
 * @param {Object} [options] - Optional context and options:
 *   - courseDoc: Preloaded Course document
 *   - academicContext: AcademicContext document or object
 *   - expectedSemester: Expected semester string ('Semester V')
 *   - allowedElectives: Array of allowed elective courseCodes if PEC/OEC
 * @returns {Promise<Object>} { isValid, courseCode, courseName, course, reason, code }
 */
async function validateCourseIdentity(courseCode, courseName, options = {}) {
  if (!courseCode) {
    return {
      isValid: false,
      code: 'INVALID_COURSE_CODE',
      reason: 'Course code is required.',
      expectedName: null,
    };
  }

  const normalizedCode = courseCode.toUpperCase().trim();

  // 1. Resolve Course from preloaded doc or MongoDB
  let course = options.courseDoc || null;
  if (!course) {
    course = await Course.findOne({ courseCode: normalizedCode });
  }

  if (!course) {
    return {
      isValid: false,
      code: 'COURSE_NOT_FOUND',
      reason: `Course '${normalizedCode}' is not a recognized R22 curriculum course in Course master.`,
      courseCode: normalizedCode,
      courseName: courseName || null,
      expectedName: null,
      course: null,
    };
  }

  const authoritativeName = course.courseName.trim();

  // 2. Validate courseName exact match if provided
  if (courseName !== undefined && courseName !== null) {
    const trimmedProvided = courseName.trim();
    if (trimmedProvided && trimmedProvided !== authoritativeName) {
      return {
        isValid: false,
        code: 'COURSE_NAME_MISMATCH',
        reason: `Course name mismatch for '${normalizedCode}'. Expected authoritative name '${authoritativeName}', but received '${trimmedProvided}'.`,
        courseCode: normalizedCode,
        courseName: trimmedProvided,
        expectedName: authoritativeName,
        course,
      };
    }
  }

  // 3. Validate Semester Integrity
  let targetSemester = options.expectedSemester || null;
  if (!targetSemester && options.academicContext) {
    targetSemester = resolveContextSemester(options.academicContext);
  }

  if (targetSemester && course.semester && course.semester.startsWith('Semester ')) {
    if (course.semester.toUpperCase() !== targetSemester.toUpperCase()) {
      return {
        isValid: false,
        code: 'COURSE_SEMESTER_MISMATCH',
        reason: `Course '${normalizedCode}' belongs to ${course.semester}, but target cohort requires ${targetSemester}.`,
        courseCode: normalizedCode,
        courseName: authoritativeName,
        expectedName: authoritativeName,
        course,
        expectedSemester: targetSemester,
        actualSemester: course.semester,
      };
    }
  }

  // 4. Validate Elective Course Eligibility
  if (course.category === 'PEC' || course.category === 'OEC') {
    if (Array.isArray(options.allowedElectives) && options.allowedElectives.length > 0) {
      const normalizedAllowed = options.allowedElectives.map((c) => c.toUpperCase().trim());
      if (!normalizedAllowed.includes(normalizedCode)) {
        return {
          isValid: false,
          code: 'UNCONFIGURED_ELECTIVE',
          reason: `Elective course '${normalizedCode}' (${authoritativeName}) is not an approved elective selection for this context.`,
          courseCode: normalizedCode,
          courseName: authoritativeName,
          expectedName: authoritativeName,
          course,
        };
      }
    }
  }

  return {
    isValid: true,
    courseCode: normalizedCode,
    courseName: authoritativeName,
    expectedName: authoritativeName,
    course,
  };
}

/**
 * Validates a TimetableSession record against canonical course identity and semester integrity.
 *
 * @param {Object} session - TimetableSession object
 * @param {Object} context - AcademicContext object
 * @param {Map<string, Object>} [courseCache] - Optional Map of courseCode -> CourseDoc
 * @returns {Promise<Object>} { isValid, errors: Array }
 */
async function validateSessionCourseIntegrity(session, context, courseCache = null) {
  const errors = [];
  const { courseCode, courseName, sessionType } = session;

  // Institutional non-academic activities check
  if (!isCurriculumCourse(courseCode)) {
    // Non-academic activity: must NOT use ordinary curriculum course categories or fake curriculum codes
    if (
      courseCode === '22CSP01' ||
      courseCode === '22CSP04' ||
      courseCode === '22CSL04' ||
      courseCode === '22CSM01' ||
      courseCode === '22CST01'
    ) {
      errors.push({
        code: 'LEGACY_COURSE_MISCLASSIFIED',
        courseCode,
        message: `Legacy or non-academic code '${courseCode}' is improperly placed as a timetable course.`,
      });
    }
    return {
      isValid: errors.length === 0,
      isNonAcademic: true,
      errors,
    };
  }

  let courseDoc = null;
  if (courseCache && courseCache.has(courseCode)) {
    courseDoc = courseCache.get(courseCode);
  }

  const expectedSemester = resolveContextSemester(context);
  const result = await validateCourseIdentity(courseCode, courseName, {
    courseDoc,
    expectedSemester,
  });

  if (!result.isValid) {
    errors.push({
      code: result.code,
      courseCode,
      message: result.reason,
    });
  }

  return {
    isValid: errors.length === 0,
    isNonAcademic: false,
    canonicalName: result.expectedName,
    errors,
  };
}

module.exports = {
  YEAR_TO_SEMESTER,
  resolveContextSemester,
  isCurriculumCourse,
  validateCourseIdentity,
  validateSessionCourseIntegrity,
};
