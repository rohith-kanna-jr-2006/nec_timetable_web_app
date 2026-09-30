const TimetableVersion = require('../models/TimetableVersion');
const TimetableSession = require('../models/TimetableSession');
const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const {
  transitionTimetableStatus,
  solveAndPersistTimetable,
  getFacultySchedule,
  getClassSchedule,
} = require('../services/timetableService');
const { ConstraintBuilderError } = require('../services/timetable/constraintBuilder');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get timetable versions
 * GET /api/timetable/versions
 */
async function getVersions(req, res, next) {
  try {
    const { department, semester, academicYear, status } = req.query;
    const query = {};

    if (department) query.department = department.toUpperCase().trim();
    if (semester) query.semester = semester.trim();
    if (academicYear) query.academicYear = academicYear.trim();
    if (status) query.status = status;

    const versions = await TimetableVersion.find(query).sort({ createdAt: -1 });
    return successResponse(res, versions);
  } catch (error) {
    next(error);
  }
}

/**
 * Get single version by ID
 * GET /api/timetable/version/:id
 */
async function getVersionById(req, res, next) {
  try {
    const version = await TimetableVersion.findById(req.params.id);
    if (!version) {
      return errorResponse(res, 'Timetable version not found', 404, 'NOT_FOUND');
    }
    return successResponse(res, version);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new timetable version
 * POST /api/timetable/version
 */
async function createVersion(req, res, next) {
  try {
    const { academicYear, semester, department, year, section, versionLabel } = req.body;

    const version = await TimetableVersion.create({
      academicYear,
      semester,
      department: department.toUpperCase().trim(),
      year: year || null,
      section: section || null,
      versionLabel: versionLabel || 'v1.0',
      status: 'NO_TIMETABLE',
      generatedBy: req.user ? req.user.name : null,
    });

    return successResponse(res, version, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Transition timetable version status
 * PATCH /api/timetable/version/:id/status
 */
async function transitionVersion(req, res, next) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400, 'BAD_REQUEST');
    }

    const updated = await transitionTimetableStatus(id, status, req.user || {}, { rejectionReason });
    return successResponse(res, updated);
  } catch (error) {
    if (error.message.includes('Only HOD has authority') || error.message.includes('Invalid status transition')) {
      return errorResponse(res, error.message, 403, 'STATE_TRANSITION_ERROR');
    }
    next(error);
  }
}

/**
 * Get schedule for a faculty member
 * GET /api/timetable/faculty/:facultyId
 */
async function getFacultyTimetable(req, res, next) {
  try {
    const { facultyId } = req.params;
    const { versionId } = req.query;

    const sessions = await getFacultySchedule(facultyId, versionId);
    return successResponse(res, { facultyId, sessionCount: sessions.length, sessions });
  } catch (error) {
    next(error);
  }
}

/**
 * Get schedule for a class
 * GET /api/timetable/class/:academicContextId
 */
async function getClassTimetable(req, res, next) {
  try {
    const { academicContextId } = req.params;
    const { versionId } = req.query;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    const sessions = await getClassSchedule(academicContextId, versionId);
    return successResponse(res, {
      academicContextId,
      academicContext: {
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        year: context.year,
        section: context.section,
        program: context.program,
        status: context.status,
      },
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review Matrix API endpoint with exact context & version isolation
 * GET /api/timetable/review-matrix
 * GET /api/timetable/matrix
 */
async function getReviewMatrix(req, res, next) {
  try {
    const { academicContextId, timetableVersionId, versionId } = req.query;
    const targetVersionId = timetableVersionId || versionId;

    let context = null;
    if (academicContextId) {
      context = await AcademicContext.findById(academicContextId);
      if (!context) {
        return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
      }
    }

    let version = null;
    if (targetVersionId) {
      version = await TimetableVersion.findById(targetVersionId);
      if (!version) {
        return errorResponse(res, 'Timetable version not found', 404, 'NOT_FOUND');
      }
    } else if (context) {
      version = await TimetableVersion.findOne({
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        ...(context.year ? { year: context.year } : {}),
        ...(context.section ? { section: context.section } : {}),
        status: 'PUBLISHED',
      }).sort({ publishedAt: -1, createdAt: -1 });

      if (!version) {
        version = await TimetableVersion.findOne({
          academicYear: context.academicYear,
          semester: context.semester,
          department: context.department,
          ...(context.year ? { year: context.year } : {}),
          ...(context.section ? { section: context.section } : {}),
          status: { $in: ['APPROVED', 'PENDING_HOD_APPROVAL', 'GENERATED', 'DRAFT'] },
        }).sort({ updatedAt: -1, createdAt: -1 });
      }
    } else {
      version = await TimetableVersion.findOne({ status: 'PUBLISHED' }).sort({ publishedAt: -1, createdAt: -1 });
    }

    const sessionQuery = {};
    if (context) {
      sessionQuery.academicContextId = context._id;
    }
    if (version) {
      sessionQuery.timetableVersionId = version._id;
    }

    const rawSessions = await TimetableSession.find(sessionQuery)
      .sort({ day: 1, period: 1 })
      .lean();

    // Populate and ensure canonical Course & Faculty metadata
    const sessions = await Promise.all(
      rawSessions.map(async (s) => {
        let canonicalCourseName = s.courseName;
        if (s.courseCode) {
          const crs = await Course.findOne({ courseCode: s.courseCode });
          if (crs) canonicalCourseName = crs.courseName;
        }
        return {
          ...s,
          courseName: canonicalCourseName,
          academicContextId: s.academicContextId ? s.academicContextId.toString() : null,
          timetableVersionId: s.timetableVersionId ? s.timetableVersionId.toString() : null,
        };
      })
    );

    return successResponse(res, {
      academicContextId: context ? context._id : null,
      academicContext: context
        ? {
            id: context._id,
            academicYear: context.academicYear,
            semester: context.semester,
            department: context.department,
            year: context.year,
            section: context.section,
            program: context.program,
            status: context.status,
          }
        : null,
      timetableVersionId: version ? version._id : null,
      timetableVersion: version
        ? {
            id: version._id,
            version: version.version,
            versionLabel: version.versionLabel,
            status: version.status,
            academicYear: version.academicYear,
            semester: version.semester,
            department: version.department,
            year: version.year,
            section: version.section,
          }
        : null,
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get published timetable for a class
 * GET /api/timetable/published/:academicContextId
 */
async function getPublishedClassTimetable(req, res, next) {
  try {
    const { academicContextId } = req.params;

    // Find latest published timetable version
    const publishedVersion = await TimetableVersion.findOne({ status: 'PUBLISHED' }).sort({ publishedAt: -1 });

    if (!publishedVersion) {
      return successResponse(res, {
        academicContextId,
        isPublished: false,
        message: 'No published timetable version found.',
        sessions: [],
      });
    }

    const sessions = await getClassSchedule(academicContextId, publishedVersion._id);
    return successResponse(res, {
      academicContextId,
      versionId: publishedVersion._id,
      versionLabel: publishedVersion.versionLabel,
      publishedAt: publishedVersion.publishedAt,
      isPublished: true,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a scheduled session to timetable
 * POST /api/timetable/session
 */
async function createSession(req, res, next) {
  try {
    const {
      timetableVersionId,
      academicContextId,
      courseCode,
      courseName,
      facultyId,
      facultyName,
      day,
      period,
      room,
      sessionType,
      duration,
    } = req.body;

    // 1. Resolve and validate Academic Context
    let context = null;
    if (academicContextId) {
      context = await AcademicContext.findById(academicContextId);
      if (!context) {
        return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
      }
      if (context.status !== 'ACTIVE') {
        return errorResponse(res, 'Academic context is not active', 400, 'INVALID_CONTEXT');
      }
    }

    // 2. Resolve and validate Timetable Version
    let version = null;
    if (timetableVersionId) {
      version = await TimetableVersion.findById(timetableVersionId);
      if (!version) {
        return errorResponse(res, 'Timetable version not found', 404, 'NOT_FOUND');
      }
      if (!context) {
        context = await AcademicContext.findOne({
          academicYear: version.academicYear,
          semester: version.semester,
          department: version.department,
          ...(version.year ? { year: version.year } : {}),
          ...(version.section ? { section: version.section } : {}),
        });
      }
    }

    if (!context) {
      return errorResponse(res, 'Valid academic context is required for scheduling', 400, 'BAD_REQUEST');
    }

    if (!version) {
      version = await TimetableVersion.findOne({
        academicYear: context.academicYear,
        semester: context.semester,
        department: context.department,
        year: context.year,
        section: context.section,
      }).sort({ createdAt: -1 });

      if (!version) {
        version = await TimetableVersion.create({
          academicYear: context.academicYear,
          semester: context.semester,
          department: context.department,
          year: context.year,
          section: context.section,
          version: 1,
          versionLabel: 'v1.0 (Working Draft)',
          status: 'GENERATED',
          generatedBy: req.user ? req.user.name || req.user.email : 'AC',
        });
      }
    }

    const finalVersionId = version._id;
    const finalContextId = context._id;

    // 3. Resolve and validate Course
    const normalizedCourseCode = courseCode.toUpperCase().trim();
    const course = await Course.findOne({ courseCode: normalizedCourseCode });
    if (!course) {
      return errorResponse(res, `Course '${normalizedCourseCode}' not found`, 404, 'NOT_FOUND');
    }

    // Verify course belongs to selected academic context / semester
    const yearToSemester = {
      'I YEAR': 'Semester I',
      'II YEAR': 'Semester III',
      'III YEAR': 'Semester V',
      'IV YEAR': 'Semester VII',
    };
    const ctxYearUpper = (context.year || '').toUpperCase().trim();
    const expectedSemester = yearToSemester[ctxYearUpper];

    if (expectedSemester && course.semester && course.semester.startsWith('Semester ')) {
      if (course.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
        return errorResponse(
          res,
          `Course '${normalizedCourseCode}' belongs to ${course.semester}, but selected context is ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    }

    // 4. Server-Side HOD Faculty Allocation Resolution & Enforcement (NO WORKLOAD FALLBACK)
    const hodAllocs = await HODFacultyAllocation.find({
      academicContextId: finalContextId,
      courseCode: normalizedCourseCode,
      status: { $ne: 'REJECTED' },
    });

    if (hodAllocs.length === 0) {
      return errorResponse(
        res,
        `This course has no HOD Course → Faculty allocation.`,
        409,
        'HOD_ALLOCATION_REQUIRED'
      );
    }

    if (hodAllocs.length > 1) {
      return errorResponse(
        res,
        `Multiple active HOD allocations found for course '${normalizedCourseCode}'. HOD resolution is required.`,
        409,
        'HOD_ALLOCATION_CONFLICT'
      );
    }

    const authoritativeAllocation = hodAllocs[0];
    const submittedFacultyId = facultyId.trim();

    if (authoritativeAllocation.facultyId !== submittedFacultyId) {
      return errorResponse(
        res,
        `Submitted faculty '${submittedFacultyId}' does not match authoritative HOD allocated faculty '${authoritativeAllocation.facultyId}' for course '${normalizedCourseCode}'.`,
        409,
        'HOD_FACULTY_MISMATCH'
      );
    }

    // 5. Check Class / Cohort Conflict & Exact Duplicate Session
    const classConflict = await TimetableSession.findOne({
      timetableVersionId: finalVersionId,
      academicContextId: finalContextId,
      day,
      period,
    });

    if (classConflict) {
      if (
        classConflict.courseCode === normalizedCourseCode &&
        classConflict.facultyId === submittedFacultyId
      ) {
        return errorResponse(
          res,
          `Exact duplicate session already exists for course '${normalizedCourseCode}' on ${day} ${period}.`,
          409,
          'DUPLICATE_SESSION'
        );
      }
      return errorResponse(
        res,
        `Class already has a session scheduled on ${day} during ${period} (${classConflict.courseCode}).`,
        409,
        'CLASS_TIME_CONFLICT'
      );
    }

    // 6. Check Faculty Slot Conflict (same faculty at same day + period across version)
    const facultyConflict = await TimetableSession.findOne({
      timetableVersionId: finalVersionId,
      facultyId: submittedFacultyId,
      day,
      period,
    });

    if (facultyConflict) {
      return errorResponse(
        res,
        `Faculty '${submittedFacultyId}' is already scheduled on ${day} during ${period}.`,
        409,
        'FACULTY_TIME_CONFLICT'
      );
    }

    // Auto-resolve facultyName and courseName if missing
    let resolvedFacultyName = facultyName || authoritativeAllocation.facultyName;
    if (!resolvedFacultyName) {
      const fac = await Faculty.findOne({ facultyId: submittedFacultyId });
      if (fac) resolvedFacultyName = fac.facultyName;
    }

    const session = await TimetableSession.create({
      timetableVersionId: finalVersionId,
      academicContextId: finalContextId,
      courseCode: normalizedCourseCode,
      courseName: course.courseName || courseName || '',
      facultyId: submittedFacultyId,
      facultyName: resolvedFacultyName || '',
      day,
      period,
      room: room || null,
      sessionType: sessionType || authoritativeAllocation.allocationType || 'THEORY',
      duration: duration || 1,
    });

    // Update session count on version
    await TimetableVersion.findByIdAndUpdate(finalVersionId, {
      $inc: { totalScheduledPeriods: 1 },
    });

    return successResponse(res, session, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a session from timetable
 * DELETE /api/timetable/session/:id
 */
async function deleteSession(req, res, next) {
  try {
    const session = await TimetableSession.findByIdAndDelete(req.params.id);
    if (!session) {
      return errorResponse(res, 'Timetable session not found', 404, 'NOT_FOUND');
    }

    await TimetableVersion.findByIdAndUpdate(session.timetableVersionId, {
      $inc: { totalScheduledPeriods: -1 },
    });

    return successResponse(res, { message: 'Timetable session deleted successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * Solve and generate timetable automatically using CSP engine
 * POST /api/timetable/solve
 */
async function solveTimetable(req, res, next) {
  try {
    const { academicContextId, timetableVersionId, assignmentPlan, generationSeed, options } = req.body || {};

    const result = await solveAndPersistTimetable(
      {
        academicContextId,
        timetableVersionId,
        assignmentPlan,
        generationSeed,
        options,
      },
      req.user || {}
    );

    if (!result.success) {
      return errorResponse(res, result.message || 'Timetable generation failed.', 409, result.code || 'GENERATION_FAILED', {
        metrics: result.metrics,
        diagnostics: result.diagnostics,
      });
    }

    return successResponse(res, result, 201);
  } catch (error) {
    if (error instanceof ConstraintBuilderError || error.name === 'ConstraintBuilderError') {
      const codeToStatus = {
        CONTEXT_NOT_FOUND: 404,
        COURSE_NOT_FOUND: 404,
        FACULTY_NOT_FOUND: 404,
        VERSION_NOT_FOUND: 404,
        INVALID_CONTEXT: 400,
        CONTEXT_INACTIVE: 400,
        INVALID_COHORT_YEAR: 400,
        NO_COURSES_FOUND: 404,
        HOD_ALLOCATION_REQUIRED: 409,
        HOD_ALLOCATION_CONFLICT: 409,
        HOD_FACULTY_MISMATCH: 409,
        COURSE_SEMESTER_MISMATCH: 409,
        VERSION_LOCKED: 409,
        FACULTY_INACTIVE: 409,
      };
      const statusCode = codeToStatus[error.code] || 400;
      return errorResponse(res, error.message, statusCode, error.code, error.details);
    }
    next(error);
  }
}

module.exports = {
  getVersions,
  getVersionById,
  createVersion,
  transitionVersion,
  getFacultyTimetable,
  getClassTimetable,
  getPublishedClassTimetable,
  getReviewMatrix,
  createSession,
  deleteSession,
  solveTimetable,
};
