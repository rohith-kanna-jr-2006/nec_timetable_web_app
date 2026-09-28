const Course = require('../models/Course');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { getPaginationParams, formatPaginatedResult } = require('../utils/pagination');

/**
 * Get courses list with filters and pagination
 * GET /api/courses
 */
async function getCourses(req, res, next) {
  try {
    const {
      search,
      courseType,
      semester,
      department,
      regulation,
      category,
      electiveType,
      vertical,
      isLab,
      isR22UG,
    } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);

    const query = { isActive: true };

    if (search) {
      const q = search.trim();
      query.$or = [
        { courseCode: { $regex: q, $options: 'i' } },
        { courseName: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { vertical: { $regex: q, $options: 'i' } },
      ];
    }

    if (courseType) {
      query.courseType = courseType.toUpperCase().trim();
    }

    if (regulation) {
      query.regulation = regulation.toUpperCase().trim();
    }

    if (category) {
      query.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }

    if (electiveType) {
      query.electiveType = { $regex: electiveType.trim(), $options: 'i' };
    }

    if (vertical) {
      query.vertical = { $regex: vertical.trim(), $options: 'i' };
    }

    if (semester) {
      const sem = semester.trim();
      const semNorm = sem.replace(/^semester\s+/i, '');
      query.semester = { $regex: `^Semester ${semNorm}$`, $options: 'i' };
    }

    if (department) {
      query.department = department.toUpperCase().trim();
    }

    if (isLab !== undefined) {
      query.isLab = isLab === 'true';
    }

    if (isR22UG !== undefined) {
      query.isR22UG = isR22UG === 'true';
    }

    const [items, total] = await Promise.all([
      Course.find(query).sort({ semester: 1, courseCode: 1 }).skip(skip).limit(limit),
      Course.countDocuments(query),
    ]);

    return successResponse(res, formatPaginatedResult(items, total, page, limit));
  } catch (error) {
    next(error);
  }
}

/**
 * Get course by courseCode
 * GET /api/courses/:courseCode
 */
async function getCourseByCode(req, res, next) {
  try {
    const { courseCode } = req.params;
    const course = await Course.findOne({ courseCode: courseCode.toUpperCase().trim() });

    if (!course) {
      return errorResponse(res, `Course '${courseCode}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, course);
  } catch (error) {
    next(error);
  }
}

/**
 * Create course
 * POST /api/courses
 */
async function createCourse(req, res, next) {
  try {
    const {
      courseCode,
      courseName,
      courseType,
      category,
      credits,
      regulation,
      programme,
      academicYear,
      curriculumYear,
      semester,
      department,
      prerequisite,
      contactPeriod,
      contactHours,
      L,
      T,
      P,
      totalPeriod,
      electiveSlot,
      electiveType,
      vertical,
      isLab,
      isR22UG,
    } = req.body;

    const existing = await Course.findOne({ courseCode: courseCode.toUpperCase().trim() });
    if (existing) {
      return errorResponse(res, `Course code '${courseCode}' already exists`, 409, 'DUPLICATE_CODE');
    }

    const course = await Course.create({
      courseCode: courseCode.toUpperCase().trim(),
      courseName,
      courseType: courseType || 'THEORY',
      category: category || 'Professional Core',
      credits: credits !== undefined ? credits : 3,
      regulation: regulation || 'R22',
      programme: programme || 'B.E. Computer Science and Engineering',
      academicYear: academicYear || '2024-25 onwards',
      curriculumYear: curriculumYear || '2024-25 onwards',
      semester: semester || 'Semester I',
      department: (department || 'CSE').toUpperCase().trim(),
      prerequisite: prerequisite || '-',
      contactPeriod: contactPeriod || '-',
      contactHours: contactHours !== undefined ? contactHours : 0,
      L: L !== undefined ? L : 0,
      T: T !== undefined ? T : 0,
      P: P !== undefined ? P : 0,
      totalPeriod: totalPeriod !== undefined ? totalPeriod : 0,
      electiveSlot: electiveSlot || null,
      electiveType: electiveType || null,
      vertical: vertical || null,
      isLab: Boolean(isLab),
      isR22UG: isR22UG !== undefined ? Boolean(isR22UG) : true,
    });

    return successResponse(res, course, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update course
 * PUT /api/courses/:courseCode
 */
async function updateCourse(req, res, next) {
  try {
    const { courseCode } = req.params;

    const course = await Course.findOneAndUpdate(
      { courseCode: courseCode.toUpperCase().trim() },
      req.body,
      { new: true, runValidators: true }
    );

    if (!course) {
      return errorResponse(res, `Course '${courseCode}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, course);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete course
 * DELETE /api/courses/:courseCode
 */
async function deleteCourse(req, res, next) {
  try {
    const { courseCode } = req.params;

    const course = await Course.findOneAndDelete({ courseCode: courseCode.toUpperCase().trim() });
    if (!course) {
      return errorResponse(res, `Course '${courseCode}' not found`, 404, 'NOT_FOUND');
    }

    return successResponse(res, { message: `Course '${courseCode}' deleted successfully` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCourses,
  getCourseByCode,
  createCourse,
  updateCourse,
  deleteCourse,
};
