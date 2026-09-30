const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const TimetableVersion = require('../models/TimetableVersion');
const { resolveSemesterForContext } = require('./timetable/semesterResolver');
const { R22_ELECTIVE_SLOT_MAP } = require('../data/r22CurriculumMaster');

/**
 * Evaluates the full academic and timetable lifecycle workflow state
 * for ANY valid AcademicContext in the CSE department.
 *
 * Distinguishes:
 * STATE 1: CONTEXT_NOT_FOUND (404)
 * STATE 2: CURRICULUM_UNAVAILABLE
 * STATE 3: ALLOCATION_INCOMPLETE
 * STATE 4: READY_FOR_GENERATION
 * STATE 5: TIMETABLE_GENERATED (DRAFT / GENERATED)
 * STATE 6: PENDING_HOD_APPROVAL
 * STATE 7: APPROVED
 * STATE 8: PUBLISHED
 *
 * @param {string|ObjectId} academicContextId
 * @returns {Promise<Object>} Workflow state summary payload
 */
async function getAcademicContextWorkflowStatus(academicContextId) {
  if (!academicContextId) {
    return {
      success: false,
      statusCode: 400,
      code: 'INVALID_CONTEXT',
      message: 'academicContextId is required.',
    };
  }

  // 1. Resolve AcademicContext
  const context = await AcademicContext.findById(academicContextId);
  if (!context) {
    return {
      success: false,
      statusCode: 404,
      code: 'CONTEXT_NOT_FOUND',
      state: 'CONTEXT_NOT_FOUND',
      message: `Academic context '${academicContextId}' not found.`,
    };
  }

  if (context.status !== 'ACTIVE') {
    return {
      success: false,
      statusCode: 400,
      code: 'CONTEXT_INACTIVE',
      state: 'CONTEXT_INACTIVE',
      message: `Academic context '${academicContextId}' is inactive.`,
      academicContext: context,
    };
  }

  // 2. Resolve Curriculum Semester
  const expectedSemester = resolveSemesterForContext(context);
  if (!expectedSemester) {
    return {
      success: false,
      statusCode: 400,
      code: 'INVALID_COHORT_YEAR',
      state: 'INVALID_COHORT_YEAR',
      message: `Unable to map cohort '${context.year}' (${context.semester}) to an official curriculum semester.`,
      academicContext: context,
    };
  }

  // 3. Resolve Curriculum Courses & Elective Slots
  const allSemesterCourses = await Course.find({
    semester: expectedSemester,
    isActive: true,
  }).sort({ courseCode: 1 });

  if (allSemesterCourses.length === 0) {
    return {
      success: true,
      statusCode: 200,
      state: 'CURRICULUM_UNAVAILABLE',
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
      year: context.year,
      semester: expectedSemester,
      section: context.section,
      curriculum: {
        available: false,
        courseCount: 0,
      },
      allocation: {
        complete: false,
        allocatedCount: 0,
        missingCount: 0,
        missing: [],
      },
      timetable: {
        exists: false,
        isPublished: false,
      },
      nextAction: 'LOAD_CURRICULUM',
      message: `Curriculum data is unavailable for ${expectedSemester}.`,
    };
  }

  // Standard core courses for the semester
  const coreCourses = allSemesterCourses.filter(
    (c) =>
      !['PEC', 'OEC'].includes(c.category) &&
      !['PEC', 'OEC', 'Management Elective'].includes(c.electiveType)
  );

  const electiveSlots = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];

  // 4. Resolve Authoritative HOD Faculty Allocations
  const allocations = await HODFacultyAllocation.find({
    academicContextId: context._id,
    status: { $ne: 'REJECTED' },
  });

  const allocByCourse = new Map();
  allocations.forEach((a) => {
    if (!allocByCourse.has(a.courseCode)) {
      allocByCourse.set(a.courseCode, []);
    }
    allocByCourse.get(a.courseCode).push(a);
  });

  const missing = [];
  const validationDetails = [];

  // Validate core courses
  for (const course of coreCourses) {
    const courseAllocs = allocByCourse.get(course.courseCode) || [];
    if (courseAllocs.length === 0) {
      missing.push({
        courseCode: course.courseCode,
        courseName: course.courseName,
        type: 'CORE',
        reason: 'Missing HOD faculty allocation',
      });
      validationDetails.push({
        courseCode: course.courseCode,
        courseName: course.courseName,
        type: 'CORE',
        status: 'UNRESOLVED',
        error: `Missing HOD faculty allocation for ${course.courseCode}`,
      });
    } else if (courseAllocs.length > 1) {
      missing.push({
        courseCode: course.courseCode,
        courseName: course.courseName,
        type: 'CORE',
        reason: 'Multiple allocations found (conflict)',
      });
      validationDetails.push({
        courseCode: course.courseCode,
        courseName: course.courseName,
        type: 'CORE',
        status: 'CONFLICT',
        error: `Multiple allocations found (${courseAllocs.length}) for ${course.courseCode}`,
      });
    } else {
      const alloc = courseAllocs[0];
      const faculty = await Faculty.findOne({ facultyId: alloc.facultyId });
      if (!faculty) {
        missing.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          type: 'CORE',
          reason: `Faculty ID '${alloc.facultyId}' not found`,
        });
        validationDetails.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          type: 'CORE',
          status: 'INVALID_FACULTY',
        });
      } else if (!faculty.isActive) {
        missing.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          type: 'CORE',
          reason: `Faculty '${faculty.facultyName}' is inactive`,
        });
        validationDetails.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          type: 'CORE',
          status: 'INACTIVE_FACULTY',
        });
      } else {
        validationDetails.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          facultyId: faculty.facultyId,
          facultyName: faculty.facultyName,
          type: 'CORE',
          status: 'VALID',
        });
      }
    }
  }

  // Validate elective allocations if elective slots exist
  const allocatedElectives = [];
  allocations.forEach((alloc) => {
    // If not a core course, check if it's an allocated elective
    const isCore = coreCourses.some((c) => c.courseCode === alloc.courseCode);
    if (!isCore) {
      allocatedElectives.push(alloc);
    }
  });

  // Verify elective slot coverage
  if (electiveSlots.length > 0) {
    if (allocatedElectives.length < electiveSlots.length) {
      const missingCount = electiveSlots.length - allocatedElectives.length;
      missing.push({
        type: 'ELECTIVE_SLOT',
        reason: `Cohort requires ${electiveSlots.length} active elective allocation(s), but only ${allocatedElectives.length} allocated (${missingCount} missing).`,
        requiredSlots: electiveSlots.map((s) => s.slot),
        allocatedElectives: allocatedElectives.map((e) => e.courseCode),
      });
    }
  }

  for (const alloc of allocatedElectives) {
    const courseDoc = await Course.findOne({ courseCode: alloc.courseCode });
    const faculty = await Faculty.findOne({ facultyId: alloc.facultyId });
    if (courseDoc && faculty && faculty.isActive) {
      validationDetails.push({
        courseCode: alloc.courseCode,
        courseName: courseDoc.courseName,
        facultyId: faculty.facultyId,
        facultyName: faculty.facultyName,
        type: 'ELECTIVE',
        status: 'VALID',
      });
    } else if (!faculty || !faculty.isActive) {
      missing.push({
        courseCode: alloc.courseCode,
        type: 'ELECTIVE',
        reason: `Elective faculty '${alloc.facultyId}' invalid or inactive`,
      });
    }
  }

  const isAllocationComplete = missing.length === 0;

  // 5. Query Timetable Versions for this Academic Context
  const versions = await TimetableVersion.find({
    academicYear: context.academicYear,
    semester: context.semester,
    department: context.department,
    year: context.year,
    section: context.section,
  }).sort({ createdAt: -1 });

  const publishedVersion = versions.find((v) => v.status === 'PUBLISHED') || null;
  const latestVersion = versions[0] || null;

  // 6. Determine Concrete Workflow State & Next Action
  let state;
  let nextAction;
  let message;

  if (!isAllocationComplete) {
    state = 'ALLOCATION_INCOMPLETE';
    nextAction = 'ALLOCATE_FACULTY';
    message = `HOD faculty allocation incomplete (${missing.length} item(s) pending).`;
  } else if (!latestVersion || latestVersion.status === 'NO_TIMETABLE') {
    state = 'READY_FOR_GENERATION';
    nextAction = 'GENERATE_TIMETABLE';
    message = 'Academic context is ready for timetable generation.';
  } else if (publishedVersion) {
    state = 'PUBLISHED';
    nextAction = 'VIEW_PUBLISHED';
    message = `Published timetable version '${publishedVersion.versionLabel}' active.`;
  } else if (latestVersion.status === 'APPROVED') {
    state = 'APPROVED';
    nextAction = 'PUBLISH_TIMETABLE';
    message = `Timetable version '${latestVersion.versionLabel}' approved by HOD, ready for publishing.`;
  } else if (latestVersion.status === 'PENDING_HOD_APPROVAL') {
    state = 'PENDING_HOD_APPROVAL';
    nextAction = 'HOD_APPROVAL';
    message = `Timetable version '${latestVersion.versionLabel}' submitted, awaiting HOD approval.`;
  } else if (['GENERATED', 'DRAFT'].includes(latestVersion.status)) {
    state = 'TIMETABLE_GENERATED';
    nextAction = 'SUBMIT_FOR_APPROVAL';
    message = `Timetable version '${latestVersion.versionLabel}' generated, ready for coordinator review and submission.`;
  } else if (latestVersion.status === 'REJECTED') {
    state = 'READY_FOR_GENERATION';
    nextAction = 'GENERATE_TIMETABLE';
    message = `Timetable version '${latestVersion.versionLabel}' was rejected (${latestVersion.rejectionReason || 'Requires revision'}). Ready for re-generation.`;
  } else {
    state = 'READY_FOR_GENERATION';
    nextAction = 'GENERATE_TIMETABLE';
    message = 'Academic context is ready for timetable generation.';
  }

  return {
    success: true,
    statusCode: 200,
    state,
    nextAction,
    message,
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
    year: context.year,
    semester: expectedSemester,
    section: context.section,
    curriculum: {
      available: true,
      courseCount: allSemesterCourses.length,
      coreCount: coreCourses.length,
      electiveSlotsCount: electiveSlots.length,
      electiveSlots,
    },
    electiveSelection: {
      requiredSlotsCount: electiveSlots.length,
      allocatedElectivesCount: allocatedElectives.length,
      allocatedElectives: allocatedElectives.map((e) => ({
        courseCode: e.courseCode,
        facultyId: e.facultyId,
      })),
      isElectiveComplete: allocatedElectives.length >= electiveSlots.length,
    },
    allocation: {
      complete: isAllocationComplete,
      requiredCount: coreCourses.length + electiveSlots.length,
      allocatedCount: validationDetails.filter((d) => d.status === 'VALID').length,
      missingCount: missing.length,
      missing,
      details: validationDetails,
    },
    timetable: {
      exists: !!latestVersion,
      latestVersionId: latestVersion ? latestVersion._id : null,
      latestVersionLabel: latestVersion ? latestVersion.versionLabel : null,
      latestStatus: latestVersion ? latestVersion.status : null,
      isPublished: !!publishedVersion,
      publishedVersionId: publishedVersion ? publishedVersion._id : null,
      publishedVersionLabel: publishedVersion ? publishedVersion.versionLabel : null,
    },
  };
}

module.exports = {
  getAcademicContextWorkflowStatus,
};
