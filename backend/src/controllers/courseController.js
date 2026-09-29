const mongoose = require('mongoose');
const Course = require('../models/Course');
const AcademicContext = require('../models/AcademicContext');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { getPaginationParams, formatPaginatedResult } = require('../utils/pagination');
const {
  R22_CSE_CURRICULUM_COURSES,
  R22_ELECTIVE_SLOT_MAP,
  R22_PEC_VERTICALS,
  R22_MANAGEMENT_ELECTIVES,
  R22_OPEN_ELECTIVES,
} = require('../data/r22CurriculumMaster');

/**
 * Roman to Arabic / Roman normalization map
 */
const NUMERAL_TO_ROMAN = {
  '1': 'I', 'I': 'I',
  '2': 'II', 'II': 'II',
  '3': 'III', 'III': 'III',
  '4': 'IV', 'IV': 'IV',
  '5': 'V', 'V': 'V',
  '6': 'VI', 'VI': 'VI',
  '7': 'VII', 'VII': 'VII',
  '8': 'VIII', 'VIII': 'VIII',
};

const YEAR_TO_SEMESTER_ODD = {
  'I YEAR': 'Semester I', '1': 'Semester I', 'I': 'Semester I',
  'II YEAR': 'Semester III', '2': 'Semester III', 'II': 'Semester III',
  'III YEAR': 'Semester V', '3': 'Semester V', 'III': 'Semester V',
  'IV YEAR': 'Semester VII', '4': 'Semester VII', 'IV': 'Semester VII',
};

const YEAR_TO_SEMESTER_EVEN = {
  'I YEAR': 'Semester II', '1': 'Semester II', 'I': 'Semester II',
  'II YEAR': 'Semester IV', '2': 'Semester IV', 'II': 'Semester IV',
  'III YEAR': 'Semester VI', '3': 'Semester VI', 'III': 'Semester VI',
  'IV YEAR': 'Semester VIII', '4': 'Semester VIII', 'IV': 'Semester VIII',
};

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
      academicContextId,
      year,
    } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);

    const query = { isActive: true };

    if (academicContextId) {
      const context = await AcademicContext.findById(academicContextId);
      if (context) {
        const isEven = /even/i.test(context.semester);
        const mapToUse = isEven ? YEAR_TO_SEMESTER_EVEN : YEAR_TO_SEMESTER_ODD;
        const ctxYearUpper = (context.year || '').toUpperCase().trim();
        const mappedSem = mapToUse[ctxYearUpper];
        if (mappedSem && !semester) {
          query.semester = { $regex: `^${mappedSem}$`, $options: 'i' };
        }
        if (context.program === 'UG' && isR22UG === undefined) {
          query.isR22UG = true;
        }
      }
    } else if (year && !semester) {
      const yearUpper = year.toUpperCase().trim();
      const mappedSem = YEAR_TO_SEMESTER_ODD[yearUpper];
      if (mappedSem) {
        query.semester = { $regex: `^${mappedSem}$`, $options: 'i' };
      }
    }

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
      const semClean = sem.replace(/^(semester|sem)\.?\s*/i, '').trim().toUpperCase();
      const roman = NUMERAL_TO_ROMAN[semClean];
      if (roman) {
        query.semester = { $regex: `^Semester ${roman}$`, $options: 'i' };
      } else {
        query.semester = { $regex: `^${sem}$`, $options: 'i' };
      }
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

    let isDbOnline = mongoose.connection.readyState === 1;
    let items = [];
    let total = 0;

    if (isDbOnline) {
      try {
        [items, total] = await Promise.all([
          Course.find(query).sort({ semester: 1, courseCode: 1 }).skip(skip).limit(limit),
          Course.countDocuments(query),
        ]);
      } catch (dbErr) {
        isDbOnline = false;
      }
    }

    if (!isDbOnline || total === 0) {
      let dataset = [...R22_CSE_CURRICULUM_COURSES];

      if (semester) {
        const semClean = semester.replace(/^semester\s+/i, '').trim().toUpperCase();
        const roman = NUMERAL_TO_ROMAN[semClean] || semClean;
        dataset = dataset.filter((c) => {
          const cSem = (c.semester || '').replace(/^semester\s+/i, '').trim().toUpperCase();
          return cSem === roman || (c.semester && c.semester.toLowerCase() === semester.toLowerCase());
        });
      }

      if (category) {
        dataset = dataset.filter((c) => (c.category || '').toLowerCase() === category.toLowerCase().trim());
      }

      if (electiveType) {
        dataset = dataset.filter((c) => (c.electiveType || '').toLowerCase().includes(electiveType.toLowerCase().trim()));
      }

      if (vertical) {
        dataset = dataset.filter((c) => (c.vertical || '').toLowerCase().includes(vertical.toLowerCase().trim()));
      }

      if (courseType) {
        dataset = dataset.filter((c) => (c.courseType || '').toLowerCase() === courseType.toLowerCase().trim());
      }

      if (isLab !== undefined) {
        dataset = dataset.filter((c) => Boolean(c.isLab) === (isLab === 'true'));
      }

      if (search) {
        const q = search.toLowerCase().trim();
        dataset = dataset.filter(
          (c) =>
            (c.courseCode && c.courseCode.toLowerCase().includes(q)) ||
            (c.courseName && c.courseName.toLowerCase().includes(q)) ||
            (c.category && c.category.toLowerCase().includes(q)) ||
            (c.vertical && c.vertical.toLowerCase().includes(q))
        );
      }

      total = dataset.length;
      items = dataset.slice(skip, skip + limit);
    }

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

/**
 * Get Authoritative R22 Curriculum Overview & Metadata
 * GET /api/courses/curriculum/r22
 */
async function getR22CurriculumOverview(req, res, next) {
  try {
    return successResponse(res, {
      curriculumCode: 'R22-CSE',
      regulation: 'R22 Regulations',
      institution: 'Nandha Engineering College (Autonomous)',
      affiliation: 'Anna University Affiliated',
      applicableFrom: 'Academic Year 2024–2025 onwards',
      degreeLevels: 'B.E. (UG) & M.E. (PG)',
      duration: '8 Semesters (4 Academic Years)',
      totalCourses: R22_CSE_CURRICULUM_COURSES.length,
      courses: R22_CSE_CURRICULUM_COURSES,
      electiveSlotMap: R22_ELECTIVE_SLOT_MAP,
      pecVerticals: R22_PEC_VERTICALS,
      managementElectives: R22_MANAGEMENT_ELECTIVES,
      openElectives: R22_OPEN_ELECTIVES,
    });
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
  getR22CurriculumOverview,
};
