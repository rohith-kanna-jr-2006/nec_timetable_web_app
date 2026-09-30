/**
 * Allocation Policy Service
 *
 * Implements authoritative, data-driven course-to-faculty allocation policies:
 * - THEORY_SINGLE: Standard single-faculty theory courses
 * - LAB_2_TO_3: Multi-faculty lab with PRIMARY (Theory-linked), ADDITIONAL, and optional OPTIONAL
 * - MC_SAS: Soft/Analytical Skills requiring MATHS_BME and ENGLISH
 * - MC_DEPARTMENT: Indian Constitution / Department-specific MC requiring context department faculty
 * - MC_OPTIONAL_MAPPING: Induction Programme where faculty and timetable mapping are optional
 */

const Faculty = require('../models/Faculty');

const ALLOCATION_RULES = {
  THEORY_SINGLE: 'THEORY_SINGLE',
  LAB_2_TO_3: 'LAB_2_TO_3',
  MC_SAS: 'MC_SAS',
  MC_DEPARTMENT: 'MC_DEPARTMENT',
  MC_OPTIONAL_MAPPING: 'MC_OPTIONAL_MAPPING',
};

// Canonical mapping of Laboratory to linked Theory courses in R22 curriculum
const THEORY_LAB_LINKS = {
  // Semester I
  '22CSP01': '22CSC01',
  '22ECP01': '22ECC01',
  '22PYP01': '22PYB01',
  // Semester II
  '22CSP02': '22CSC02',
  '22CSP03': '22CSC03',
  // Semester III
  '22CSP04': '22CSC05',
  '22CSP05': '22CSC06',
  '22CSP06': '22CSC07',
  // Semester IV
  '22CSP07': '22CSC11',
  '22CSP08': '22CSC12',
  // Semester V
  '22CSP09': '22CSC15',
  '22CSP10': '22CSC16',
  // Semester VI
  '22CSP11': '22CSC17',
  '22CSP12': '22CSC18',
};

// Authoritative canonical allocation policies defined by curriculum master
const CANONICAL_ALLOCATION_POLICIES = {
  // Semester I
  '22MAN01': { type: ALLOCATION_RULES.MC_OPTIONAL_MAPPING, linkedTheoryCourseCode: null },
  '22CSP01': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC01' },
  '22ECP01': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22ECC01' },
  '22PYP01': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22PYB01' },
  // Semester II
  '22MAN02R': { type: ALLOCATION_RULES.MC_SAS, linkedTheoryCourseCode: null },
  '22CSP02': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC02' },
  '22CSP03': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC03' },
  '22MEP01': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: null },
  // Semester III
  '22CSP04': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC05' },
  '22CSP05': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC06' },
  '22CSP06': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC07' },
  '22MAN04R': { type: ALLOCATION_RULES.MC_SAS, linkedTheoryCourseCode: null },
  '22MAN09': { type: ALLOCATION_RULES.MC_DEPARTMENT, linkedTheoryCourseCode: null },
  // Semester IV
  '22CSP07': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC11' },
  '22CSP08': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC12' },
  '22MAN07R': { type: ALLOCATION_RULES.MC_SAS, linkedTheoryCourseCode: null },
  // Semester V
  '22CSP09': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC15' },
  '22CSP10': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC16' },
  '22MAN8R': { type: ALLOCATION_RULES.MC_SAS, linkedTheoryCourseCode: null },
  // Semester VI
  '22CSP11': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC17' },
  '22CSP12': { type: ALLOCATION_RULES.LAB_2_TO_3, linkedTheoryCourseCode: '22CSC18' },
};

/**
 * Normalizes institutional department representations.
 */
function normalizeDepartment(dept) {
  if (!dept) return '';
  const s = String(dept).toUpperCase();
  if (s.includes('COMPUTER SCIENCE') || s.includes('CSE')) return 'CSE';
  if (s.includes('ELECTRONICS') || s.includes('ECE')) return 'ECE';
  if (s.includes('MECHANICAL') || s.includes('MECH')) return 'MECH';
  if (s.includes('CIVIL')) return 'CIVIL';
  if (s.includes('ELECTRICAL') || s.includes('EEE')) return 'EEE';
  if (s.includes('INFORMATION') || s.includes('IT')) return 'IT';
  if (s.includes('SCIENCE & HUMANITIES') || s.includes('H&S')) return 'H&S';
  if (s.includes('MATH') || s.includes('MATHEMATICS')) return 'MATHEMATICS';
  if (s.includes('ENGLISH')) return 'ENGLISH';
  return s.trim();
}

/**
 * Resolves the linked theory course code for a given laboratory course.
 */
function getLinkedTheoryCourseCode(course, allCourses = []) {
  if (!course) return null;
  const code = (course.courseCode || '').toUpperCase().trim();

  // 1. Direct property on course model / canonical configuration
  if (course.allocationPolicy && course.allocationPolicy.linkedTheoryCourseCode) {
    return course.allocationPolicy.linkedTheoryCourseCode;
  }
  if (CANONICAL_ALLOCATION_POLICIES[code] && CANONICAL_ALLOCATION_POLICIES[code].linkedTheoryCourseCode) {
    return CANONICAL_ALLOCATION_POLICIES[code].linkedTheoryCourseCode;
  }
  if (THEORY_LAB_LINKS[code]) {
    return THEORY_LAB_LINKS[code];
  }
  if (course.linkedTheoryCourseCode) {
    return course.linkedTheoryCourseCode;
  }

  return null;
}

/**
 * Derives the authoritative allocation policy for a course using canonical metadata.
 */
function getCourseAllocationPolicy(course, allCourses = []) {
  if (!course) {
    return {
      rule: ALLOCATION_RULES.THEORY_SINGLE,
      minFaculty: 1,
      maxFaculty: 1,
      facultyRequired: true,
      linkedTheoryCourseCode: null,
      constraints: { minFaculty: 1, maxFaculty: 1 },
      timetableMapping: { allowed: true, required: true, enabled: true },
    };
  }

  const code = (course.courseCode || '').toUpperCase().trim();
  const isLab =
    course.isLab === true ||
    course.courseType === 'LAB' ||
    (course.P && course.P >= 3 && course.L === 0);

  const category = (course.category || '').toUpperCase().trim();
  const courseType = (course.courseType || '').toUpperCase().trim();

  // 1. Authoritative canonical policy lookup
  const canonical =
    (course.allocationPolicy && course.allocationPolicy.type)
      ? { type: course.allocationPolicy.type, linkedTheoryCourseCode: course.allocationPolicy.linkedTheoryCourseCode }
      : (CANONICAL_ALLOCATION_POLICIES[code] || null);

  // 2. LABORATORY Policy: LAB_2_TO_3
  if ((canonical && canonical.type === ALLOCATION_RULES.LAB_2_TO_3) || isLab) {
    const linkedTheory = getLinkedTheoryCourseCode(course, allCourses);
    return {
      rule: ALLOCATION_RULES.LAB_2_TO_3,
      minFaculty: 2,
      maxFaculty: 3,
      facultyRequired: true,
      linkedTheoryCourseCode: linkedTheory,
      constraints: { minFaculty: 2, maxFaculty: 3 },
      slots: [
        {
          role: 'PRIMARY',
          required: true,
          source: linkedTheory ? 'THEORY_LINKED' : 'MANUAL',
          description: linkedTheory
            ? `Theory-linked primary instructor (${linkedTheory})`
            : 'Primary lab instructor',
        },
        {
          role: 'ADDITIONAL',
          required: true,
          source: 'MANUAL',
          description: 'Mandatory secondary lab instructor',
        },
        {
          role: 'OPTIONAL',
          required: false,
          source: 'MANUAL',
          description: 'Optional tertiary lab instructor',
        },
      ],
      timetableMapping: { allowed: true, required: true, enabled: true },
    };
  }

  // 3. MANDATORY COURSES (MC) & SAS
  if ((canonical && canonical.type === ALLOCATION_RULES.MC_OPTIONAL_MAPPING) ||
      (category === 'MC' && course.totalPeriod === 0 && course.contactHours === 0 && course.credits === 0)) {
    return {
      rule: ALLOCATION_RULES.MC_OPTIONAL_MAPPING,
      minFaculty: 0,
      maxFaculty: 1,
      facultyRequired: false,
      linkedTheoryCourseCode: null,
      constraints: { minFaculty: 0, maxFaculty: 1 },
      slots: [
        {
          role: 'PRIMARY',
          required: false,
          source: 'MANUAL',
          description: 'Optional coordinator / faculty member',
        },
      ],
      timetableMapping: { allowed: true, required: false, enabled: false },
    };
  }

  if ((canonical && canonical.type === ALLOCATION_RULES.MC_SAS) ||
      courseType === 'SAS' ||
      (category === 'MC' && course.P > 0 && course.L > 0)) {
    return {
      rule: ALLOCATION_RULES.MC_SAS,
      minFaculty: 2,
      maxFaculty: 2,
      facultyRequired: true,
      linkedTheoryCourseCode: null,
      constraints: { minFaculty: 2, maxFaculty: 2 },
      slots: [
        {
          role: 'MATHS_BME',
          required: true,
          source: 'MANUAL',
          eligibleDepartment: 'MATHEMATICS',
          description: 'Mathematics / Quantitative / BME instructor',
        },
        {
          role: 'ENGLISH',
          required: true,
          source: 'MANUAL',
          eligibleDepartment: 'ENGLISH',
          description: 'Verbal / English instructor',
        },
      ],
      timetableMapping: { allowed: true, required: true, enabled: true },
    };
  }

  if ((canonical && canonical.type === ALLOCATION_RULES.MC_DEPARTMENT) || category === 'MC' || courseType === 'MC') {
    return {
      rule: ALLOCATION_RULES.MC_DEPARTMENT,
      minFaculty: 1,
      maxFaculty: 1,
      facultyRequired: true,
      linkedTheoryCourseCode: null,
      constraints: { minFaculty: 1, maxFaculty: 1 },
      slots: [
        {
          role: 'PRIMARY',
          required: true,
          source: 'MANUAL',
          description: 'Department faculty member',
        },
      ],
      timetableMapping: { allowed: true, required: true, enabled: true },
    };
  }

  // 4. STANDARD THEORY: THEORY_SINGLE
  return {
    rule: ALLOCATION_RULES.THEORY_SINGLE,
    minFaculty: 1,
    maxFaculty: 1,
    facultyRequired: true,
    linkedTheoryCourseCode: null,
    constraints: { minFaculty: 1, maxFaculty: 1 },
    slots: [
      {
        role: 'THEORY',
        required: true,
        source: 'MANUAL',
        description: 'Subject teacher',
      },
    ],
    timetableMapping: { allowed: true, required: true, enabled: true },
  };
}

/**
 * Computes granular allocation status based on policy and current assignments.
 */
function computeAllocationStatus(policy, allocation, linkedTheoryAllocation = null) {
  if (!policy) return 'UNALLOCATED';

  let assignments = [];
  let mapping = null;

  if (Array.isArray(allocation)) {
    assignments = allocation;
    mapping = linkedTheoryAllocation;
  } else if (allocation && typeof allocation === 'object') {
    mapping = allocation.timetableMapping || linkedTheoryAllocation;
    if (Array.isArray(allocation.facultyAssignments) && allocation.facultyAssignments.length > 0) {
      assignments = allocation.facultyAssignments;
    } else if (allocation.facultyId) {
      assignments = [{ facultyId: allocation.facultyId, facultyName: allocation.facultyName, role: 'PRIMARY' }];
    }
  }

  // MC_OPTIONAL_MAPPING (Induction)
  if (policy.rule === ALLOCATION_RULES.MC_OPTIONAL_MAPPING) {
    const isMapped = Boolean(mapping?.enabled);
    const hasFaculty = assignments.length > 0;
    return isMapped || hasFaculty ? 'MAPPED' : 'OPTIONAL_NOT_MAPPED';
  }

  if (assignments.length === 0) {
    return 'UNALLOCATED';
  }

  // LAB_2_TO_3 Status
  if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
    const hasPrimary = assignments.some((a) => a.role === 'PRIMARY');
    const hasAdditional = assignments.some((a) => a.role === 'ADDITIONAL');
    const hasOptional = assignments.some((a) => a.role === 'OPTIONAL');

    if (assignments.length === 1 && hasPrimary) return 'PRIMARY_ONLY';
    if (!hasPrimary || !hasAdditional) return 'INCOMPLETE';
    if (assignments.length === 2 && hasPrimary && hasAdditional) return 'COMPLETE_2';
    if (assignments.length >= 3 && hasPrimary && hasAdditional && (hasOptional || assignments.length >= 3)) return 'COMPLETE_3';
    return assignments.length >= 2 ? 'COMPLETE_2' : 'INCOMPLETE';
  }

  // MC_SAS Status
  if (policy.rule === ALLOCATION_RULES.MC_SAS) {
    const hasMaths = assignments.some((a) => a.role === 'MATHS_BME');
    const hasEnglish = assignments.some((a) => a.role === 'ENGLISH');

    if (hasMaths && hasEnglish) return 'COMPLETE';
    if (hasMaths && !hasEnglish) return 'ENGLISH_MISSING';
    if (!hasMaths && hasEnglish) return 'MATHS_BME_MISSING';
    return 'UNALLOCATED';
  }

  // MC_DEPARTMENT & THEORY_SINGLE Status
  return assignments.length >= 1 ? 'COMPLETE' : 'UNALLOCATED';
}

/**
 * Validates an incoming allocation payload against authoritative policy rules.
 *
 * @param {Object} params
 * @param {Object} params.academicContext - Mongoose document
 * @param {Object} params.course - Mongoose document
 * @param {Object} params.payload - Input payload
 * @param {Array} params.existingAllocations - All allocations for this context
 * @returns {Promise<{ isValid: boolean, error: Object|null, normalizedAssignments: Array, timetableMapping: Object }>}
 */
async function validateAllocationPayload({ academicContext, course, payload, existingAllocations = [] }) {
  const policy = getCourseAllocationPolicy(course);
  const courseCode = course.courseCode.toUpperCase().trim();

  const timetableMapping = {
    allowed: policy.timetableMapping.allowed,
    required: policy.timetableMapping.required,
    enabled: payload.timetableMapping?.enabled !== undefined
      ? Boolean(payload.timetableMapping.enabled)
      : policy.timetableMapping.enabled,
  };

  // 1. OPTIONAL MAPPING (e.g. Induction)
  if (policy.rule === ALLOCATION_RULES.MC_OPTIONAL_MAPPING) {
    const rawAssignments = Array.isArray(payload.facultyAssignments) ? payload.facultyAssignments : [];
    if (rawAssignments.length === 0 && !payload.facultyId) {
      // Valid state: OPTIONAL_NOT_MAPPED
      return {
        isValid: true,
        error: null,
        policy,
        allocationRule: policy.rule,
        normalizedAssignments: [],
        primaryFaculty: null,
        timetableMapping: { ...timetableMapping, enabled: false },
        allocationStatus: 'OPTIONAL_NOT_MAPPED',
      };
    }
  }

  // Normalize incoming assignments from either facultyAssignments[] or legacy { facultyId, facultyName }
  let inputAssignments = [];
  if (Array.isArray(payload.facultyAssignments) && payload.facultyAssignments.length > 0) {
    inputAssignments = payload.facultyAssignments;
  } else if (payload.facultyId) {
    inputAssignments = [
      {
        facultyId: payload.facultyId,
        facultyName: payload.facultyName || '',
        role: payload.allocationType === 'LAB_PRIMARY' ? 'PRIMARY' : (policy.rule === ALLOCATION_RULES.LAB_2_TO_3 ? 'PRIMARY' : 'THEORY'),
      },
    ];
  }

  // 2. Strict role check for SAS
  if (policy.rule === ALLOCATION_RULES.MC_SAS) {
    const allowedSasRoles = ['MATHS_BME', 'ENGLISH'];
    for (const fa of inputAssignments) {
      if (!fa.role || !allowedSasRoles.includes(fa.role)) {
        return {
          isValid: false,
          error: {
            code: 'SAS_INVALID_ROLE',
            message: `Unknown or disallowed role '${fa.role}' for SAS allocation. Allowed roles are: MATHS_BME, ENGLISH.`,
            details: { courseCode, role: fa.role },
          },
        };
      }
    }

    if (inputAssignments.length > 2) {
      return {
        isValid: false,
        error: {
          code: 'SAS_INVALID_ROLE',
          message: `Soft/Analytical Skills allocation requires exactly two instructors (MATHS_BME and ENGLISH). Received: ${inputAssignments.length}.`,
          details: { courseCode, count: inputAssignments.length },
        },
      };
    }

    const mathsSlots = inputAssignments.filter((a) => a.role === 'MATHS_BME');
    const englishSlots = inputAssignments.filter((a) => a.role === 'ENGLISH');

    if (mathsSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'SAS_DUPLICATE_ROLE',
          message: 'SAS allocation can have only one MATHS_BME instructor.',
          details: { courseCode, count: mathsSlots.length },
        },
      };
    }
    if (englishSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'SAS_DUPLICATE_ROLE',
          message: 'SAS allocation can have only one ENGLISH instructor.',
          details: { courseCode, count: englishSlots.length },
        },
      };
    }

    if (mathsSlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'SAS_MATHS_BME_REQUIRED',
          message: `Soft/Analytical Skills course '${courseCode}' requires a designated MATHS_BME instructor.`,
          details: { courseCode },
        },
      };
    }
    if (englishSlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'SAS_ENGLISH_REQUIRED',
          message: `Soft/Analytical Skills course '${courseCode}' requires a designated ENGLISH instructor.`,
          details: { courseCode },
        },
      };
    }
  }

  // Strict role check for LAB (invalid and duplicate roles check)
  if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
    const allowedLabRoles = ['PRIMARY', 'ADDITIONAL', 'OPTIONAL'];
    for (const fa of inputAssignments) {
      if (!fa.role || !allowedLabRoles.includes(fa.role)) {
        return {
          isValid: false,
          error: {
            code: 'LAB_INVALID_ROLE',
            message: `Unknown or disallowed role '${fa.role}' for LAB allocation. Allowed roles are: PRIMARY, ADDITIONAL, OPTIONAL.`,
            details: { courseCode, role: fa.role },
          },
        };
      }
    }
    if (inputAssignments.length < policy.minFaculty) {
      return {
        isValid: false,
        error: {
          code: 'LAB_MINIMUM_FACULTY_NOT_MET',
          message: `LAB allocation requires at least ${policy.minFaculty} faculty members (PRIMARY and ADDITIONAL).`,
          details: { courseCode, required: policy.minFaculty, received: inputAssignments.length },
        },
      };
    }

    if (inputAssignments.length > policy.maxFaculty) {
      return {
        isValid: false,
        error: {
          code: 'LAB_MAXIMUM_FACULTY_EXCEEDED',
          message: `LAB allocation cannot exceed ${policy.maxFaculty} faculty members.`,
          details: { courseCode, maxAllowed: policy.maxFaculty, received: inputAssignments.length },
        },
      };
    }

    const primarySlots = inputAssignments.filter((a) => a.role === 'PRIMARY');
    const additionalSlots = inputAssignments.filter((a) => a.role === 'ADDITIONAL');
    const optionalSlots = inputAssignments.filter((a) => a.role === 'OPTIONAL');

    if (primarySlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have only one PRIMARY faculty.',
          details: { courseCode, count: primarySlots.length },
        },
      };
    }
    if (additionalSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have only one ADDITIONAL faculty.',
          details: { courseCode, count: additionalSlots.length },
        },
      };
    }
    if (optionalSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have at most one OPTIONAL faculty.',
          details: { courseCode, count: optionalSlots.length },
        },
      };
    }
  }

  if (policy.facultyRequired && inputAssignments.length < policy.minFaculty) {
    if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
      return {
        isValid: false,
        error: {
          code: 'LAB_MINIMUM_FACULTY_NOT_MET',
          message: `LAB allocation requires at least ${policy.minFaculty} faculty members (PRIMARY and ADDITIONAL).`,
          details: { courseCode, required: policy.minFaculty, received: inputAssignments.length },
        },
      };
    }
    if (policy.rule === ALLOCATION_RULES.MC_DEPARTMENT) {
      return {
        isValid: false,
        error: {
          code: 'MC_DEPARTMENT_FACULTY_REQUIRED',
          message: `Mandatory course '${courseCode}' requires an active department faculty member.`,
          details: { courseCode, department: academicContext.department },
        },
      };
    }
    return {
      isValid: false,
      error: {
        code: 'ALLOCATION_MINIMUM_FACULTY_NOT_MET',
        message: `Course '${courseCode}' requires at least ${policy.minFaculty} faculty member(s).`,
        details: { courseCode, required: policy.minFaculty, received: inputAssignments.length },
      },
    };
  }

  // 3. Maximum faculty checks
  if (inputAssignments.length > policy.maxFaculty) {
    if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
      return {
        isValid: false,
        error: {
          code: 'LAB_MAXIMUM_FACULTY_EXCEEDED',
          message: `LAB allocation cannot exceed ${policy.maxFaculty} faculty members.`,
          details: { courseCode, maxAllowed: policy.maxFaculty, received: inputAssignments.length },
        },
      };
    }
    return {
      isValid: false,
      error: {
        code: 'ALLOCATION_MAXIMUM_FACULTY_EXCEEDED',
        message: `Course '${courseCode}' cannot exceed ${policy.maxFaculty} faculty member(s).`,
        details: { courseCode, maxAllowed: policy.maxFaculty, received: inputAssignments.length },
      },
    };
  }

  // 4. Duplicate faculty check within the submitted assignment
  const facultyIdsSeen = new Set();
  for (const fa of inputAssignments) {
    const fid = (fa.facultyId || '').trim();
    if (!fid) continue;
    if (facultyIdsSeen.has(fid)) {
      if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
        return {
          isValid: false,
          error: {
            code: 'LAB_DUPLICATE_FACULTY',
            message: `Duplicate faculty assignment '${fid}' in LAB allocation. Each assigned faculty must be distinct.`,
            details: { courseCode, duplicateFacultyId: fid },
          },
        };
      }
      if (policy.rule === ALLOCATION_RULES.MC_SAS) {
        return {
          isValid: false,
          error: {
            code: 'SAS_DUPLICATE_FACULTY',
            message: `The same faculty member '${fid}' cannot occupy both MATHS_BME and ENGLISH roles.`,
            details: { courseCode, duplicateFacultyId: fid },
          },
        };
      }
      return {
        isValid: false,
        error: {
          code: 'DUPLICATE_FACULTY_ASSIGNMENT',
          message: `Faculty '${fid}' cannot be assigned multiple times to the same course.`,
          details: { courseCode, duplicateFacultyId: fid },
        },
      };
    }
    facultyIdsSeen.add(fid);
  }

  // 5. Verify every assigned faculty exists and is active (Batched single query)
  const enrichedAssignments = [];
  const uniqueFacultyIds = [...new Set(inputAssignments.map((a) => (a.facultyId || '').trim()).filter(Boolean))];
  const foundFacultyDocs = await Faculty.find({ facultyId: { $in: uniqueFacultyIds } });
  const facultyDocsMap = new Map(foundFacultyDocs.map((f) => [f.facultyId, f]));

  for (const fa of inputAssignments) {
    const fid = (fa.facultyId || '').trim();
    const facDoc = facultyDocsMap.get(fid);
    if (!facDoc) {
      const code = policy.rule === ALLOCATION_RULES.LAB_2_TO_3
        ? 'LAB_FACULTY_NOT_FOUND'
        : (policy.rule === ALLOCATION_RULES.MC_SAS ? 'SAS_FACULTY_NOT_FOUND' : 'FACULTY_NOT_FOUND');
      return {
        isValid: false,
        error: {
          code,
          message: `Faculty member '${fid}' not found in institution faculty master.`,
          details: { courseCode, facultyId: fid },
        },
      };
    }
    if (facDoc.isActive === false) {
      const code = policy.rule === ALLOCATION_RULES.LAB_2_TO_3
        ? 'LAB_FACULTY_INACTIVE'
        : (policy.rule === ALLOCATION_RULES.MC_SAS ? 'SAS_FACULTY_INACTIVE' : 'FACULTY_INACTIVE');
      return {
        isValid: false,
        error: {
          code,
          message: `Faculty member '${facDoc.facultyName}' (${fid}) is marked inactive.`,
          details: { courseCode, facultyId: fid, facultyName: facDoc.facultyName },
        },
      };
    }
  }

  // 6. POLICY-SPECIFIC ROLE & ELIGIBILITY ENFORCEMENT

  // 6a. LAB_2_TO_3 Role Validation
  if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3) {
    const allowedLabRoles = ['PRIMARY', 'ADDITIONAL', 'OPTIONAL'];
    for (const fa of inputAssignments) {
      if (!fa.role || !allowedLabRoles.includes(fa.role)) {
        return {
          isValid: false,
          error: {
            code: 'LAB_INVALID_ROLE',
            message: `Unknown or disallowed role '${fa.role}' for LAB allocation. Allowed roles are: PRIMARY, ADDITIONAL, OPTIONAL.`,
            details: { courseCode, role: fa.role },
          },
        };
      }
    }

    const primarySlots = inputAssignments.filter((a) => a.role === 'PRIMARY');
    const additionalSlots = inputAssignments.filter((a) => a.role === 'ADDITIONAL');
    const optionalSlots = inputAssignments.filter((a) => a.role === 'OPTIONAL');

    if (primarySlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'LAB_PRIMARY_FACULTY_REQUIRED',
          message: `LAB allocation requires a PRIMARY faculty member.`,
          details: { courseCode },
        },
      };
    }

    if (primarySlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have only one PRIMARY faculty.',
          details: { courseCode, count: primarySlots.length },
        },
      };
    }

    if (additionalSlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'LAB_ADDITIONAL_FACULTY_REQUIRED',
          message: `LAB allocation requires a mandatory ADDITIONAL faculty member.`,
          details: { courseCode },
        },
      };
    }

    if (additionalSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have only one ADDITIONAL faculty.',
          details: { courseCode, count: additionalSlots.length },
        },
      };
    }

    if (optionalSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'LAB_DUPLICATE_ROLE',
          message: 'LAB allocation can have at most one OPTIONAL faculty.',
          details: { courseCode, count: optionalSlots.length },
        },
      };
    }

    const primarySlot = primarySlots[0];

    // Theory-linked Primary validation
    if (policy.linkedTheoryCourseCode) {
      const theoryAlloc = existingAllocations.find(
        (a) => a.courseCode === policy.linkedTheoryCourseCode && a.status !== 'REJECTED'
      );

      if (!theoryAlloc || !theoryAlloc.facultyId) {
        return {
          isValid: false,
          error: {
            code: 'LAB_THEORY_ALLOCATION_REQUIRED',
            message: `Theory course '${policy.linkedTheoryCourseCode}' must be allocated before allocating linked laboratory course '${courseCode}'.`,
            details: {
              courseCode,
              linkedTheoryCourseCode: policy.linkedTheoryCourseCode,
            },
          },
        };
      }

      const expectedTheoryFacultyId = theoryAlloc.facultyId.trim();
      if (primarySlot.facultyId.trim() !== expectedTheoryFacultyId) {
        return {
          isValid: false,
          error: {
            code: 'LAB_PRIMARY_THEORY_MISMATCH',
            message: `LAB primary faculty '${primarySlot.facultyId}' must match the linked Theory course (${policy.linkedTheoryCourseCode}) assigned faculty '${expectedTheoryFacultyId}'.`,
            details: {
              courseCode,
              linkedTheoryCourseCode: policy.linkedTheoryCourseCode,
              expectedFacultyId: expectedTheoryFacultyId,
              submittedFacultyId: primarySlot.facultyId,
            },
          },
        };
      }
    }
  }

  // 6b. MC_SAS Role Validation
  if (policy.rule === ALLOCATION_RULES.MC_SAS) {
    const allowedSasRoles = ['MATHS_BME', 'ENGLISH'];
    for (const fa of inputAssignments) {
      if (!fa.role || !allowedSasRoles.includes(fa.role)) {
        return {
          isValid: false,
          error: {
            code: 'SAS_INVALID_ROLE',
            message: `Unknown or disallowed role '${fa.role}' for SAS allocation. Allowed roles are: MATHS_BME, ENGLISH.`,
            details: { courseCode, role: fa.role },
          },
        };
      }
    }

    const mathsSlots = inputAssignments.filter((a) => a.role === 'MATHS_BME');
    const englishSlots = inputAssignments.filter((a) => a.role === 'ENGLISH');

    if (mathsSlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'SAS_MATHS_BME_REQUIRED',
          message: `Soft/Analytical Skills course '${courseCode}' requires a designated MATHS_BME instructor.`,
          details: { courseCode },
        },
      };
    }

    if (mathsSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'SAS_DUPLICATE_ROLE',
          message: 'SAS allocation can have only one MATHS_BME instructor.',
          details: { courseCode, count: mathsSlots.length },
        },
      };
    }

    if (englishSlots.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'SAS_ENGLISH_REQUIRED',
          message: `Soft/Analytical Skills course '${courseCode}' requires a designated ENGLISH instructor.`,
          details: { courseCode },
        },
      };
    }

    if (englishSlots.length > 1) {
      return {
        isValid: false,
        error: {
          code: 'SAS_DUPLICATE_ROLE',
          message: 'SAS allocation can have only one ENGLISH instructor.',
          details: { courseCode, count: englishSlots.length },
        },
      };
    }

    if (mathsSlots[0].facultyId.trim() === englishSlots[0].facultyId.trim()) {
      return {
        isValid: false,
        error: {
          code: 'SAS_DUPLICATE_FACULTY',
          message: `The same faculty member cannot occupy both MATHS_BME and ENGLISH roles.`,
          details: { courseCode, facultyId: mathsSlots[0].facultyId },
        },
      };
    }

    // Verify department eligibility: MATHS_BME -> Mathematics, ENGLISH -> English
    for (const fa of inputAssignments) {
      const facDoc = facultyDocsMap.get(fa.facultyId.trim());
      const facDept = normalizeDepartment(facDoc.department);

      if (fa.role === 'MATHS_BME') {
        if (facDept !== 'MATHEMATICS') {
          return {
            isValid: false,
            error: {
              code: 'SAS_MATHS_BME_FACULTY_NOT_ELIGIBLE',
              message: `Faculty '${facDoc.facultyName}' belongs to '${facDoc.department}', but MATHS_BME instructor must belong to the Department of Mathematics.`,
              details: {
                courseCode,
                requiredDepartment: 'Mathematics',
                facultyDepartment: facDoc.department,
                facultyId: facDoc.facultyId,
              },
            },
          };
        }
      } else if (fa.role === 'ENGLISH') {
        if (facDept !== 'ENGLISH') {
          return {
            isValid: false,
            error: {
              code: 'SAS_ENGLISH_FACULTY_NOT_ELIGIBLE',
              message: `Faculty '${facDoc.facultyName}' belongs to '${facDoc.department}', but ENGLISH instructor must belong to the Department of English.`,
              details: {
                courseCode,
                requiredDepartment: 'English',
                facultyDepartment: facDoc.department,
                facultyId: facDoc.facultyId,
              },
            },
          };
        }
      }
    }
  }

  // 6c. MC_DEPARTMENT Validation (e.g. Indian Constitution)
  if (policy.rule === ALLOCATION_RULES.MC_DEPARTMENT) {
    const targetDept = normalizeDepartment(academicContext.department);

    for (const fa of inputAssignments) {
      const facDoc = facultyDocsMap.get(fa.facultyId.trim());
      const facDept = normalizeDepartment(facDoc.department);

      if (facDept !== targetDept) {
        return {
          isValid: false,
          error: {
            code: 'MC_DEPARTMENT_FACULTY_NOT_ELIGIBLE',
            message: `Faculty '${facDoc.facultyName}' belongs to '${facDoc.department}', but course '${courseCode}' requires a faculty member from the cohort department (${academicContext.department}).`,
            details: {
              courseCode,
              requiredDepartment: academicContext.department,
              facultyDepartment: facDoc.department,
              facultyId: facDoc.facultyId,
            },
          },
        };
      }
    }
  }

  // 7. Build enriched facultyAssignments array
  for (const fa of inputAssignments) {
    const facDoc = facultyDocsMap.get(fa.facultyId.trim());
    let source = fa.source || 'MANUAL';

    if (policy.rule === ALLOCATION_RULES.LAB_2_TO_3 && fa.role === 'PRIMARY' && policy.linkedTheoryCourseCode) {
      source = 'THEORY_LINKED';
    }

    enrichedAssignments.push({
      facultyId: facDoc.facultyId,
      facultyName: facDoc.facultyName,
      role: fa.role || 'PRIMARY',
      required: fa.role === 'OPTIONAL' ? false : true,
      source,
    });
  }

  // Determine Primary faculty
  const primaryAssignment =
    enrichedAssignments.find((a) => a.role === 'PRIMARY' || a.role === 'THEORY' || a.role === 'MATHS_BME') ||
    enrichedAssignments[0];

  const allocationStatus = computeAllocationStatus(policy, { facultyAssignments: enrichedAssignments });

  return {
    isValid: true,
    error: null,
    policy,
    allocationRule: policy.rule,
    normalizedAssignments: enrichedAssignments,
    primaryFaculty: primaryAssignment || null,
    timetableMapping,
    allocationStatus,
  };
}

const {
  getEligibleFacultyByDepartment,
  getEligibleFacultyBatch,
} = require('./facultyEligibilityService');

module.exports = {
  ALLOCATION_RULES,
  THEORY_LAB_LINKS,
  normalizeDepartment,
  getLinkedTheoryCourseCode,
  getCourseAllocationPolicy,
  computeAllocationStatus,
  validateAllocationPayload,
  getEligibleFacultyByDepartment,
  getEligibleFacultyBatch,
};
