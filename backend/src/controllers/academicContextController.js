const AcademicContext = require('../models/AcademicContext');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get all academic contexts
 * GET /api/academic-contexts
 */
async function getContexts(req, res, next) {
  try {
    const { department, semester, academicYear, year, section, status } = req.query;
    const query = {};

    if (department) query.department = department.toUpperCase().trim();
    if (semester) query.semester = semester.trim();
    if (academicYear) query.academicYear = academicYear.trim();
    if (year) query.year = year.trim();
    if (section) query.section = section.toUpperCase().trim();
    if (status) query.status = status.toUpperCase().trim();

    const contexts = await AcademicContext.find(query).sort({
      academicYear: -1,
      year: 1,
      section: 1,
    });

    return successResponse(res, contexts);
  } catch (error) {
    next(error);
  }
}

/**
 * Get single context by ID
 * GET /api/academic-contexts/:id
 */
async function getContextById(req, res, next) {
  try {
    const context = await AcademicContext.findById(req.params.id);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }
    return successResponse(res, context);
  } catch (error) {
    next(error);
  }
}

/**
 * Create academic context
 * POST /api/academic-contexts
 */
async function createContext(req, res, next) {
  try {
    const { academicYear, semester, department, year, section, program, status } = req.body;

    const existing = await AcademicContext.findOne({
      academicYear: academicYear.trim(),
      semester: semester.trim(),
      department: department.toUpperCase().trim(),
      year: year.trim(),
      section: section.toUpperCase().trim(),
    });

    if (existing) {
      return errorResponse(
        res,
        'Academic context with this year, semester, department, year and section already exists',
        409,
        'DUPLICATE_CONTEXT'
      );
    }

    const context = await AcademicContext.create({
      academicYear: academicYear.trim(),
      semester: semester.trim(),
      department: department.toUpperCase().trim(),
      year: year.trim(),
      section: section.toUpperCase().trim(),
      program: program || 'UG',
      status: status || 'ACTIVE',
    });

    return successResponse(res, context, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update academic context
 * PUT /api/academic-contexts/:id
 */
async function updateContext(req, res, next) {
  try {
    const context = await AcademicContext.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, context);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete academic context
 * DELETE /api/academic-contexts/:id
 */
async function deleteContext(req, res, next) {
  try {
    const context = await AcademicContext.findByIdAndDelete(req.params.id);
    if (!context) {
      return errorResponse(res, 'Academic context not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: 'Academic context deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContexts,
  getContextById,
  createContext,
  updateContext,
  deleteContext,
};
