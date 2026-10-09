const TCAllocationProposal = require('../models/TCAllocationProposal');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');
const AcademicContext = require('../models/AcademicContext');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const { resolveSemesterForContext } = require('../services/timetable/semesterResolver');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const {
  validateAllocationPayload,
  computeAllocationStatus,
} = require('../services/allocationPolicyService');

/**
 * Save or update a TC assignment proposal for a course in an academic context.
 * POST /api/tc-proposals
 * PUT /api/tc-proposals/context/:academicContextId/course/:courseCode
 */
async function saveProposal(req, res, next) {
  try {
    const academicContextId = req.params.academicContextId || req.body.academicContextId;
    const courseCode = req.params.courseCode || req.body.courseCode;
    const payload = req.body || {};

    if (!academicContextId) {
      return errorResponse(res, 'academicContextId is required', 400, 'INVALID_CONTEXT');
    }
    if (!courseCode) {
      return errorResponse(res, 'courseCode is required', 400, 'INVALID_COURSE');
    }

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

    // 3. Verify course semester matches academic context
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

    // 4. Check if an approved HOD allocation already exists and verify TC cannot directly overwrite it
    const existingApprovedHodAlloc = await HODFacultyAllocation.findOne({
      academicContextId: context._id,
      courseCode: normalizedCourseCode,
      status: 'APPROVED',
    });

    // Check existing proposal for this context and course
    const existingProposal = await TCAllocationProposal.findOne({
      academicContextId: context._id,
      courseCode: normalizedCourseCode,
    });

    if (existingProposal && existingProposal.status === 'APPROVED') {
      return errorResponse(
        res,
        `Course '${normalizedCourseCode}' proposal is already approved by HOD. TC cannot directly modify an approved allocation.`,
        409,
        'PROPOSAL_ALREADY_APPROVED'
      );
    }

    // 5. Gather existing allocations to check workload limits (HOD allocations + other proposals)
    const [existingHodAllocations, otherProposals] = await Promise.all([
      HODFacultyAllocation.find({
        academicContextId: context._id,
        status: { $ne: 'REJECTED' },
      }).lean(),
      TCAllocationProposal.find({
        academicContextId: context._id,
        courseCode: { $ne: normalizedCourseCode },
        status: { $in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      }).lean(),
    ]);

    // Merge allocations for workload validation; active proposals override stale allocations
    const allocMap = new Map();
    existingHodAllocations.forEach((a) => allocMap.set(a.courseCode, a));
    otherProposals.forEach((p) => allocMap.set(p.courseCode, p));
    const existingCombined = Array.from(allocMap.values());

    // 6. Validate payload against authoritative allocation policy
    const validation = await validateAllocationPayload({
      academicContext: context,
      course,
      payload,
      existingAllocations: existingCombined,
    });

    if (!validation.isValid) {
      const err = validation.error;
      return errorResponse(res, err.message, 400, err.code, err.details);
    }

    // 7. Determine status: DRAFT by default, or SUBMITTED if requested
    const targetStatus = payload.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';

    const proposalDoc = {
      academicContextId: context._id,
      courseCode: normalizedCourseCode,
      courseName: course.courseName,
      allocationRule: validation.allocationRule,
      facultyAssignments: validation.normalizedAssignments,
      facultyId: validation.primaryFaculty ? validation.primaryFaculty.facultyId : null,
      facultyName: validation.primaryFaculty ? validation.primaryFaculty.facultyName : '',
      allocationType: payload.allocationType || (course.isLab ? 'LAB_PRIMARY' : (course.courseType === 'SAS' ? 'SAS' : 'THEORY')),
      timetableMapping: validation.timetableMapping,
      status: targetStatus,
      proposedBy: req.user ? req.user.name || req.user.email : 'TC',
      remarks: null,
      reviewedBy: null,
      reviewedAt: null,
    };

    const saved = await TCAllocationProposal.findOneAndUpdate(
      {
        academicContextId: context._id,
        courseCode: normalizedCourseCode,
      },
      { $set: proposalDoc },
      { upsert: true, new: true, runValidators: true }
    );

    const allocStatus = computeAllocationStatus(
      validation.policy,
      validation.normalizedAssignments,
      validation.timetableMapping
    );

    return successResponse(
      res,
      {
        ...saved.toObject(),
        allocationStatus: allocStatus,
        policy: validation.policy,
      },
      existingProposal ? 200 : 201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get all TC assignment proposals for an academic context
 * GET /api/tc-proposals/context/:academicContextId
 */
async function getProposalsByContext(req, res, next) {
  try {
    const { academicContextId } = req.params;
    const { status } = req.query;

    const context = await AcademicContext.findById(academicContextId);
    if (!context) {
      return errorResponse(res, `Academic context '${academicContextId}' not found`, 404, 'NOT_FOUND');
    }

    const query = { academicContextId: context._id };
    if (status) {
      query.status = status;
    }

    const proposals = await TCAllocationProposal.find(query)
      .populate('academicContextId')
      .sort({ courseCode: 1 })
      .lean();

    return successResponse(res, proposals);
  } catch (error) {
    next(error);
  }
}

/**
 * Get single TC proposal by ID
 * GET /api/tc-proposals/:id
 */
async function getProposalById(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await TCAllocationProposal.findById(id).populate('academicContextId');
    if (!proposal) {
      return errorResponse(res, `TC proposal '${id}' not found`, 404, 'NOT_FOUND');
    }
    return successResponse(res, proposal);
  } catch (error) {
    next(error);
  }
}

/**
 * Submit TC proposal for HOD review
 * PATCH /api/tc-proposals/:id/submit
 * POST /api/tc-proposals/:id/submit
 */
async function submitProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await TCAllocationProposal.findById(id);

    if (!proposal) {
      return errorResponse(res, `TC proposal '${id}' not found`, 404, 'NOT_FOUND');
    }

    if (proposal.status === 'APPROVED') {
      return errorResponse(res, 'Proposal is already approved by HOD and cannot be resubmitted', 409, 'PROPOSAL_ALREADY_APPROVED');
    }

    // Verify proposal has assigned faculty
    if (!proposal.facultyId && (!proposal.facultyAssignments || proposal.facultyAssignments.length === 0)) {
      return errorResponse(res, 'Cannot submit proposal without assigned faculty', 400, 'PROPOSAL_INCOMPLETE');
    }

    proposal.status = 'SUBMITTED';
    proposal.remarks = null;
    await proposal.save();

    return successResponse(res, proposal);
  } catch (error) {
    next(error);
  }
}

/**
 * HOD Approve TC proposal -> Creates/updates authoritative HODFacultyAllocation
 * PATCH /api/tc-proposals/:id/approve
 * POST /api/tc-proposals/:id/approve
 */
async function approveProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await TCAllocationProposal.findById(id);

    if (!proposal) {
      return errorResponse(res, `TC proposal '${id}' not found`, 404, 'NOT_FOUND');
    }

    if (proposal.status === 'APPROVED') {
      return errorResponse(res, 'Proposal is already approved', 409, 'ALREADY_APPROVED');
    }

    if (proposal.status !== 'SUBMITTED') {
      return errorResponse(
        res,
        `Only SUBMITTED proposals can be approved by HOD (current status: ${proposal.status})`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Update proposal to APPROVED
    proposal.status = 'APPROVED';
    proposal.reviewedBy = req.user ? req.user.name || req.user.email : 'HOD';
    proposal.reviewedAt = new Date();
    await proposal.save();

    // Authoritative persistence: Upsert into HODFacultyAllocation
    const hodAllocDoc = {
      academicContextId: proposal.academicContextId,
      courseCode: proposal.courseCode,
      courseName: proposal.courseName,
      allocationRule: proposal.allocationRule,
      facultyAssignments: proposal.facultyAssignments,
      facultyId: proposal.facultyId,
      facultyName: proposal.facultyName,
      allocationType: proposal.allocationType,
      timetableMapping: proposal.timetableMapping,
      status: 'APPROVED',
      assignedBy: `TC Proposal (Approved by ${req.user ? req.user.name || req.user.email : 'HOD'})`,
      rejectionReason: null,
    };

    const authoritativeAllocation = await HODFacultyAllocation.findOneAndUpdate(
      {
        academicContextId: proposal.academicContextId,
        courseCode: proposal.courseCode,
      },
      { $set: hodAllocDoc },
      { upsert: true, new: true, runValidators: true }
    );

    return successResponse(res, {
      proposal,
      authoritativeAllocation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * HOD Reject TC proposal with remarks
 * PATCH /api/tc-proposals/:id/reject
 * POST /api/tc-proposals/:id/reject
 */
async function rejectProposal(req, res, next) {
  try {
    const { id } = req.params;
    const remarks = req.body.remarks || req.body.rejectionReason;

    if (!remarks || typeof remarks !== 'string' || !remarks.trim()) {
      return errorResponse(res, 'Rejection remarks are required when rejecting a proposal', 400, 'REMARKS_REQUIRED');
    }

    const proposal = await TCAllocationProposal.findById(id);

    if (!proposal) {
      return errorResponse(res, `TC proposal '${id}' not found`, 404, 'NOT_FOUND');
    }

    if (proposal.status !== 'SUBMITTED') {
      return errorResponse(
        res,
        `Only SUBMITTED proposals can be rejected by HOD (current status: ${proposal.status})`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    proposal.status = 'REJECTED';
    proposal.remarks = remarks.trim();
    proposal.reviewedBy = req.user ? req.user.name || req.user.email : 'HOD';
    proposal.reviewedAt = new Date();
    await proposal.save();

    return successResponse(res, proposal);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a draft proposal
 * DELETE /api/tc-proposals/:id
 */
async function deleteProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await TCAllocationProposal.findById(id);

    if (!proposal) {
      return errorResponse(res, `TC proposal '${id}' not found`, 404, 'NOT_FOUND');
    }

    if (proposal.status === 'APPROVED') {
      return errorResponse(res, 'Approved proposals cannot be deleted by TC', 409, 'CANNOT_DELETE_APPROVED_PROPOSAL');
    }

    await TCAllocationProposal.findByIdAndDelete(id);

    return successResponse(res, { message: 'Proposal deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  saveProposal,
  getProposalsByContext,
  getProposalById,
  submitProposal,
  approveProposal,
  rejectProposal,
  deleteProposal,
};
