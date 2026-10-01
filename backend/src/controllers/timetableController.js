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
const { getAcademicContextWorkflowStatus } = require('../services/contextStatusService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ---------------------------------------------------------------------------
// Phase 2 Private Helpers
// ---------------------------------------------------------------------------

/** Canonical context summary shape returned in every endpoint response */
function _contextSummary(ctx) {
  if (!ctx) return null;
  return {
    id: ctx._id,
    academicYear: ctx.academicYear,
    semester: ctx.semester,
    department: ctx.department,
    year: ctx.year,
    section: ctx.section,
    program: ctx.program,
    status: ctx.status,
  };
}

/** Canonical version summary shape returned in every endpoint response */
function _versionSummary(v) {
  if (!v) return null;
  return {
    id: v._id,
    academicContextId: v.academicContextId || null,
    version: v.version,
    versionLabel: v.versionLabel,
    status: v.status,
    academicYear: v.academicYear,
    semester: v.semester,
    department: v.department,
    year: v.year,
    section: v.section,
    generatedBy: v.generatedBy,
    submittedBy: v.submittedBy,
    approvedBy: v.approvedBy,
    totalScheduledPeriods: v.totalScheduledPeriods,
  };
}

/**
 * Finds the latest published TimetableVersion strictly belonging to the given context.
 * Phase 2: prefers academicContextId FK; falls back to 5-field match for legacy docs.
 */
async function _findPublishedVersionForContext(context) {
  // Primary: direct FK lookup (Phase 2 anchored documents)
  let v = await TimetableVersion.findOne({
    academicContextId: context._id,
    status: 'PUBLISHED',
  }).sort({ publishedAt: -1, createdAt: -1 });

  if (!v) {
    // Fallback: 5-field match for pre-Phase-2 documents
    v = await TimetableVersion.findOne({
      academicYear: context.academicYear,
      semester: context.semester,
      department: context.department,
      ...(context.year ? { year: context.year } : {}),
      ...(context.section ? { section: context.section } : {}),
      status: 'PUBLISHED',
    }).sort({ publishedAt: -1, createdAt: -1 });
  }

  return v || null;
}

/**
 * 5-field fallback check: does this version belong to this context?
 * Used only for legacy versions that have no academicContextId set.
 * Returns true if all 5 canonical fields match.
 */
async function _versionBelongsToContext(version, context) {
  if (!version || !context) return false;
  const yearMatch = !context.year || version.year === context.year;
  const sectionMatch = !context.section || version.section === context.section;
  return (
    version.academicYear === context.academicYear &&
    version.semester === context.semester &&
    version.department === context.department &&
    yearMatch &&
    sectionMatch
  );
}

/**
 * Get timetable versions
 * GET /api/timetable/versions
 * Supports: ?academicContextId= (Phase 2 primary filter)
 *           ?department= ?semester= ?academicYear= ?status= (legacy filters)
 */
async function getVersions(req, res, next) {
  try {
    const { department, semester, academicYear, status, academicContextId } = req.query;
    const query = {};

    // Phase 2: prefer academicContextId filter
    if (academicContextId) {
      query.academicContextId = academicContextId;
    } else {
      // Legacy 5-field filters
      if (department) query.department = department.toUpperCase().trim();
      if (semester) query.semester = semester.trim();
      if (academicYear) query.academicYear = academicYear.trim();
    }
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
 * Returns academicContextId in the payload (Phase 2)
 */
async function getVersionById(req, res, next) {
  try {
    const version = await TimetableVersion.findById(req.params.id).populate('academicContextId', 'academicYear semester department year section program status');
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
 *
 * Phase 2: academicContextId is the authoritative anchor.
 * If supplied, context fields are resolved from AcademicContext.
 * If only legacy fields supplied, we look up the context and still anchor.
 */
async function createVersion(req, res, next) {
  try {
    const { academicContextId, academicYear, semester, department, year, section, versionLabel, label } = req.body;

    let context = null;

    if (academicContextId) {
      context = await AcademicContext.findById(academicContextId);
      if (!context) {
        return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
      }
      if (context.status !== 'ACTIVE') {
        return errorResponse(res, `Academic context '${academicContextId}' is not active`, 400, 'INVALID_CONTEXT');
      }
    } else if (academicYear && semester && department) {
      // Legacy path: resolve context from 5 fields
      const ctxQuery = {
        academicYear: academicYear.trim(),
        semester: semester.trim(),
        department: department.toUpperCase().trim(),
      };
      if (year) ctxQuery.year = year.trim();
      if (section) ctxQuery.section = section.trim();
      context = await AcademicContext.findOne(ctxQuery);
      // context may be null here — version creation still proceeds for backward compat
    }

    const resolvedAcademicYear = context ? context.academicYear : (academicYear || '');
    const resolvedSemester = context ? context.semester : (semester || '');
    const resolvedDepartment = context ? context.department : (department ? department.toUpperCase().trim() : '');
    const resolvedYear = context ? context.year : (year || null);
    const resolvedSection = context ? context.section : (section || null);

    if (!resolvedAcademicYear || !resolvedSemester || !resolvedDepartment) {
      return errorResponse(res, 'academicContextId or (academicYear, semester, department) is required', 400, 'BAD_REQUEST');
    }

    const version = await TimetableVersion.create({
      academicContextId: context ? context._id : null,
      academicYear: resolvedAcademicYear,
      semester: resolvedSemester,
      department: resolvedDepartment,
      year: resolvedYear,
      section: resolvedSection,
      versionLabel: versionLabel || label || 'v1.0',
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
    // Service-layer authorization errors carry statusCode + code.
    if (error.statusCode === 403 || error.code === 'STATE_TRANSITION_ERROR') {
      return errorResponse(res, error.message, 403, 'STATE_TRANSITION_ERROR');
    }
    // State machine constraint errors (invalid transition)
    if (error.message && error.message.includes('Invalid status transition')) {
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
 * Get schedule for a class.
 * Public default returns strictly PUBLISHED timetable.
 * Phase 2: When versionId is supplied, validates version belongs to
 * the requested academicContextId. Returns 409 on context mismatch.
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

    // Phase 2: If an explicit versionId was supplied, validate ownership before serving
    if (versionId) {
      const requestedVersion = await TimetableVersion.findById(versionId);
      if (!requestedVersion) {
        return errorResponse(res, 'Timetable version not found', 404, 'NOT_FOUND');
      }
      // Validate: version must belong to this context
      const versionOwnsContext = requestedVersion.academicContextId
        ? requestedVersion.academicContextId.toString() === context._id.toString()
        : await _versionBelongsToContext(requestedVersion, context);
      if (!versionOwnsContext) {
        return errorResponse(
          res,
          `Timetable version '${versionId}' does not belong to academic context '${academicContextId}'.`,
          409,
          'TIMETABLE_VERSION_CONTEXT_MISMATCH'
        );
      }
      // Serve this explicit version (authenticated internal review)
      const sessions = await getClassSchedule(academicContextId, versionId);
      return successResponse(res, {
        academicContextId: context._id,
        academicContext: _contextSummary(context),
        isPublished: requestedVersion.status === 'PUBLISHED',
        timetableVersionId: requestedVersion._id,
        timetableVersion: _versionSummary(requestedVersion),
        sessionCount: sessions.length,
        sessions,
      });
    }

    // Public path: find published version scoped to this exact context
    const publishedVersion = await _findPublishedVersionForContext(context);

    // If no published version and no explicit version requested: return workflow state
    if (!publishedVersion) {
      const workflow = await getAcademicContextWorkflowStatus(context._id);
      return successResponse(res, {
        academicContextId: context._id,
        academicContext: _contextSummary(context),
        isPublished: false,
        state: workflow.state,
        nextAction: workflow.nextAction,
        message: workflow.message || 'No published timetable version found for this class.',
        sessionCount: 0,
        sessions: [],
        workflow,
      });
    }

    const sessions = await getClassSchedule(academicContextId, publishedVersion._id);
    return successResponse(res, {
      academicContextId: context._id,
      academicContext: _contextSummary(context),
      isPublished: true,
      timetableVersionId: publishedVersion._id,
      timetableVersion: _versionSummary(publishedVersion),
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current timetable workflow lifecycle status for an academic context
 * GET /api/timetable/context-status/:academicContextId
 * GET /api/timetable/status/:academicContextId
 */
async function getContextStatus(req, res, next) {
  try {
    const { academicContextId } = req.params;
    const result = await getAcademicContextWorkflowStatus(academicContextId);

    if (!result.success && result.statusCode === 404) {
      return errorResponse(res, result.message, 404, result.code);
    }
    if (!result.success) {
      return errorResponse(res, result.message, result.statusCode || 400, result.code);
    }

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Review Matrix API endpoint with exact context & version isolation
 * Phase 2: validates version-context ownership when both are supplied.
 * Context-scoped fallback when versionId is omitted.
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
      // Phase 2: validate version belongs to the requested context
      if (context) {
        const owns = version.academicContextId
          ? version.academicContextId.toString() === context._id.toString()
          : await _versionBelongsToContext(version, context);
        if (!owns) {
          return errorResponse(
            res,
            `Timetable version '${targetVersionId}' does not belong to academic context '${academicContextId}'.`,
            409,
            'TIMETABLE_VERSION_CONTEXT_MISMATCH'
          );
        }
      }
    } else if (context) {
      // Context-scoped fallback: prefer published, then latest non-published
      version = await _findPublishedVersionForContext(context);

      if (!version) {
        // Try latest non-published version anchored to this context
        version = await TimetableVersion.findOne({
          academicContextId: context._id,
          status: { $in: ['APPROVED', 'PENDING_HOD_APPROVAL', 'GENERATED', 'DRAFT'] },
        }).sort({ updatedAt: -1, createdAt: -1 });

        if (!version) {
          // Legacy 5-field fallback
          version = await TimetableVersion.findOne({
            academicYear: context.academicYear,
            semester: context.semester,
            department: context.department,
            ...(context.year ? { year: context.year } : {}),
            ...(context.section ? { section: context.section } : {}),
            status: { $in: ['APPROVED', 'PENDING_HOD_APPROVAL', 'GENERATED', 'DRAFT'] },
          }).sort({ updatedAt: -1, createdAt: -1 });
        }
      }
    } else {
      // No context supplied: global published-only fallback
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
      academicContext: context ? _contextSummary(context) : null,
      timetableVersionId: version ? version._id : null,
      timetableVersion: version ? _versionSummary(version) : null,
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get published timetable for a class
 * Phase 2: scope to exact context — no more global findOne.
 * GET /api/timetable/published/:academicContextId
 */
async function getPublishedClassTimetable(req, res, next) {
  try {
    const { academicContextId } = req.params;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    // Phase 2: find published version scoped to this exact context
    const publishedVersion = await _findPublishedVersionForContext(context);

    if (!publishedVersion) {
      return successResponse(res, {
        academicContextId,
        academicContext: _contextSummary(context),
        isPublished: false,
        message: 'No published timetable version found for this class.',
        sessions: [],
      });
    }

    const sessions = await getClassSchedule(academicContextId, publishedVersion._id);
    return successResponse(res, {
      academicContextId,
      academicContext: _contextSummary(context),
      versionId: publishedVersion._id,
      timetableVersion: _versionSummary(publishedVersion),
      versionLabel: publishedVersion.versionLabel,
      publishedAt: publishedVersion.publishedAt,
      isPublished: true,
      sessionCount: sessions.length,
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
        academicContextId: context._id,
        status: { $nin: ['PUBLISHED', 'APPROVED'] },
      }).sort({ createdAt: -1 });

      if (!version) {
        // Legacy 5-field fallback
        version = await TimetableVersion.findOne({
          academicYear: context.academicYear,
          semester: context.semester,
          department: context.department,
          year: context.year,
          section: context.section,
          status: { $nin: ['PUBLISHED', 'APPROVED'] },
        }).sort({ createdAt: -1 });
      }

      if (!version) {
        // Auto-create a working draft anchored to the context
        version = await TimetableVersion.create({
          academicContextId: context._id,
          academicYear: context.academicYear,
          semester: context.semester,
          department: context.department,
          year: context.year,
          section: context.section,
          version: 1,
          versionLabel: 'v1.0 (Working Draft)',
          status: 'GENERATED',
          generatedBy: req.user ? req.user.name || req.user.email : 'TC',
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

    const assignments =
      authoritativeAllocation.facultyAssignments && authoritativeAllocation.facultyAssignments.length > 0
        ? authoritativeAllocation.facultyAssignments
        : [
            {
              facultyId: authoritativeAllocation.facultyId || submittedFacultyId,
              facultyName: authoritativeAllocation.facultyName || facultyName || '',
              role: 'PRIMARY',
            },
          ];

    const allowedFacultyIds = assignments.map((a) => a.facultyId).filter(Boolean);
    if (authoritativeAllocation.facultyId && !allowedFacultyIds.includes(authoritativeAllocation.facultyId)) {
      allowedFacultyIds.push(authoritativeAllocation.facultyId);
    }

    if (!allowedFacultyIds.includes(submittedFacultyId)) {
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
    const facultyIdsToCheck = assignments.map((a) => a.facultyId).filter(Boolean);
    if (!facultyIdsToCheck.includes(submittedFacultyId)) {
      facultyIdsToCheck.push(submittedFacultyId);
    }

    for (const fid of facultyIdsToCheck) {
      const facultyConflict = await TimetableSession.findOne({
        timetableVersionId: finalVersionId,
        $or: [{ facultyId: fid }, { 'facultyAssignments.facultyId': fid }],
        day,
        period,
      });

      if (facultyConflict) {
        return errorResponse(
          res,
          `Faculty '${fid}' is already scheduled on ${day} during ${period}.`,
          409,
          'FACULTY_TIME_CONFLICT'
        );
      }
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
      facultyAssignments: assignments,
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
        ELECTIVE_SELECTION_REQUIRED: 409,
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
  getContextStatus,
  getPublishedClassTimetable,
  getReviewMatrix,
  createSession,
  deleteSession,
  solveTimetable,
};
