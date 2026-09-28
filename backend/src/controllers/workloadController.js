const FacultyWorkload = require('../models/FacultyWorkload');
const {
  processWorkloadCalculations,
  getDynamicSummaryMetrics,
  formatFacultyAllocations,
  calculateTeachingHours,
  calculateResponsibilityHours,
  parseYearAndSection,
  classifyResponsibility,
} = require('../services/workloadService');
const { getCanonicalRoleName } = require('../constants/responsibilityMaster');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { getPaginationParams, formatPaginatedResult } = require('../utils/pagination');

/**
 * Get all workload records with multi-attribute search and filters
 * GET /api/workload
 */
async function getWorkloadList(req, res, next) {
  try {
    const { search, status, role, category, facultyId } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);

    const query = {};

    if (facultyId) {
      query.facultyId = facultyId;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const q = search.trim();
      query.$or = [
        { facultyName: { $regex: q, $options: 'i' } },
        { facultyId: { $regex: q, $options: 'i' } },
        { designation: { $regex: q, $options: 'i' } },
        { 'teaching.ugTheory1.courseCode': { $regex: q, $options: 'i' } },
        { 'teaching.ugTheory1.courseName': { $regex: q, $options: 'i' } },
        { 'teaching.ugTheory2.courseCode': { $regex: q, $options: 'i' } },
        { 'teaching.ugTheory2.courseName': { $regex: q, $options: 'i' } },
        { 'teaching.lab1.courseCode': { $regex: q, $options: 'i' } },
        { 'teaching.lab1.courseName': { $regex: q, $options: 'i' } },
        { 'teaching.lab2.courseCode': { $regex: q, $options: 'i' } },
        { 'teaching.lab2.courseName': { $regex: q, $options: 'i' } },
        { 'teaching.pg.courseCode': { $regex: q, $options: 'i' } },
        { 'teaching.pg.courseName': { $regex: q, $options: 'i' } },
        { 'teaching.others.courseName': { $regex: q, $options: 'i' } },
        { 'responsibilities.role': { $regex: q, $options: 'i' } },
        { 'responsibilities.allocation': { $regex: q, $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      if (role === 'HOD') {
        query.$or = [
          { designation: { $regex: 'hod', $options: 'i' } },
          { 'responsibilities.role': { $regex: 'hod', $options: 'i' } },
        ];
      } else if (role === 'ACADEMIC_COORDINATOR') {
        query['responsibilities.role'] = { $regex: 'academic coordinator', $options: 'i' };
      } else if (role === 'CLASS_ADVISOR') {
        query['responsibilities.role'] = { $regex: 'class advisor', $options: 'i' };
      } else if (role === 'PROCTOR') {
        query['responsibilities.role'] = { $regex: 'proctor', $options: 'i' };
      } else if (role === 'TEACHING_ONLY') {
        query.responsibilities = { $size: 0 };
      } else if (role === 'RESPONSIBILITIES') {
        query['responsibilities.0'] = { $exists: true };
      }
    }

    if (category && category !== 'all') {
      if (category === 'UG_THEORY') {
        query.$or = [
          { 'teaching.ugTheory1.0': { $exists: true } },
          { 'teaching.ugTheory2.0': { $exists: true } },
        ];
      } else if (category === 'LAB') {
        query.$or = [
          { 'teaching.lab1.0': { $exists: true } },
          { 'teaching.lab2.0': { $exists: true } },
        ];
      } else if (category === 'PG') {
        query['teaching.pg.0'] = { $exists: true };
      } else if (category === 'OTHERS') {
        query['teaching.others.0'] = { $exists: true };
      }
    }

    const [items, total] = await Promise.all([
      FacultyWorkload.find(query).sort({ facultyId: 1 }).skip(skip).limit(limit),
      FacultyWorkload.countDocuments(query),
    ]);

    return successResponse(res, formatPaginatedResult(items, total, page, limit));
  } catch (error) {
    next(error);
  }
}

/**
 * Get dynamic summary metrics calculated directly from MongoDB
 * GET /api/workload/summary
 */
async function getWorkloadSummary(req, res, next) {
  try {
    const summary = await getDynamicSummaryMetrics();
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
}

/**
 * Get workload records requiring review (arithmetic discrepancies)
 * GET /api/workload/discrepancies
 */
async function getWorkloadDiscrepancies(req, res, next) {
  try {
    const items = await FacultyWorkload.find({ status: 'REVIEW REQUIRED' }).sort({ facultyId: 1 });
    return successResponse(res, { count: items.length, items });
  } catch (error) {
    next(error);
  }
}

/**
 * Get incomplete workload records
 * GET /api/workload/incomplete
 */
async function getWorkloadIncomplete(req, res, next) {
  try {
    const items = await FacultyWorkload.find({ status: 'INCOMPLETE SOURCE DATA' }).sort({ facultyId: 1 });
    return successResponse(res, { count: items.length, items });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single workload record by facultyId
 * GET /api/workload/:facultyId
 */
async function getWorkloadById(req, res, next) {
  try {
    const { facultyId } = req.params;

    const record = await FacultyWorkload.findOne({ facultyId });
    if (!record) {
      return errorResponse(res, `Workload record for faculty '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, record);
  } catch (error) {
    next(error);
  }
}

/**
 * Create new Workload record
 * POST /api/workload
 */
async function createWorkload(req, res, next) {
  try {
    const { facultyId, facultyName, designation, teaching, responsibilities, sourceTotalHours } = req.body;

    const existing = await FacultyWorkload.findOne({ facultyId });
    if (existing) {
      return errorResponse(res, `Workload for faculty '${facultyId}' already exists`, 409, 'DUPLICATE_ID');
    }

    const calculated = processWorkloadCalculations(req.body);

    const record = await FacultyWorkload.create({
      facultyId,
      facultyName,
      designation,
      teaching: teaching || {},
      responsibilities: responsibilities || [],
      sourceTotalHours: sourceTotalHours !== undefined ? sourceTotalHours : null,
      ...calculated,
    });

    return successResponse(res, record, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update Workload record by facultyId
 * PUT /api/workload/:facultyId
 */
async function updateWorkload(req, res, next) {
  try {
    const { facultyId } = req.params;

    const record = await FacultyWorkload.findOne({ facultyId });
    if (!record) {
      return errorResponse(res, `Workload record for faculty '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    const normalizeTeachingItem = (item, defaultCategory) => {
      const parsed = parseYearAndSection(item.allocation);
      return {
        category: item.category || defaultCategory,
        courseCode: item.courseCode ? item.courseCode.trim() : null,
        courseName: item.courseName ? item.courseName.trim() : '',
        allocation: item.allocation ? item.allocation.trim() : null,
        hours: typeof item.hours === 'number' ? item.hours : 0,
        year: item.year ? item.year.trim() : parsed.year,
        section: item.section ? item.section.trim() : parsed.section,
      };
    };

    let updatedTeaching = record.teaching;
    if (req.body.teaching) {
      const raw = req.body.teaching;
      updatedTeaching = {
        ugTheory1: (raw.ugTheory1 || []).map((i) => normalizeTeachingItem(i, 'UG Theory 1')),
        ugTheory2: (raw.ugTheory2 || []).map((i) => normalizeTeachingItem(i, 'UG Theory 2')),
        lab1: (raw.lab1 || []).map((i) => normalizeTeachingItem(i, 'Lab 1')),
        lab2: (raw.lab2 || []).map((i) => normalizeTeachingItem(i, 'Lab 2')),
        pg: (raw.pg || []).map((i) => {
          const item = normalizeTeachingItem(i, 'PG');
          item.hours = i.hours !== undefined && i.hours !== null ? i.hours : 1;
          return item;
        }),
        others: (raw.others || []).map((i) => normalizeTeachingItem(i, 'Others')),
      };
    }

    let updatedResponsibilities = record.responsibilities;
    if (req.body.responsibilities) {
      updatedResponsibilities = req.body.responsibilities.map((item) => {
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
    }

    const calculatedTeachingHours = calculateTeachingHours(updatedTeaching);
    const calculatedResponsibilityHours = calculateResponsibilityHours(updatedResponsibilities);
    const calculatedTotalHours = calculatedTeachingHours + calculatedResponsibilityHours;

    let sourceTotalHours;
    if (req.body.sourceTotalHours !== undefined) {
      sourceTotalHours = req.body.sourceTotalHours !== null ? Number(req.body.sourceTotalHours) : null;
    } else if (record.sourceTotalHours === record.calculatedTotalHours || record.sourceTotalHours === null || record.sourceTotalHours === undefined) {
      sourceTotalHours = calculatedTotalHours;
    } else {
      sourceTotalHours = Number(record.sourceTotalHours);
    }

    const status = sourceTotalHours === calculatedTotalHours ? 'MATCHED' : 'REVIEW REQUIRED';
    const discrepancyNote =
      sourceTotalHours !== calculatedTotalHours
        ? `Source total (${sourceTotalHours}h) does not match calculated total (${calculatedTotalHours}h). Difference: ${Math.abs(
            sourceTotalHours - calculatedTotalHours
          )}h.`
        : null;

    record.teaching = updatedTeaching;
    record.responsibilities = updatedResponsibilities;
    record.calculatedTeachingHours = calculatedTeachingHours;
    record.calculatedResponsibilityHours = calculatedResponsibilityHours;
    record.calculatedTotalHours = calculatedTotalHours;
    record.sourceTotalHours = sourceTotalHours;
    record.status = status;
    record.discrepancyNote = discrepancyNote;
    if (req.body.facultyName) record.facultyName = req.body.facultyName.trim();
    if (req.body.designation) record.designation = req.body.designation.trim();

    await record.save();

    const formatted = formatFacultyAllocations(record);
    return successResponse(res, {
      ...record.toObject(),
      summary: formatted.summary,
      teachingLoad: formatted.teachingLoad,
      responsibilities: formatted.responsibilities,
      allocations: formatted.allocations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Workload record
 * DELETE /api/workload/:facultyId
 */
async function deleteWorkload(req, res, next) {
  try {
    const { facultyId } = req.params;

    const record = await FacultyWorkload.findOneAndDelete({ facultyId });
    if (!record) {
      return errorResponse(res, `Workload record for faculty '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: `Workload record for faculty '${facultyId}' deleted` });
  } catch (error) {
    next(error);
  }
}

/**
 * Get structured allocations for a faculty member
 * GET /api/workload/:facultyId/allocations
 */
async function getFacultyAllocations(req, res, next) {
  try {
    const { facultyId } = req.params;
    const { category, year, section, courseCode, allocationType } = req.query;

    const record = await FacultyWorkload.findOne({ facultyId });
    if (!record) {
      return errorResponse(res, `Workload record for faculty '${facultyId}' not found`, 404, 'NOT_FOUND');
    }

    const formatted = formatFacultyAllocations(record, {
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

module.exports = {
  getWorkloadList,
  getWorkloadSummary,
  getWorkloadDiscrepancies,
  getWorkloadIncomplete,
  getWorkloadById,
  getFacultyAllocations,
  createWorkload,
  updateWorkload,
  deleteWorkload,
};
