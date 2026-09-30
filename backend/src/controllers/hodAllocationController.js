const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const { updateAllocationStatus } = require('../services/allocationService');
const { resolveSemesterForContext } = require('../services/timetable/semesterResolver');
const { R22_ELECTIVE_SLOT_MAP } = require('../data/r22CurriculumMaster');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const {
  ALLOCATION_RULES,
  normalizeDepartment,
  getCourseAllocationPolicy,
  computeAllocationStatus,
  validateAllocationPayload,
} = require('../services/allocationPolicyService');

/**
 * Get HOD faculty allocations
 * GET /api/hod-allocations
 */
async function getAllocations(req, res, next) {
  try {
    const { academicContextId, facultyId, courseCode, status } = req.query;
    const query = {};

    if (academicContextId) query.academicContextId = academicContextId;
    if (facultyId) query.facultyId = facultyId;
    if (courseCode) query.courseCode = courseCode.toUpperCase().trim();
    if (status) query.status = status;

    const allocations = await HODFacultyAllocation.find(query)
      .populate('academicContextId')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = allocations.map((a) => {
      const ctx = a.academicContextId;
      const ctxIdStr = ctx && ctx._id ? ctx._id.toString() : (a.academicContextId ? a.academicContextId.toString() : null);
      return {
        ...a,
        academicContext: ctx,
        academicContextId: ctxIdStr || a.academicContextId,
      };
    });

    return successResponse(res, formatted);
  } catch (error) {
    next(error);
  }
}

/**
 * Get rich allocation context and policy metadata for frontend rendering
 * GET /api/hod/faculty-allocation/context/:academicContextId
 * GET /api/hod-allocations/context/:academicContextId
 */
async function getAllocationContext(req, res, next) {
  try {
    const { academicContextId } = req.params;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
    }

    const expectedSemester = resolveSemesterForContext(context);
    if (!expectedSemester) {
      return errorResponse(
        res,
        `Cannot map cohort '${context.year}' (${context.semester}) to an authoritative curriculum semester`,
        400,
        'INVALID_COHORT_YEAR'
      );
    }

    // 1. Fetch curriculum courses for this semester (excluding non-allocated electives)
    const curriculumCourses = await Course.find({
      semester: expectedSemester,
      isActive: true,
      category: { $nin: ['PEC', 'OEC'] },
    }).sort({ courseCode: 1 });

    // 2. Fetch all existing allocations for this cohort
    const existingAllocations = await HODFacultyAllocation.find({
      academicContextId: context._id,
      status: { $ne: 'REJECTED' },
    });

    // Also include any active allocated electives for this cohort
    const coreCodes = new Set(curriculumCourses.map((c) => c.courseCode));
    const allocatedElectiveCodes = existingAllocations
      .map((a) => a.courseCode)
      .filter((code) => !coreCodes.has(code));

    let allCohortCourses = [...curriculumCourses];
    if (allocatedElectiveCodes.length > 0) {
      const electiveCourses = await Course.find({
        courseCode: { $in: allocatedElectiveCodes },
        isActive: true,
      });
      allCohortCourses = [...curriculumCourses, ...electiveCourses];
    }

    // 3. Load all active faculties for lookup
    const allFaculty = await Faculty.find({ isActive: true }).sort({ facultyName: 1 });
    const facultyMap = new Map(allFaculty.map((f) => [f.facultyId, f]));

    // Map existing allocations by courseCode
    const allocByCourse = new Map();
    existingAllocations.forEach((a) => {
      allocByCourse.set(a.courseCode, a);
    });

    // 4. Construct rich course contract
    const formattedCourses = allCohortCourses.map((crs) => {
      const policy = getCourseAllocationPolicy(crs, allCohortCourses);
      const existingAlloc = allocByCourse.get(crs.courseCode);

      // Check linked theory allocation
      let linkedTheoryAllocation = null;
      if (policy.linkedTheoryCourseCode) {
        linkedTheoryAllocation = allocByCourse.get(policy.linkedTheoryCourseCode);
      }

      // Build populated facultySlots
      const facultySlots = (policy.slots || []).map((slot) => {
        let assignedFacultyDoc = null;
        let source = slot.source;

        if (existingAlloc) {
          const matchingAssignment = (existingAlloc.facultyAssignments || []).find((fa) => fa.role === slot.role);
          if (matchingAssignment) {
            const fDoc = facultyMap.get(matchingAssignment.facultyId);
            assignedFacultyDoc = fDoc
              ? { facultyId: fDoc.facultyId, facultyName: fDoc.facultyName, designation: fDoc.designation, department: fDoc.department }
              : { facultyId: matchingAssignment.facultyId, facultyName: matchingAssignment.facultyName };
            source = matchingAssignment.source || slot.source;
          } else if (slot.role === 'PRIMARY' && existingAlloc.facultyId) {
            const fDoc = facultyMap.get(existingAlloc.facultyId);
            assignedFacultyDoc = fDoc
              ? { facultyId: fDoc.facultyId, facultyName: fDoc.facultyName, designation: fDoc.designation, department: fDoc.department }
              : { facultyId: existingAlloc.facultyId, facultyName: existingAlloc.facultyName };
          }
        }

        // Auto-link primary to theory faculty if linked theory course is allocated
        if (!assignedFacultyDoc && slot.role === 'PRIMARY' && linkedTheoryAllocation && linkedTheoryAllocation.facultyId) {
          const tDoc = facultyMap.get(linkedTheoryAllocation.facultyId);
          assignedFacultyDoc = tDoc
            ? { facultyId: tDoc.facultyId, facultyName: tDoc.facultyName, designation: tDoc.designation, department: tDoc.department }
            : { facultyId: linkedTheoryAllocation.facultyId, facultyName: linkedTheoryAllocation.facultyName };
          source = 'THEORY_LINKED';
        }

        let slotEligibleFaculty = null;
        if (slot.eligibleDepartment) {
          const normSlotDept = normalizeDepartment(slot.eligibleDepartment);
          slotEligibleFaculty = allFaculty
            .filter((f) => normalizeDepartment(f.department) === normSlotDept)
            .map((f) => ({
              facultyId: f.facultyId,
              facultyName: f.facultyName,
              designation: f.designation,
              department: f.department,
            }));
        }

        return {
          role: slot.role,
          required: slot.required,
          source,
          description: slot.description,
          eligibleDepartment: slot.eligibleDepartment || null,
          eligibleFaculty: slotEligibleFaculty,
          faculty: assignedFacultyDoc,
        };
      });


      const currentFacultyAssignments = existingAlloc?.facultyAssignments || [];
      const allocationStatus = computeAllocationStatus(policy, existingAlloc, linkedTheoryAllocation);

      let eligibleFacultyList = allFaculty;
      if (policy.rule === ALLOCATION_RULES.MC_DEPARTMENT) {
        const targetDept = normalizeDepartment(context.department);
        eligibleFacultyList = allFaculty.filter((f) => normalizeDepartment(f.department) === targetDept);
      }
      const eligibleFaculty = eligibleFacultyList.map((f) => ({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        designation: f.designation,
        department: f.department,
      }));

      return {
        courseCode: crs.courseCode,
        courseTitle: crs.courseName,
        sessionType: crs.isLab ? 'LAB' : crs.courseType,
        category: crs.category,
        credits: crs.credits,
        contactPeriod: crs.contactPeriod,
        totalPeriod: crs.totalPeriod,
        allocationRule: policy.rule,
        constraints: policy.constraints,
        linkedTheoryCourseCode: policy.linkedTheoryCourseCode,
        facultySlots,
        currentFacultyAssignments,
        allocationStatus,
        timetableMapping: existingAlloc?.timetableMapping || policy.timetableMapping,
        eligibleFaculty,
      };
    });

    return successResponse(res, {
      academicContext: context,
      courses: formattedCourses,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save or update allocation for a specific course in an academic context
 * PUT /api/hod/faculty-allocation/context/:academicContextId/course/:courseCode
 * PUT /api/hod-allocations/context/:academicContextId/course/:courseCode
 */
async function saveCourseAllocation(req, res, next) {
  try {
    const { academicContextId, courseCode } = req.params;
    const payload = req.body || {};

    const normalizedCourseCode = courseCode.toUpperCase().trim();

    // 1. Verify academic context exists and is active
    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
    }
    if (context.status !== 'ACTIVE') {
      return errorResponse(res, `Academic context '${academicContextId}' is not active`, 400, 'CONTEXT_INACTIVE');
    }

    // 2. Verify course exists
    const course = await Course.findOne({ courseCode: normalizedCourseCode });
    if (!course) {
      return errorResponse(res, `Course '${normalizedCourseCode}' not found in Course Master`, 404, 'COURSE_NOT_FOUND');
    }

    // Verify course semester matches academic context
    const expectedSemester = resolveSemesterForContext(context);
    if (expectedSemester && course.semester && course.semester.startsWith('Semester ')) {
      if (course.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
        return errorResponse(
          res,
          `Course '${normalizedCourseCode}' belongs to ${course.semester}, but target cohort is ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    }

    // 3. Load all existing allocations in this context for theory link check
    const existingAllocations = await HODFacultyAllocation.find({
      academicContextId: context._id,
      status: { $ne: 'REJECTED' },
    });

    // 4. Validate payload against policy
    const validation = await validateAllocationPayload({
      academicContext: context,
      course,
      payload,
      existingAllocations,
    });

    if (!validation.isValid) {
      const err = validation.error;
      return errorResponse(res, err.message, 400, err.code, err.details);
    }

    // 5. Upsert allocation
    const initialStatus = payload.status || (req.user && ['HOD', 'ADMIN'].includes(req.user.role) ? 'APPROVED' : 'DRAFT');

    const updateDoc = {
      academicContextId: context._id,
      courseCode: normalizedCourseCode,
      courseName: course.courseName,
      allocationRule: validation.allocationRule,
      facultyAssignments: validation.normalizedAssignments,
      facultyId: validation.primaryFaculty ? validation.primaryFaculty.facultyId : null,
      facultyName: validation.primaryFaculty ? validation.primaryFaculty.facultyName : '',
      allocationType: course.isLab ? 'LAB_PRIMARY' : (course.courseType === 'SAS' ? 'SAS' : 'THEORY'),
      timetableMapping: validation.timetableMapping,
      status: initialStatus,
      assignedBy: req.user ? req.user.name || req.user.email : 'HOD',
      rejectionReason: null,
    };

    const savedAllocation = await HODFacultyAllocation.findOneAndUpdate(
      {
        academicContextId: context._id,
        courseCode: normalizedCourseCode,
      },
      { $set: updateDoc },
      { upsert: true, new: true, runValidators: true }
    );

    const allocStatus = computeAllocationStatus(
      validation.policy,
      validation.normalizedAssignments,
      validation.timetableMapping
    );

    const responseData = {
      ...savedAllocation.toObject(),
      allocationStatus: allocStatus,
      policy: validation.policy,
    };

    return successResponse(res, responseData, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Validate all course allocations for an academic cohort/context
 * GET /api/hod-allocations/validate/:academicContextId
 */
async function validateCohortAllocations(req, res, next) {
  try {
    const { academicContextId } = req.params;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    const expectedSemester = resolveSemesterForContext(context);
    if (!expectedSemester) {
      return errorResponse(res, `Cannot map cohort '${context.year}' (${context.semester}) to an official curriculum semester`, 400, 'INVALID_COHORT_YEAR');
    }

    // Find curriculum courses for this cohort
    const curriculumCourses = await Course.find({
      semester: expectedSemester,
      isActive: true,
      category: { $nin: ['PEC', 'OEC'] },
    }).sort({ courseCode: 1 });

    const allocations = await HODFacultyAllocation.find({
      academicContextId: context._id,
      status: { $ne: 'REJECTED' },
    });

    const allocByCourse = new Map();
    for (const alloc of allocations) {
      if (!allocByCourse.has(alloc.courseCode)) {
        allocByCourse.set(alloc.courseCode, []);
      }
      allocByCourse.get(alloc.courseCode).push(alloc);
    }

    const validationResults = [];
    let allValid = true;

    for (const course of curriculumCourses) {
      const courseAllocs = allocByCourse.get(course.courseCode) || [];
      const policy = getCourseAllocationPolicy(course, curriculumCourses);

      // Induction program: optional mapping
      if (policy.rule === ALLOCATION_RULES.MC_OPTIONAL_MAPPING) {
        const alloc = courseAllocs[0];
        const status = computeAllocationStatus(policy, alloc);
        validationResults.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          allocationRule: policy.rule,
          status: 'VALID',
          allocationStatus: status,
        });
        continue;
      }

      if (courseAllocs.length === 0) {
        allValid = false;
        validationResults.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          allocationRule: policy.rule,
          status: 'UNRESOLVED',
          error: `Missing HOD faculty allocation for course ${course.courseCode}`,
        });
      } else if (courseAllocs.length > 1) {
        allValid = false;
        validationResults.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          allocationRule: policy.rule,
          status: 'CONFLICT',
          error: `Multiple allocations found (${courseAllocs.length}) for course ${course.courseCode}`,
          allocations: courseAllocs,
        });
      } else {
        const alloc = courseAllocs[0];
        const status = computeAllocationStatus(policy, alloc);

        // Check if allocation is complete according to policy
        if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3 && !['COMPLETE_2', 'COMPLETE_3'].includes(status)) {
          allValid = false;
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            allocationRule: policy.rule,
            status: 'INCOMPLETE_ALLOCATION',
            allocationStatus: status,
            error: `LAB course '${course.courseCode}' requires at least 2 faculty members (current status: ${status})`,
          });
          continue;
        }

        if (policy.rule === ALLOCATION_RULES.MC_SAS && status !== 'COMPLETE') {
          allValid = false;
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            allocationRule: policy.rule,
            status: 'INCOMPLETE_ALLOCATION',
            allocationStatus: status,
            error: `SAS course '${course.courseCode}' requires both MATHS_BME and ENGLISH instructors (current status: ${status})`,
          });
          continue;
        }

        // Verify active status of assigned faculties
        const facultyListToCheck = alloc.facultyAssignments && alloc.facultyAssignments.length > 0
          ? alloc.facultyAssignments.map((a) => a.facultyId)
          : [alloc.facultyId].filter(Boolean);

        let facultyError = null;
        for (const fid of facultyListToCheck) {
          const facDoc = await Faculty.findOne({ facultyId: fid });
          if (!facDoc) {
            facultyError = { status: 'INVALID_FACULTY', error: `Allocated faculty ID '${fid}' not found` };
            break;
          }
          if (!facDoc.isActive) {
            facultyError = { status: 'INACTIVE_FACULTY', error: `Allocated faculty '${facDoc.facultyName}' is inactive` };
            break;
          }
        }

        if (facultyError) {
          allValid = false;
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            allocationRule: policy.rule,
            status: facultyError.status,
            error: facultyError.error,
          });
        } else {
          validationResults.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            allocationRule: policy.rule,
            facultyId: alloc.facultyId,
            facultyName: alloc.facultyName,
            facultyAssignments: alloc.facultyAssignments,
            status: 'VALID',
            allocationStatus: status,
          });
        }
      }
    }

    return successResponse(res, {
      academicContextId: context._id,
      cohort: `${context.year} Sec ${context.section} (${expectedSemester})`,
      readyForGeneration: allValid,
      totalRequiredCourses: curriculumCourses.length,
      allocatedCount: validationResults.filter((r) => r.status === 'VALID').length,
      details: validationResults,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create an allocation (draft or submitted)
 * POST /api/hod-allocations
 */
async function createAllocation(req, res, next) {
  try {
    const { academicContextId, courseCode, courseName, facultyId, facultyName, allocationType, facultyAssignments, status } = req.body;

    const normalizedCourseCode = courseCode.toUpperCase().trim();

    // 1. Verify academic context exists and is active
    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
    }
    if (context.status !== 'ACTIVE') {
      return errorResponse(res, `Academic context '${academicContextId}' is not active`, 400, 'CONTEXT_INACTIVE');
    }

    // 2. Verify course exists
    const crs = await Course.findOne({ courseCode: normalizedCourseCode });
    if (!crs) {
      return errorResponse(res, `Course '${normalizedCourseCode}' not found in Course Master`, 404, 'COURSE_NOT_FOUND');
    }

    // Verify course semester matches academic context cohort
    const expectedSemester = resolveSemesterForContext(context);

    if (expectedSemester && crs.semester && crs.semester.startsWith('Semester ')) {
      if (crs.semester.toUpperCase() !== expectedSemester.toUpperCase()) {
        return errorResponse(
          res,
          `Course '${normalizedCourseCode}' belongs to ${crs.semester}, but target cohort is ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    } else if (
      expectedSemester &&
      (['PEC', 'OEC', 'Management Elective'].includes(crs.electiveType) ||
        ['PEC', 'OEC'].includes(crs.category))
    ) {
      const slotsForSem = R22_ELECTIVE_SLOT_MAP[expectedSemester] || [];
      const allowsPEC = slotsForSem.some((s) => s.allowedType.includes('PEC'));
      const allowsOEC = slotsForSem.some((s) => s.allowedType.includes('OEC'));
      const allowsMgmt = slotsForSem.some((s) => s.allowedType.includes('Management'));

      const isPEC = crs.electiveType === 'PEC' || crs.category === 'PEC';
      const isOEC = crs.electiveType === 'OEC' || crs.category === 'OEC';
      const isMgmt = crs.electiveType === 'Management Elective';

      if ((isPEC && !allowsPEC) || (isOEC && !allowsOEC) || (isMgmt && !allowsMgmt)) {
        return errorResponse(
          res,
          `Elective '${normalizedCourseCode}' (${crs.electiveType || crs.category}) is not permitted for ${context.year} (${expectedSemester}).`,
          409,
          'COURSE_SEMESTER_MISMATCH'
        );
      }
    }

    // 3. Check policy & validate payload
    const policy = getCourseAllocationPolicy(crs);
    const existingAllocs = await HODFacultyAllocation.find({
      academicContextId: context._id,
      status: { $ne: 'REJECTED' },
    });

    const hasAssignmentsPayload = Array.isArray(facultyAssignments) && facultyAssignments.length > 0;

    // Check if an active authoritative allocation already exists for this context + course
    const existing = existingAllocs.find((a) => a.courseCode === normalizedCourseCode);
    if (existing) {
      return errorResponse(
        res,
        `An active HOD allocation already exists for course '${normalizedCourseCode}' in this academic context. HOD resolution is required.`,
        409,
        'HOD_ALLOCATION_CONFLICT'
      );
    }

    let validationResult;
    if (hasAssignmentsPayload || policy.rule === ALLOCATION_RULES.LAB_2_TO_3 || policy.rule === ALLOCATION_RULES.MC_SAS) {
      validationResult = await validateAllocationPayload({
        academicContext: context,
        course: crs,
        payload: req.body,
        existingAllocations: existingAllocs,
      });

      if (!validationResult.isValid) {
        const err = validationResult.error;
        return errorResponse(res, err.message, 400, err.code, err.details);
      }
    } else {
      // Single faculty Theory validation
      if (!facultyId || typeof facultyId !== 'string' || !facultyId.trim()) {
        return errorResponse(res, 'Faculty ID is required', 400, 'BAD_REQUEST');
      }

      const fac = await Faculty.findOne({ facultyId: facultyId.trim() });
      if (!fac) {
        return errorResponse(res, `Faculty '${facultyId}' not found in Faculty database`, 404, 'FACULTY_NOT_FOUND');
      }
      if (fac.isActive === false) {
        return errorResponse(res, `Faculty '${fac.facultyName}' (${facultyId}) is marked inactive`, 409, 'FACULTY_INACTIVE');
      }

      validationResult = {
        allocationRule: ALLOCATION_RULES.THEORY_SINGLE,
        normalizedAssignments: [
          {
            facultyId: fac.facultyId,
            facultyName: fac.facultyName,
            role: 'THEORY',
            required: true,
            source: 'MANUAL',
          },
        ],
        primaryFaculty: { facultyId: fac.facultyId, facultyName: fac.facultyName },
        timetableMapping: { allowed: true, required: true, enabled: true },
      };
    }

    // Default status is APPROVED if created by HOD/ADMIN, else DRAFT
    const initialStatus = status || (req.user && ['HOD', 'ADMIN'].includes(req.user.role) ? 'APPROVED' : 'DRAFT');

    if (initialStatus === 'APPROVED' && (!req.user || !['HOD', 'ADMIN'].includes(req.user.role))) {
      return errorResponse(
        res,
        'Only HOD has the authority to create approved faculty allocations.',
        403,
        'FORBIDDEN'
      );
    }

    const allocation = await HODFacultyAllocation.create({
      academicContextId,
      courseCode: normalizedCourseCode,
      courseName: crs.courseName,
      allocationRule: validationResult.allocationRule,
      facultyId: validationResult.primaryFaculty ? validationResult.primaryFaculty.facultyId : null,
      facultyName: validationResult.primaryFaculty ? validationResult.primaryFaculty.facultyName : '',
      allocationType: allocationType || (crs.isLab ? 'LAB_PRIMARY' : 'THEORY'),
      facultyAssignments: validationResult.normalizedAssignments,
      timetableMapping: validationResult.timetableMapping,
      assignedBy: req.user ? req.user.name || req.user.email : 'HOD',
      status: initialStatus,
    });

    return successResponse(res, allocation, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update allocation status (Approve, Reject, Submit)
 * PATCH /api/hod-allocations/:id/status
 */
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return errorResponse(res, 'Target status is required', 400, 'BAD_REQUEST');
    }

    const userRole = req.user ? req.user.role : 'GUEST';

    const updated = await updateAllocationStatus(id, status, userRole, rejectionReason);
    return successResponse(res, updated);
  } catch (error) {
    if (error.message.includes('Only HOD has the authority')) {
      return errorResponse(res, error.message, 403, 'FORBIDDEN');
    }
    next(error);
  }
}

/**
 * Update an allocation (e.g. reassign faculty)
 * PUT /api/hod-allocations/:id
 */
async function updateAllocation(req, res, next) {
  try {
    const { id } = req.params;
    const { facultyId, facultyName, allocationType, facultyAssignments, status, timetableMapping } = req.body;

    const existingAlloc = await HODFacultyAllocation.findById(id);
    if (!existingAlloc) {
      return errorResponse(res, 'Allocation not found', 404, 'NOT_FOUND');
    }

    const course = await Course.findOne({ courseCode: existingAlloc.courseCode });
    const context = await AcademicContext.findById(existingAlloc.academicContextId);

    const updateData = {};

    if (Array.isArray(facultyAssignments) && facultyAssignments.length > 0 && course && context) {
      const otherAllocs = await HODFacultyAllocation.find({
        academicContextId: context._id,
        _id: { $ne: existingAlloc._id },
        status: { $ne: 'REJECTED' },
      });

      const validation = await validateAllocationPayload({
        academicContext: context,
        course,
        payload: req.body,
        existingAllocations: otherAllocs,
      });

      if (!validation.isValid) {
        const err = validation.error;
        return errorResponse(res, err.message, 400, err.code, err.details);
      }

      updateData.facultyAssignments = validation.normalizedAssignments;
      updateData.allocationRule = validation.allocationRule;
      if (validation.primaryFaculty) {
        updateData.facultyId = validation.primaryFaculty.facultyId;
        updateData.facultyName = validation.primaryFaculty.facultyName;
      }
      if (validation.timetableMapping) {
        updateData.timetableMapping = validation.timetableMapping;
      }
    } else {
      let resolvedFacultyName = facultyName;
      if (facultyId && !resolvedFacultyName) {
        const fac = await Faculty.findOne({ facultyId });
        if (fac) resolvedFacultyName = fac.facultyName;
      }

      if (facultyId) {
        updateData.facultyId = facultyId;
        updateData.facultyAssignments = [
          {
            facultyId,
            facultyName: resolvedFacultyName || facultyId,
            role: allocationType === 'LAB_PRIMARY' ? 'PRIMARY' : 'THEORY',
            required: true,
            source: 'MANUAL',
          },
        ];
      }
      if (resolvedFacultyName) updateData.facultyName = resolvedFacultyName;
      if (allocationType) updateData.allocationType = allocationType;
      if (timetableMapping) updateData.timetableMapping = timetableMapping;
    }

    if (status) updateData.status = status;
    updateData.assignedBy = req.user ? req.user.name || req.user.email : 'HOD';

    const updated = await HODFacultyAllocation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return successResponse(res, updated);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an allocation
 * DELETE /api/hod-allocations/:id
 */
async function deleteAllocation(req, res, next) {
  try {
    const allocation = await HODFacultyAllocation.findByIdAndDelete(req.params.id);
    if (!allocation) {
      return errorResponse(res, 'Allocation not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: 'Allocation deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllocations,
  getAllocationContext,
  saveCourseAllocation,
  validateCohortAllocations,
  createAllocation,
  updateAllocation,
  updateStatus,
  deleteAllocation,
};


