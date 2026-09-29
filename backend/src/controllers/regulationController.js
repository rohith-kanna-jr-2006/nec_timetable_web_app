const Course = require('../models/Course');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Static metadata directly from the authoritative curriculum document:
 * R22_CSE_2024_25_Onwards_Semester_Details.md (July 2024)
 * Nandha Engineering College (Autonomous) - B.E. Computer Science and Engineering
 */
const R22_METADATA = {
  regulationCode: 'R22',
  curriculumCode: 'R22-CSE',
  department: 'CSE',
  programme: 'B.E. Computer Science and Engineering',
  institution: 'Nandha Engineering College (Autonomous)',
  degreeLevel: 'B.E. (UG) & M.E. (PG)',
  duration: '8 Semesters (4 Academic Years)',
  effectiveFrom: '2024-25 onwards',
  sourceDocument: 'Academic-year-2024-2025-onwards(2).pdf (July 2024)',
};

/**
 * Get current active regulation details and its verified course catalog
 * GET /api/regulation/current or GET /api/regulations/current
 */
async function getCurrentRegulation(req, res, next) {
  try {
    const courses = await Course.find({ isR22UG: true, isActive: true })
      .sort({ semester: 1, courseCode: 1 })
      .lean();

    const breakdown = {
      semesterI: courses.filter((c) => c.semester === 'Semester I').length,
      semesterII: courses.filter((c) => c.semester === 'Semester II').length,
      semesterIII: courses.filter((c) => c.semester === 'Semester III').length,
      semesterIV: courses.filter((c) => c.semester === 'Semester IV').length,
      semesterV: courses.filter((c) => c.semester === 'Semester V').length,
      semesterVI: courses.filter((c) => c.semester === 'Semester VI').length,
      semesterVII: courses.filter((c) => c.semester === 'Semester VII').length,
      semesterVIII: courses.filter((c) => c.semester === 'Semester VIII').length,
      programmeElectives: courses.filter((c) => c.category === 'PEC').length,
      openElectives: courses.filter((c) => c.category === 'OEC').length,
    };

    const regulationData = {
      ...R22_METADATA,
      totalCourses: courses.length,
      breakdown,
      courses,
    };

    return successResponse(res, regulationData);
  } catch (error) {
    next(error);
  }
}

/**
 * List available regulations
 * GET /api/regulations
 */
async function getRegulations(req, res, next) {
  try {
    const totalR22Courses = await Course.countDocuments({ isR22UG: true, isActive: true });

    const regulations = [
      {
        ...R22_METADATA,
        status: 'ACTIVE',
        isDefault: true,
        totalCourses: totalR22Courses,
      },
    ];

    return successResponse(res, regulations);
  } catch (error) {
    next(error);
  }
}

/**
 * Get regulation by code
 * GET /api/regulations/:code
 */
async function getRegulationByCode(req, res, next) {
  try {
    const { code } = req.params;
    if (code.toUpperCase().trim() !== 'R22') {
      return errorResponse(res, `Regulation '${code}' not found`, 404, 'NOT_FOUND');
    }
    return getCurrentRegulation(req, res, next);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentRegulation,
  getRegulations,
  getRegulationByCode,
};
