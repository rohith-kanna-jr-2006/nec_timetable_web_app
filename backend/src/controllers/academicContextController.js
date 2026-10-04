const AcademicContext = require('../models/AcademicContext');
const { resolveAcademicYearRange } = require('../utils/academicYearRange');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get all academic contexts
 * GET /api/academic-contexts
 */
async function getContexts(req, res, next) {
  try {
    const { department, semester, academicYear, year, section, status, academicYearFrom, academicYearTo } = req.query;
    const query = {};

    if (department) query.department = department.toUpperCase().trim();
    if (semester) query.semester = semester.trim();

    // Phase 8: an explicit canonical range filters on the authoritative fields.
    // A legacy academicYear string is resolved to that range before querying so
    // both spellings select exactly the same contexts.
    const requestedRange = resolveAcademicYearRange({
      academicYear,
      academicYearFrom,
      academicYearTo,
    });
    if (academicYear || academicYearFrom || academicYearTo) {
      if (!requestedRange) {
        return errorResponse(
          res,
          'Academic year filter must be a canonical YYYY-YY range or a valid academicYearFrom/academicYearTo pair',
          400,
          'INVALID_ACADEMIC_YEAR'
        );
      }
      query.academicYearFrom = requestedRange.academicYearFrom;
      query.academicYearTo = requestedRange.academicYearTo;
    }
    if (year) query.year = year.trim();
    if (section) query.section = section.toUpperCase().trim();
    if (status) query.status = status.toUpperCase().trim();

    const contexts = await AcademicContext.find(query).sort({
      academicYearFrom: -1,
      year: 1,
      section: 1,
    });

    return successResponse(res, contexts);
  } catch (error) {
    next(error);
  }
}

/**
 * Get active academic context
 * GET /api/academic-contexts/active
 */
async function getActiveContext(req, res, next) {
  try {
    const mongoose = require('mongoose');
    let context = null;
    if (mongoose.connection.readyState === 1) {
      context = await AcademicContext.findOne({ status: 'ACTIVE' });
    }
    if (!context) {
      const { DEFAULT_ACTIVE_CONTEXT } = require('../data/offlineFallbackData');
      return successResponse(res, DEFAULT_ACTIVE_CONTEXT);
    }
    return successResponse(res, context);
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
    if (req.params.id === 'active') {
      return getActiveContext(req, res, next);
    }
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
    const { academicYear, academicYearFrom, academicYearTo, semester, department, year, section, program, status } = req.body;

    const range = resolveAcademicYearRange({ academicYear, academicYearFrom, academicYearTo });
    if (!range) {
      return errorResponse(
        res,
        'A valid academic year is required. Supply academicYearFrom/academicYearTo with academicYearFrom < academicYearTo, or a canonical academicYear such as 2026-27.',
        400,
        'INVALID_ACADEMIC_YEAR'
      );
    }

    // Phase 8: identity is the canonical range, not the legacy display string.
    const existing = await AcademicContext.findOne({
      academicYearFrom: range.academicYearFrom,
      academicYearTo: range.academicYearTo,
      semester: semester.trim(),
      department: department.toUpperCase().trim(),
      year: year.trim(),
      section: section.toUpperCase().trim(),
    });

    if (existing) {
      return errorResponse(
        res,
        'Academic context with this academic year range, semester, department, year and section already exists',
        409,
        'DUPLICATE_CONTEXT',
        { academicContextId: existing._id }
      );
    }

    const context = await AcademicContext.create({
      academicYearFrom: range.academicYearFrom,
      academicYearTo: range.academicYearTo,
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
  getActiveContext,
  createContext,
  updateContext,
  deleteContext,
};
