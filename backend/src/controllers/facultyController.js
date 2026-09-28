const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const FacultyWorkload = require('../models/FacultyWorkload');
const {
  formatFacultyAllocations,
  classifyResponsibility,
  parseYearAndSection,
  calculateTeachingHours,
  calculateResponsibilityHours,
} = require('../services/workloadService');
const { getCanonicalRoleName } = require('../constants/responsibilityMaster');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { getPaginationParams, formatPaginatedResult } = require('../utils/pagination');

/**
 * Get all faculty with search and filtering
 * GET /api/faculty
 */
async function getFacultyList(req, res, next) {
  try {
    const { search, department, role, isActive } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query, 50);

    const query = {};

    if (search) {
      const q = search.trim();
      query.$or = [
        { facultyName: { $regex: q, $options: 'i' } },
        { facultyId: { $regex: q, $options: 'i' } },
        { designation: { $regex: q, $options: 'i' } },
      ];
    }

    if (department) {
      query.department = { $regex: department.trim(), $options: 'i' };
    }

    if (role) {
      query.roles = { $in: [role] };
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const [facultyDocs, total] = await Promise.all([
      Faculty.find(query).sort({ facultyId: 1 }).skip(skip).limit(limit),
      Faculty.countDocuments(query),
    ]);

    const facultyIds = facultyDocs.map((f) => f.facultyId);
    const workloadDocs = await FacultyWorkload.find(
      { facultyId: { $in: facultyIds } },
      { facultyId: 1, calculatedTotalHours: 1, calculatedTeachingHours: 1, calculatedResponsibilityHours: 1, status: 1, isIncomplete: 1 }
    );

    const workloadMap = new Map();
    workloadDocs.forEach((w) => workloadMap.set(w.facultyId, w));

    const items = facultyDocs.map((f) => {
      const obj = f.toObject ? f.toObject() : { ...f._doc };
      const w = workloadMap.get(f.facultyId);
      return {
        ...obj,
        calculatedTotalHours: w ? w.calculatedTotalHours : null,
        calculatedTeachingHours: w ? w.calculatedTeachingHours : null,
        calculatedResponsibilityHours: w ? w.calculatedResponsibilityHours : null,
        status: w ? w.status : (f.isActive ? 'ACTIVE' : 'INACTIVE'),
        workload: w || null,
      };
    });

    const paginated = formatPaginatedResult(items, total, page, limit);

    return successResponse(res, {
      ...paginated,
      faculty: items,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single faculty by facultyId or _id
 * GET /api/faculty/:facultyId
 */
async function getFacultyById(req, res, next) {
  try {
    const { facultyId } = req.params;

    const faculty = await Faculty.findOne({
      $or: [{ facultyId }, { _id: facultyId.match(/^[0-9a-fA-F]{24}$/) ? facultyId : null }],
    });

    if (!faculty) {
      return errorResponse(res, `Faculty with identifier '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, faculty);
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to dynamically generate the next sequential FWL-XX ID.
 * Queries existing records from both Faculty and FacultyWorkload without hardcoding constants.
 */
async function generateNextFacultyId() {
  const [facultyDocs, workloadDocs] = await Promise.all([
    Faculty.find({ facultyId: /^FWL-\d+$/i }, { facultyId: 1 }),
    FacultyWorkload.find({ facultyId: /^FWL-\d+$/i }, { facultyId: 1 }),
  ]);

  const existingIds = new Set();
  let maxNum = 0;
  const inspectDoc = (doc) => {
    if (!doc || !doc.facultyId) return;
    existingIds.add(doc.facultyId.toUpperCase());
    const m = doc.facultyId.match(/^FWL-(\d+)$/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxNum) maxNum = num;
    }
  };

  facultyDocs.forEach(inspectDoc);
  workloadDocs.forEach(inspectDoc);

  let candidateNum = maxNum > 0 ? maxNum + 1 : 1;
  let candidateId = `FWL-${String(candidateNum).padStart(2, '0')}`;
  while (existingIds.has(candidateId)) {
    candidateNum++;
    candidateId = `FWL-${String(candidateNum).padStart(2, '0')}`;
  }
  return candidateId;
}

/**
 * Create new Faculty record with Workload Allocation
 * POST /api/faculty
 */
async function createFaculty(req, res, next) {
  try {
    const {
      facultyId,
      facultyName,
      designation,
      department,
      email,
      phone,
      roles,
      teaching: rawTeaching,
      ugTheory1,
      ugTheory2,
      lab1,
      lab2,
      pg,
      others,
      responsibilities: rawResponsibilities,
      sourceTotalHours: rawSourceTotalHours,
    } = req.body;

    // 1. Resolve Faculty ID (auto-generate if omitted)
    const finalFacultyId = facultyId && facultyId.trim()
      ? facultyId.trim().toUpperCase()
      : await generateNextFacultyId();

    const existingFaculty = await Faculty.findOne({ facultyId: finalFacultyId });
    if (existingFaculty) {
      return errorResponse(res, `Faculty ID '${finalFacultyId}' already exists`, 409, 'DUPLICATE_ID');
    }

    const existingWorkload = await FacultyWorkload.findOne({ facultyId: finalFacultyId });
    if (existingWorkload) {
      return errorResponse(res, `Workload record for faculty '${finalFacultyId}' already exists`, 409, 'DUPLICATE_ID');
    }

    if (email && email.trim()) {
      const existingEmail = await Faculty.findOne({
        email: email.trim().toLowerCase(),
      });
      if (existingEmail) {
        return errorResponse(res, `Faculty with email '${email.trim()}' already exists`, 409, 'DUPLICATE_EMAIL');
      }
    }

    const dept = department && department.trim()
      ? department.trim()
      : 'Department of Computer Science and Engineering';

    // 2. Parse and structure Teaching Allocations (supports both nested and flat)
    const teachingData = {
      ugTheory1: (rawTeaching && rawTeaching.ugTheory1) || ugTheory1 || [],
      ugTheory2: (rawTeaching && rawTeaching.ugTheory2) || ugTheory2 || [],
      lab1: (rawTeaching && rawTeaching.lab1) || lab1 || [],
      lab2: (rawTeaching && rawTeaching.lab2) || lab2 || [],
      pg: (rawTeaching && rawTeaching.pg) || pg || [],
      others: (rawTeaching && rawTeaching.others) || others || [],
    };
    const normalizeTeachingItem = (item, defaultCategory) => {
      const parsed = parseYearAndSection(item.allocation);
      return {
        category: item.category || defaultCategory,
        courseCode: item.courseCode ? item.courseCode.trim() : null,
        courseName: item.courseName.trim(),
        allocation: item.allocation ? item.allocation.trim() : null,
        hours: typeof item.hours === 'number' ? item.hours : 0,
        year: item.year ? item.year.trim() : parsed.year,
        section: item.section ? item.section.trim() : parsed.section,
      };
    };

    const teaching = {
      ugTheory1: (teachingData.ugTheory1 || []).map((i) => normalizeTeachingItem(i, 'UG Theory 1')),
      ugTheory2: (teachingData.ugTheory2 || []).map((i) => normalizeTeachingItem(i, 'UG Theory 2')),
      lab1: (teachingData.lab1 || []).map((i) => normalizeTeachingItem(i, 'Lab 1')),
      lab2: (teachingData.lab2 || []).map((i) => normalizeTeachingItem(i, 'Lab 2')),
      pg: (teachingData.pg || []).map((i) => {
        const item = normalizeTeachingItem(i, 'PG');
        // PG / Honours / Minor: each assigned course = 1 equivalent hour/week
        item.hours = i.hours !== undefined && i.hours !== null ? i.hours : 1;
        return item;
      }),
      others: (teachingData.others || []).map((i) => normalizeTeachingItem(i, 'Others')),
    };

    // 3. Parse and structure Responsibilities
    const responsibilitiesData = rawResponsibilities || [];
    const responsibilities = responsibilitiesData.map((item) => {
      const canonicalRole = getCanonicalRoleName(item.role);
      const parsed = parseYearAndSection(item.allocation);
      const type = item.responsibilityType || classifyResponsibility(canonicalRole);
      return {
        category: item.category || 'RESPONSIBILITY',
        role: canonicalRole,
        allocation: item.allocation ? item.allocation.trim() : null,
        hours: typeof item.hours === 'number' ? item.hours : null,
        responsibilityType: type,
        year: item.year ? item.year.trim() : parsed.year,
        section: item.section ? item.section.trim() : parsed.section,
      };
    });

    // 4. Server-Authoritative Workload Calculation
    const calculatedTeachingHours = calculateTeachingHours(teaching);
    const calculatedResponsibilityHours = calculateResponsibilityHours(responsibilities);
    const calculatedTotalHours = calculatedTeachingHours + calculatedResponsibilityHours;

    let sourceTotalHours = rawSourceTotalHours;
    if (sourceTotalHours === undefined || sourceTotalHours === null) {
      sourceTotalHours = calculatedTotalHours;
    } else {
      sourceTotalHours = Number(sourceTotalHours);
    }

    const status = sourceTotalHours === calculatedTotalHours ? 'MATCHED' : 'REVIEW REQUIRED';
    const discrepancyNote =
      sourceTotalHours !== calculatedTotalHours
        ? `Source total (${sourceTotalHours}h) does not match calculated total (${calculatedTotalHours}h). Difference: ${Math.abs(
            sourceTotalHours - calculatedTotalHours
          )}h.`
        : null;

    // 5. Dual Persistence with Compensating Atomic Rollback Strategy
    let createdFaculty = null;
    let createdWorkload = null;

    try {
      createdFaculty = await Faculty.create({
        facultyId: finalFacultyId,
        facultyName: facultyName.trim(),
        designation: designation.trim(),
        department: dept,
        email: email ? email.trim() : undefined,
        phone: phone ? phone.trim() : null,
        roles: roles && roles.length > 0 ? roles : ['FACULTY'],
      });

      createdWorkload = await FacultyWorkload.create({
        facultyId: finalFacultyId,
        facultyName: facultyName.trim(),
        designation: designation.trim(),
        department: dept,
        teaching,
        responsibilities,
        calculatedTeachingHours,
        calculatedResponsibilityHours,
        calculatedTotalHours,
        sourceTotalHours,
        status,
        discrepancyNote,
        isIncomplete: false,
        sourceVersion: 'v1.0-hod-entry',
      });
    } catch (persistError) {
      // Compensating rollback: Clean up any partial state so DB is never left inconsistent
      if (createdFaculty) {
        await Faculty.deleteOne({ _id: createdFaculty._id }).catch(() => {});
      }
      if (createdWorkload) {
        await FacultyWorkload.deleteOne({ _id: createdWorkload._id }).catch(() => {});
      }
      throw persistError;
    }

    // 6. Response Formatting
    const formatted = formatFacultyAllocations(createdWorkload);
    const facultyObj = createdFaculty.toObject ? createdFaculty.toObject() : createdFaculty;

    return successResponse(
      res,
      {
        ...facultyObj,
        faculty: createdFaculty,
        workload: createdWorkload,
        workloadCalculation: {
          calculatedTeachingHours,
          calculatedResponsibilityHours,
          calculatedTotalHours,
          sourceTotalHours,
          status,
          discrepancyNote,
        },
        summary: formatted.summary,
        teachingLoad: formatted.teachingLoad,
        responsibilities: formatted.responsibilities,
        allocations: formatted.allocations,
      },
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Update Faculty record
 * PUT /api/faculty/:facultyId
 */
async function updateFaculty(req, res, next) {
  try {
    const { facultyId } = req.params;

    const faculty = await Faculty.findOneAndUpdate({ facultyId }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!faculty) {
      return errorResponse(res, `Faculty with ID '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, faculty);
  } catch (error) {
    next(error);
  }
}

/**
 * Get structured allocations for a faculty member
 * GET /api/faculty/:facultyId/allocations
 */
async function getFacultyAllocations(req, res, next) {
  try {
    const { facultyId } = req.params;
    const { category, year, section, courseCode, allocationType } = req.query;

    let workload = await FacultyWorkload.findOne({ facultyId });
    if (!workload && facultyId && facultyId.match(/^[0-9a-fA-F]{24}$/)) {
      const fac = await Faculty.findById(facultyId);
      if (fac) {
        workload = await FacultyWorkload.findOne({ facultyId: fac.facultyId });
      }
    }
    if (!workload) {
      return errorResponse(res, `Allocations for faculty '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    const formatted = formatFacultyAllocations(workload, {
      category,
      year,
      section,
      courseCode,
      allocationType,
    });

    return successResponse(res, formatted);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Faculty record
 * DELETE /api/faculty/:facultyId
 */
async function deleteFaculty(req, res, next) {
  try {
    const { facultyId } = req.params;

    const faculty = await Faculty.findOneAndDelete({ facultyId });
    if (!faculty) {
      return errorResponse(res, `Faculty with ID '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: `Faculty '${facultyId}' deleted successfully` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getFacultyList,
  getFacultyById,
  getFacultyAllocations,
  createFaculty,
  updateFaculty,
  deleteFaculty,
};
