const CourseFacultyHandler = require('../models/CourseFacultyHandler');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get all course faculty candidate handlers
 * GET /api/course-faculty-handlers
 */
async function getHandlers(req, res, next) {
  try {
    const handlers = await CourseFacultyHandler.find().sort({ courseCode: 1 });
    return successResponse(res, handlers);
  } catch (error) {
    next(error);
  }
}

/**
 * Get candidate handlers for a specific course
 * GET /api/course-faculty-handlers/:courseCode
 */
async function getHandlerByCourse(req, res, next) {
  try {
    const { courseCode } = req.params;
    const handler = await CourseFacultyHandler.findOne({ courseCode: courseCode.toUpperCase().trim() });

    if (!handler) {
      return errorResponse(res, `No handler pool found for course '${courseCode}'`, 404, 'NOT_FOUND');
    }

    return successResponse(res, handler);
  } catch (error) {
    next(error);
  }
}

/**
 * Create candidate handlers for a course (AC Input)
 * POST /api/course-faculty-handlers
 */
async function createHandler(req, res, next) {
  try {
    const { courseCode, candidateFacultyIds, preferredFacultyId, remarks } = req.body;

    const existing = await CourseFacultyHandler.findOne({ courseCode: courseCode.toUpperCase().trim() });
    if (existing) {
      return errorResponse(
        res,
        `Handler pool for course '${courseCode}' already exists. Use PUT to update.`,
        409,
        'DUPLICATE_HANDLER'
      );
    }

    const handler = await CourseFacultyHandler.create({
      courseCode: courseCode.toUpperCase().trim(),
      candidateFacultyIds: candidateFacultyIds || [],
      preferredFacultyId: preferredFacultyId || null,
      remarks: remarks || null,
      submittedBy: req.user ? req.user.name || req.user.email : 'AC',
    });

    return successResponse(res, handler, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update candidate handlers for a course
 * PUT /api/course-faculty-handlers/:courseCode
 */
async function updateHandler(req, res, next) {
  try {
    const { courseCode } = req.params;

    const handler = await CourseFacultyHandler.findOneAndUpdate(
      { courseCode: courseCode.toUpperCase().trim() },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );

    return successResponse(res, handler);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete candidate handler entry
 * DELETE /api/course-faculty-handlers/:courseCode
 */
async function deleteHandler(req, res, next) {
  try {
    const { courseCode } = req.params;

    const handler = await CourseFacultyHandler.findOneAndDelete({
      courseCode: courseCode.toUpperCase().trim(),
    });

    if (!handler) {
      return errorResponse(res, `Handler pool for course '${courseCode}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: `Handler pool for course '${courseCode}' deleted` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHandlers,
  getHandlerByCourse,
  createHandler,
  updateHandler,
  deleteHandler,
};
