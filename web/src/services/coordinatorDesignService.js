/**
 * Coordinator Timetable Design Service
 * Orchestrates automatic course row creation, authoritative HOD faculty resolution,
 * pagination handling, and assignment plan synchronization.
 */

import { getCourses, getR22CurriculumOverview } from './courseService.js';
import { getHODAllocations } from './hodAllocationService.js';
import {
  resolveCurriculumSemester,
  findMatchingAcademicContext,
  YEAR_SEMESTER_MAP,
} from '../constants/academicContext.js';

// Default Elective Slot Map from Authoritative R22 Curriculum Master
export const DEFAULT_ELECTIVE_SLOT_MAP = {
  'Semester V': [
    { slot: 'E1', allowedType: 'PEC', description: 'PEC only' },
    { slot: 'E2', allowedType: 'PEC', description: 'PEC only' },
    { slot: 'E3', allowedType: 'PEC/OEC', description: 'PEC or OEC' },
  ],
  'Semester VI': [
    { slot: 'EM', allowedType: 'Management Elective', description: 'Management Elective' },
    { slot: 'E4', allowedType: 'PEC', description: 'PEC only' },
    { slot: 'E5', allowedType: 'PEC', description: 'PEC only' },
    { slot: 'E6', allowedType: 'PEC/OEC', description: 'PEC or OEC' },
  ],
  'Semester VII': [
    { slot: 'E7', allowedType: 'PEC', description: 'PEC only' },
    { slot: 'E8', allowedType: 'PEC/OEC', description: 'PEC or OEC' },
    { slot: 'E9', allowedType: 'OEC', description: 'OEC only' },
    { slot: 'E10', allowedType: 'OEC', description: 'OEC only' },
  ],
};

/**
 * Fetches all courses for the given curriculum semester, handling paginated API responses.
 * Guarantees that all pages are read without hardcoded limits.
 */
export async function fetchAllCoursesForContext({ semester, academicContextId }) {
  if (!semester) return [];

  let allCourses = [];
  let currentPage = 1;
  const pageLimit = 100;
  let totalPages = 1;

  do {
    const res = await getCourses({
      semester,
      academicContextId: academicContextId || undefined,
      limit: pageLimit,
      page: currentPage,
    });

    let items = [];
    if (Array.isArray(res)) {
      items = res;
      totalPages = 1;
    } else if (res && typeof res === 'object') {
      items = res.items || res.data?.items || res.courses || res.data?.courses || res.data || [];
      if (!Array.isArray(items)) items = [];
      totalPages = res.totalPages || res.data?.totalPages || 1;
      const total = res.total || res.data?.total;
      if (total && !res.totalPages && !res.data?.totalPages) {
        totalPages = Math.ceil(total / pageLimit);
      }
    }

    allCourses = allCourses.concat(items);
    currentPage++;
  } while (currentPage <= totalPages);

  return allCourses;
}

/**
 * Normalizes a course code string for stable matching
 */
export function normalizeCourseCode(code) {
  return (code || '').toUpperCase().trim();
}

/**
 * Normalizes an academic context ID string for stable matching
 */
export function normalizeContextId(ctx) {
  if (!ctx) return '';
  if (typeof ctx === 'object') {
    return String(ctx._id || ctx.id || '');
  }
  return String(ctx);
}

/**
 * Resolves authoritative HOD faculty allocation for a given course in an academic context.
 * Strict Rule: Never use workload master, candidate pools, or historical fallbacks.
 * Match order: 1. course/allocation ID, 2. courseCode.
 */
export function resolveAuthoritativeHODFaculty(allocations = [], academicContextId, courseIdentifier) {
  if (!academicContextId || !courseIdentifier || !Array.isArray(allocations)) {
    return {
      allocated: false,
      hasConflict: false,
      facultyId: null,
      facultyName: null,
      displayFaculty: '[REQUIRES HOD DECISION]',
      allocationType: null,
      status: 'REQUIRES HOD DECISION',
    };
  }

  const targetCtxId = normalizeContextId(academicContextId);
  const targetCode = typeof courseIdentifier === 'object'
    ? normalizeCourseCode(courseIdentifier.courseCode)
    : normalizeCourseCode(courseIdentifier);
  const targetCourseId = typeof courseIdentifier === 'object'
    ? String(courseIdentifier._id || courseIdentifier.id || '')
    : '';

  const matchingAllocations = allocations.filter((a) => {
    if (a.status === 'REJECTED') return false;

    const aCtxId = normalizeContextId(a.academicContextId);
    if (aCtxId && targetCtxId && aCtxId !== targetCtxId) return false;

    // 1. Match by Course ID if both present
    if (targetCourseId && a.courseId && String(a.courseId) === targetCourseId) {
      return true;
    }

    // 2. Match by Course Code
    const aCode = normalizeCourseCode(a.courseCode);
    return aCode === targetCode;
  });

  if (matchingAllocations.length === 0) {
    return {
      allocated: false,
      hasConflict: false,
      facultyId: null,
      facultyName: null,
      displayFaculty: '[REQUIRES HOD DECISION]',
      allocationType: null,
      status: 'REQUIRES HOD DECISION',
    };
  }

  // Conflict state: multiple active non-rejected HOD allocations for the same course in same cohort
  if (matchingAllocations.length > 1) {
    return {
      allocated: false,
      hasConflict: true,
      facultyId: null,
      facultyName: null,
      displayFaculty: '[CONFLICT: MULTIPLE HOD ALLOCATIONS]',
      allocationType: null,
      status: 'HOD_ALLOCATION_CONFLICT',
    };
  }

  // Authoritative single allocation
  const alloc = matchingAllocations[0];
  const facultyId = alloc.facultyId?._id || alloc.facultyId || null;
  const facultyName = alloc.facultyName || facultyId;

  return {
    allocated: true,
    hasConflict: false,
    facultyId,
    facultyName,
    displayFaculty: facultyName ? `${facultyName} (${facultyId})` : facultyId,
    allocationType: alloc.allocationType || 'THEORY',
    status: 'HOD ALLOCATED',
  };
}


/**
 * Derives automatic course rows for a given context and semester.
 * 
 * Rules:
 * 1. Applicable curriculum active courses from the API form the core rows.
 * 2. Active elective allocations in this context are represented as active course rows.
 * 3. Unresolved elective slots (from slot map) are clearly presented as unresolved slots.
 * 4. All 48 PEC catalog options are NEVER automatically displayed as active courses.
 * 5. Faculty strictly comes from HOD allocation, or [REQUIRES HOD DECISION].
 * 6. Duplicate courses are strictly prevented.
 */
export function deriveAutomaticCourseRows({
  courses = [],
  allCatalogCourses = [],
  hodAllocations = [],
  academicContextId = '',
  targetCurriculumSemester = '',
  electiveSlotMap = DEFAULT_ELECTIVE_SLOT_MAP,
}) {
  const normTargetSem = (targetCurriculumSemester || '').replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();

  // 1. Filter curriculum core courses strictly matching target semester
  const coreCurriculumCourses = courses.filter((c) => {
    if (!c.semester) return false;
    const cSem = c.semester.replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();
    return cSem === normTargetSem;
  });

  const seenCourseCodes = new Set();
  const rows = [];

  // 2. Add regular curriculum core courses
  for (const crs of coreCurriculumCourses) {
    const code = normalizeCourseCode(crs.courseCode);
    if (!code || seenCourseCodes.has(code)) continue;
    seenCourseCodes.add(code);

    const facultyResolution = resolveAuthoritativeHODFaculty(
      hodAllocations,
      academicContextId,
      code
    );

    const requiredPeriods =
      crs.totalPeriod ||
      (Number(crs.L || 0) + Number(crs.T || 0) + Number(crs.P || 0)) ||
      (crs.isLab ? 4 : 3);

    rows.push({
      id: `${code}_${academicContextId || 'ctx'}`,
      courseCode: code,
      courseTitle: crs.courseName,
      faculty: facultyResolution.displayFaculty,
      facultyId: facultyResolution.facultyId,
      facultyName: facultyResolution.facultyName,
      type: crs.courseType || (crs.isLab ? 'LAB' : 'THEORY'),
      requiredPeriods,
      status: facultyResolution.status,
      isAllocated: facultyResolution.allocated,
      isElectiveSlot: false,
      rawCourse: crs,
    });
  }

  // 3. Inspect HOD allocations for active elective courses in this academic context
  const targetCtxId = normalizeContextId(academicContextId);
  const contextAllocations = targetCtxId
    ? hodAllocations.filter((a) => normalizeContextId(a.academicContextId) === targetCtxId && a.status !== 'REJECTED')
    : [];

  const allocatedElectives = [];
  for (const alloc of contextAllocations) {
    const code = normalizeCourseCode(alloc.courseCode);
    if (seenCourseCodes.has(code)) continue;

    // Check if this course belongs to elective catalog or has elective category/type
    const catalogMatch = allCatalogCourses.find(
      (c) => normalizeCourseCode(c.courseCode) === code
    );

    const isElectiveCategory =
      catalogMatch &&
      (['PEC', 'OEC', 'HSMC', 'MC'].includes(catalogMatch.category) ||
        Boolean(catalogMatch.electiveType) ||
        /elective/i.test(catalogMatch.semester || ''));

    // If it's not a core course already seen, treat active HOD allocated course as an active course
    if (catalogMatch || isElectiveCategory || alloc.courseName) {
      seenCourseCodes.add(code);
      const title = catalogMatch?.courseName || alloc.courseName || code;
      const type = catalogMatch?.courseType || alloc.allocationType || 'THEORY';
      const periods =
        catalogMatch?.totalPeriod ||
        (Number(catalogMatch?.L || 0) + Number(catalogMatch?.T || 0) + Number(catalogMatch?.P || 0)) ||
        3;

      const facultyResolution = resolveAuthoritativeHODFaculty(
        hodAllocations,
        academicContextId,
        code
      );

      allocatedElectives.push({
        id: `${code}_${academicContextId || 'ctx'}`,
        courseCode: code,
        courseTitle: title,
        faculty: facultyResolution.displayFaculty,
        facultyId: facultyResolution.facultyId,
        facultyName: facultyResolution.facultyName,
        type,
        requiredPeriods: periods,
        status: facultyResolution.status,
        isAllocated: facultyResolution.allocated,
        isElectiveSlot: false,
        rawCourse: catalogMatch || alloc,
      });
    }
  }

  rows.push(...allocatedElectives);

  // 4. Handle remaining unresolved elective slots for this curriculum semester
  const expectedSlots = electiveSlotMap[targetCurriculumSemester] || [];
  const slotsToFillCount = Math.max(0, expectedSlots.length - allocatedElectives.length);

  // Take the remaining unfulfilled slots from expectedSlots
  const unfulfilledSlots = expectedSlots.slice(allocatedElectives.length, allocatedElectives.length + slotsToFillCount);

  for (const slotItem of unfulfilledSlots) {
    const slotCode = slotItem.slot;
    if (seenCourseCodes.has(slotCode)) continue;
    seenCourseCodes.add(slotCode);

    rows.push({
      id: `${slotCode}_${academicContextId || 'ctx'}`,
      courseCode: slotCode,
      courseTitle: `Elective Slot ${slotItem.slot} (${slotItem.allowedType})`,
      faculty: '[REQUIRES HOD DECISION]',
      facultyId: null,
      facultyName: null,
      type: 'THEORY',
      requiredPeriods: 3,
      status: 'REQUIRES HOD DECISION',
      isAllocated: false,
      isElectiveSlot: true,
      allowedType: slotItem.allowedType,
      rawCourse: null,
    });
  }

  return rows;
}

/**
 * Calculates overall Assignment Plan status and summary metrics.
 * Produces user-facing states: INITIAL, LOADING, READY, PARTIAL, EMPTY, ERROR.
 */
export function calculateAssignmentPlanStatus(rows = [], { hasContext = true, loading = false, error = null } = {}) {
  if (loading) {
    return {
      state: 'LOADING',
      userMessage: 'Loading active curriculum courses and HOD faculty allocations...',
      totalCourses: 0,
      theoryCount: 0,
      labCount: 0,
      allocatedCount: 0,
      pendingCount: 0,
      isReady: false,
    };
  }

  if (error) {
    return {
      state: 'ERROR',
      userMessage: typeof error === 'string' ? error : 'Failed to retrieve academic context or courses.',
      totalCourses: 0,
      theoryCount: 0,
      labCount: 0,
      allocatedCount: 0,
      pendingCount: 0,
      isReady: false,
    };
  }

  if (!hasContext) {
    return {
      state: 'INITIAL',
      userMessage: 'Please select an Academic Year, Semester, and Section to load the assignment roster.',
      totalCourses: 0,
      theoryCount: 0,
      labCount: 0,
      allocatedCount: 0,
      pendingCount: 0,
      isReady: false,
    };
  }

  if (!rows || rows.length === 0) {
    return {
      state: 'EMPTY',
      userMessage: 'No active courses are available for this academic context.',
      totalCourses: 0,
      theoryCount: 0,
      labCount: 0,
      allocatedCount: 0,
      pendingCount: 0,
      isReady: false,
    };
  }

  const totalCourses = rows.length;
  const theoryCount = rows.filter((r) => r.type === 'THEORY' || !r.type?.includes('LAB')).length;
  const labCount = rows.filter((r) => r.type === 'LAB' || r.type?.includes('LAB')).length;
  const allocatedCount = rows.filter((r) => r.isAllocated && r.status === 'HOD ALLOCATED').length;
  const pendingCount = totalCourses - allocatedCount;

  if (pendingCount > 0) {
    return {
      state: 'PARTIAL',
      userMessage: 'Faculty allocation is pending HOD decision for one or more courses.',
      totalCourses,
      theoryCount,
      labCount,
      allocatedCount,
      pendingCount,
      isReady: false,
    };
  }

  return {
    state: 'READY',
    userMessage: 'All course-faculty assignments are verified from authoritative HOD allocations. Ready for timetable generation.',
    totalCourses,
    theoryCount,
    labCount,
    allocatedCount,
    pendingCount: 0,
    isReady: true,
  };
}

/**
 * Computes a human-readable display string for the HOD-approved faculty of a course.
 * Handles all allocation-rule variants:
 *  - THEORY_SINGLE / legacy {facultyId}   → "Name (ID)"
 *  - LAB_2_TO_3  (PRIMARY / ADDITIONAL / OPTIONAL)
 *  - MC_SAS      (MATHS_BME / ENGLISH)
 *  - MC_DEPARTMENT / MC_OPTIONAL_MAPPING (PRIMARY)
 *
 * Returns a plain-text string used for display only; never mutates or writes to backend.
 */
export function resolveCourseFacultyDisplay(allocations = [], academicContextId, courseIdentifier) {
  const targetCtxId = normalizeContextId(academicContextId);
  const targetCode = typeof courseIdentifier === 'object'
    ? normalizeCourseCode(courseIdentifier.courseCode)
    : normalizeCourseCode(courseIdentifier);
  const targetCourseId = typeof courseIdentifier === 'object'
    ? String(courseIdentifier._id || courseIdentifier.id || '')
    : '';

  const matching = allocations.filter((a) => {
    if (a.status === 'REJECTED') return false;
    const aCtxId = normalizeContextId(a.academicContextId);
    if (aCtxId && targetCtxId && aCtxId !== targetCtxId) return false;
    if (targetCourseId && a.courseId && String(a.courseId) === targetCourseId) return true;
    return normalizeCourseCode(a.courseCode) === targetCode;
  });

  if (matching.length === 0) {
    return { display: '[REQUIRES HOD DECISION]', allocated: false, assignments: [] };
  }
  if (matching.length > 1) {
    return { display: '[CONFLICT: MULTIPLE ALLOCATIONS]', allocated: false, assignments: [] };
  }

  const alloc = matching[0];
  const rule = alloc.allocationRule;
  const rawAssignments = alloc.facultyAssignments || [];

  if (rule === 'LAB_2_TO_3' && rawAssignments.length > 0) {
    const byRole = {};
    rawAssignments.forEach((fa) => { byRole[fa.role] = fa; });
    const lines = [];
    const p = byRole['PRIMARY'] || byRole['THEORY'];
    if (p?.facultyName) lines.push(`Primary: ${p.facultyName}`);
    const add = byRole['ADDITIONAL'];
    if (add?.facultyName) lines.push(`Additional: ${add.facultyName}`);
    const opt = byRole['OPTIONAL'];
    if (opt?.facultyName) lines.push(`Optional: ${opt.facultyName}`);
    const display = lines.length > 0 ? lines.join('\n') : `[REQUIRES HOD DECISION]`;
    return { display, allocated: lines.length > 0, assignments: rawAssignments };
  }

  if (rule === 'MC_SAS' && rawAssignments.length > 0) {
    const byRole = {};
    rawAssignments.forEach((fa) => { byRole[fa.role] = fa; });
    const lines = [];
    const maths = byRole['MATHS_BME'];
    if (maths?.facultyName) lines.push(`Maths / BME: ${maths.facultyName}`);
    const english = byRole['ENGLISH'];
    if (english?.facultyName) lines.push(`English: ${english.facultyName}`);
    const display = lines.length > 0 ? lines.join('\n') : `[REQUIRES HOD DECISION]`;
    return { display, allocated: lines.length > 0, assignments: rawAssignments };
  }

  if (rule === 'MC_DEPARTMENT' && rawAssignments.length > 0) {
    const primary = rawAssignments.find((a) => a.role === 'PRIMARY');
    if (primary?.facultyName) {
      return { display: primary.facultyName, allocated: true, assignments: rawAssignments };
    }
  }

  // Legacy single-faculty (THEORY_SINGLE or null)
  const fname = alloc.facultyName || '';
  const fid = alloc.facultyId || '';
  const display = fname ? `${fname}${fid ? ' (' + fid + ')' : ''}` : '[REQUIRES HOD DECISION]';
  return {
    display,
    allocated: !!fname,
    assignments: rawAssignments.length > 0 ? rawAssignments : [],
    primaryFacultyId: fid,
    primaryFacultyName: fname,
  };
}

export default {
  DEFAULT_ELECTIVE_SLOT_MAP,
  fetchAllCoursesForContext,
  normalizeCourseCode,
  normalizeContextId,
  resolveAuthoritativeHODFaculty,
  resolveCourseFacultyDisplay,
  deriveAutomaticCourseRows,
  calculateAssignmentPlanStatus,
};
